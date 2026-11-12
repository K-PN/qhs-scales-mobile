// Run from repository root. Environment values are never printed.
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
(async () => {
  const email = process.env.QHS_ADMIN_EMAIL,
    password = process.env.QHS_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set QHS_ADMIN_EMAIL and QHS_ADMIN_PASSWORD (at least 12 characters).",
    );
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    await db.execute(
      "INSERT INTO app_users (email,password_hash,full_name,role,status) VALUES (?,?,?,'admin',1)",
      [
        email.toLowerCase(),
        await bcrypt.hash(password, 12),
        process.env.QHS_ADMIN_NAME || "Quản trị QHS",
      ],
    );
    console.log(
      "Created provider administrator. Existing accounts were not changed.",
    );
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(
    e.code === "ER_DUP_ENTRY"
      ? "Account already exists; no changes made."
      : e.message,
  );
  process.exitCode = 1;
});
