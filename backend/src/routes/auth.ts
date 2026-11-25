import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { databaseSource, databaseSources, db, dbFor } from "../config/db.js";
import { env } from "../config/env.js";
import { loadUser, publicUser, requireAuth } from "../middleware/auth.js";
import { equalHash, legacyHash, tokenHash } from "../utils/security.js";
import { HttpError, route } from "../utils/http.js";
import { AppUser } from "../types/auth.js";
import { requireReady } from "../config/readiness.js";
const router = Router();
router.use(requireReady);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Thử đăng nhập quá nhiều lần. Vui lòng đợi 15 phút." },
});
function access(user: AppUser, sid: string) {
  return jwt.sign(
    { kind: user.authKind || user.role, credential: user.credential, sid },
    env.jwtAccessSecret,
    {
      subject: String(user.id),
      expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"],
      algorithm: "HS256",
    },
  );
}
router.post(
  "/login",
  limiter,
  route(async (req, res) => {
    const b = z
      .object({
        username: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(128),
        stationId: z.number().int().positive().optional(),
        source: databaseSource.optional(),
      })
      .parse(req.body);
    const candidates: AppUser[] = [];
    if (!b.source || b.source === "db1") {
      const [rows] = await db.execute(
        "SELECT id,password_hash FROM app_users WHERE email=? AND role='admin' AND status=1",
        [b.username],
      );
      const u = (rows as any[])[0];
      if (u && (await bcrypt.compare(b.password, u.password_hash))) {
        const user = await loadUser("admin", u.id);
        if (user) candidates.push(user);
      }
    }
    const passwordHash = legacyHash(b.password);
    const sources = b.source ? [b.source] : databaseSources;
    let unavailable = false;
    const results = await Promise.allSettled(sources.map(async (source) => {
      const [rows] = await dbFor(source).execute(
        "SELECT id,password FROM tbusers WHERE username=?" +
          (b.stationId ? " AND idusergroup=?" : ""),
        b.stationId ? [b.username, b.stationId] : [b.username],
      );
      const users = rows as { id: number; password: string }[];
      const matches: AppUser[] = [];
      for (const u of users)
        if (typeof u.password === "string" && equalHash(u.password, passwordHash)) {
          const user = await loadUser(source === "db1" ? "station" : "station2", u.id);
          if (user) matches.push(user);
        }
      return matches;
    }));
    for (const result of results) {
      if (result.status === "fulfilled") candidates.push(...result.value);
      else unavailable = true;
    }
    if (unavailable && (!b.source && sources.length > 1))
      return res.status(409).json({
        message: "Một nguồn đăng nhập đang gián đoạn. Hãy chọn database của tài khoản.",
        databaseSources,
      });
    if (unavailable) throw new HttpError(503, "Nguồn đăng nhập chưa sẵn sàng. Vui lòng thử lại.");
    if (candidates.length > 1)
      return res
        .status(409)
        .json({
          message: sources.length > 1
            ? "Thông tin đăng nhập trùng nhau. Hãy chọn database hoặc nhập mã trạm."
            : "Tên tài khoản trùng nhau. Vui lòng nhập thêm mã trạm.",
          databaseSources,
        });
    const user = candidates[0];
    if (!user)
      throw new HttpError(
        401,
        "Thông tin không đúng hoặc tài khoản / trạm đã khóa. Nếu trùng tên tài khoản, hãy nhập mã trạm.",
      );
    const sid = randomUUID(),
      refreshToken = randomBytes(48).toString("hex");
    await db.execute(
      "INSERT INTO mobile_sessions (id,subject_kind,subject_id,refresh_hash,credential,expires_at) VALUES (?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))",
      [
        sid,
        user.authKind || user.role,
        user.id,
        tokenHash(refreshToken),
        user.credential,
      ],
    );
    res.json({
      user: publicUser(user),
      accessToken: access(user, sid),
      refreshToken,
    });
  }),
);
router.post(
  "/refresh",
  limiter,
  route(async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string().length(96) })
      .parse(req.body);
    const [rows] = await db.execute(
      "SELECT * FROM mobile_sessions WHERE refresh_hash=? AND expires_at>NOW() AND revoked_at IS NULL",
      [tokenHash(refreshToken)],
    );
    const session = (rows as any[])[0],
      user = session
        ? await loadUser(session.subject_kind, session.subject_id)
        : null;
    if (!user || session.credential !== user.credential)
      throw new HttpError(401, "Phiên đăng nhập đã hết hạn.");
    res.json({ accessToken: access(user, session.id), user: publicUser(user) });
  }),
);
router.get(
  "/me",
  requireAuth,
  route(async (req, res) => {
    res.json({ user: publicUser(req.user!) });
  }),
);
router.post(
  "/logout",
  (req, res, next) => {
    if (req.body?.refreshToken === undefined) return requireAuth(req, res, next);
    next();
  },
  route(async (req, res) => {
    if (req.body?.refreshToken !== undefined) {
      const { refreshToken } = z.object({ refreshToken: z.string().regex(/^[a-f0-9]{96}$/) }).parse(req.body);
      await db.execute("UPDATE mobile_sessions SET revoked_at=NOW() WHERE refresh_hash=? AND revoked_at IS NULL",
        [tokenHash(refreshToken)]);
      return res.json({ message: "Đã đăng xuất." });
    }
    await db.execute("UPDATE mobile_sessions SET revoked_at=NOW() WHERE id=?", [
      req.sessionId!,
    ]);
    res.json({ message: "Đã đăng xuất." });
  }),
);
export default router;
