import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/db.js";
import { env } from "../config/env.js";
import { AppUser } from "../types/auth.js";
import { enabled, fingerprint } from "../utils/security.js";
import { HttpError } from "../utils/http.js";
import { isCompanyAdmin } from "../config/access.js";
declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
      sessionId?: string;
    }
  }
}
export type AuthenticatedRequest = Request;
export async function loadUser(
  kind: "admin" | "station",
  id: number,
): Promise<AppUser | null> {
  if (kind === "admin") {
    const [rows] = await db.execute(
      "SELECT id,email,full_name,password_hash,status,role FROM app_users WHERE id=?",
      [id],
    );
    const u = (rows as any[])[0];
    if (!u || !enabled(u.status) || u.role !== "admin") return null;
    return {
      id: u.id,
      username: u.email,
      fullName: u.full_name || u.email,
      role: "admin",
      authKind: "admin",
      stationId: null,
      stationName: null,
      legacyRole: null,
      viewAll: true,
      credential: fingerprint(u),
    };
  }
  const [rows] = await db.execute(
    `SELECT u.*,g.name station_name,g.enable station_enabled,r.name role_name,r.enable role_enabled,
    COALESCE(a.view_all,0) view_all FROM tbusers u JOIN tbusers_group g ON g.id=u.idusergroup
    JOIN tbusers_role r ON r.idtbusers_role=u.iduserrole LEFT JOIN mobile_user_access a ON a.user_id=u.id WHERE u.id=?`,
    [id],
  );
  const u = (rows as any[])[0];
  if (
    !u ||
    !enabled(u.enable) ||
    !enabled(u.station_enabled) ||
    !enabled(u.role_enabled)
  )
    return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.username,
    role: isCompanyAdmin(u.id, u.idusergroup) ? "admin" : "station",
    authKind: "station",
    stationId: u.idusergroup,
    stationName: u.station_name,
    legacyRole: u.role_name,
    viewAll: true,
    credential: fingerprint({
      ...u,
      companyAdmin: isCompanyAdmin(u.id, u.idusergroup),
      policy: "station-wide-v3",
    }),
  };
}
export function publicUser(user: AppUser) {
  const { credential, authKind, ...safe } = user;
  return safe;
}
export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError(401, "Vui lòng đăng nhập.");
    let claims: jwt.JwtPayload;
    try {
      claims = jwt.verify(token, env.jwtAccessSecret, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, "Phiên đăng nhập đã hết hạn.");
    }
    if (
      !["admin", "station"].includes(claims.kind) ||
      typeof claims.sid !== "string"
    )
      throw new HttpError(401, "Phiên đăng nhập không hợp lệ.");
    const [sessions] = await db.execute(
      "SELECT id FROM mobile_sessions WHERE id=? AND subject_id=? AND subject_kind=? AND expires_at>NOW() AND revoked_at IS NULL",
      [claims.sid, Number(claims.sub), claims.kind],
    );
    const user = await loadUser(claims.kind, Number(claims.sub));
    if (
      !(sessions as any[]).length ||
      !user ||
      claims.credential !== user.credential
    )
      throw new HttpError(
        401,
        "Tài khoản hoặc quyền truy cập đã thay đổi. Vui lòng đăng nhập lại.",
      );
    req.user = user;
    req.sessionId = claims.sid;
    next();
  })().catch(next);
};
export function requireRole(...roles: AppUser["role"][]): RequestHandler {
  return (req, _res, next) =>
    next(
      req.user && roles.includes(req.user.role)
        ? undefined
        : new HttpError(403, "Bạn không có quyền thực hiện thao tác này."),
    );
}
