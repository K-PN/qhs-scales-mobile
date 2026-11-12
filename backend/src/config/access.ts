import { env } from "./env.js";
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
