import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { db } from "../config/db.js";
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
      })
      .parse(req.body);
    const candidates: AppUser[] = [];
    {
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
    {
      const [rows] = await db.execute(
        "SELECT id,password FROM tbusers WHERE username=?" +
          (b.stationId ? " AND idusergroup=?" : ""),
        b.stationId ? [b.username, b.stationId] : [b.username],
      );
      const users = rows as any[];
      for (const u of users)
        if (equalHash(u.password, legacyHash(b.password))) {
          const user = await loadUser("station", u.id);
          if (user) candidates.push(user);
        }
    }
    if (candidates.length > 1)
      return res
        .status(409)
        .json({
          message: "Tên tài khoản trùng nhau. Vui lòng nhập thêm mã trạm.",
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
  requireAuth,
  route(async (req, res) => {
    await db.execute("UPDATE mobile_sessions SET revoked_at=NOW() WHERE id=?", [
      req.sessionId!,
    ]);
    res.json({ message: "Đã đăng xuất." });
  }),
);
export default router;
