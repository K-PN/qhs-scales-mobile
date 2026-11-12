import { test } from "node:test";
import assert from "node:assert/strict";
import { missingTables, requiredTables } from "../src/config/readiness.js";

test("connected legacy database without v2 migration is not application-ready", () => {
  assert.deepEqual(
    missingTables([
      "app_users",
      "tbusers",
      "tbusers_group",
      "tbusers_role",
      "tbweight",
    ]),
    ["mobile_user_access", "mobile_sessions", "mobile_admin_audit"],
  );
});
test("uppercase legacy tbUsers does not substitute for scale accounts tbusers", () => {
  assert.deepEqual(
    missingTables([
      ...requiredTables.filter((t) => t !== "tbusers"),
      "tbUsers",
    ]),
    ["tbusers"],
  );
});
test("fully migrated database is application-ready", () => {
  assert.deepEqual(missingTables([...requiredTables]), []);
});
