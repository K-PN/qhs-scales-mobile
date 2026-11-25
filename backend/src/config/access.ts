import { env } from "./env.js";
// An archive audit entry keeps the desktop record and its historical references intact.
export const notArchived = (entity: "station" | "account", id: string) =>
  `NOT EXISTS (SELECT 1 FROM mobile_admin_audit archive WHERE archive.entity='${entity}' AND archive.entity_id=${id} AND archive.action='archive')`;
export function isCompanyAdmin(
  userId: number,
  stationId: number,
  config = env,
): boolean {
  return (
    config.companyStationId > 0 &&
    stationId === config.companyStationId &&
    config.companyAdminUserIds.includes(userId)
  );
}
