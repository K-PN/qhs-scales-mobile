-- Apply after auth-migration.sql. Additive; no changes to desktop tables.
CREATE TABLE IF NOT EXISTS mobile_user_access (
 user_id INT NOT NULL PRIMARY KEY, view_all TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mobile_sessions (
 id VARCHAR(36) NOT NULL PRIMARY KEY, subject_kind VARCHAR(16) NOT NULL, subject_id INT NOT NULL,
 refresh_hash CHAR(64) NOT NULL UNIQUE, credential CHAR(64) NOT NULL, expires_at DATETIME NOT NULL,
 revoked_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_mobile_sessions_subject (subject_kind,subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS mobile_admin_audit (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, actor_id INT NOT NULL, action VARCHAR(32) NOT NULL,
 entity VARCHAR(16) NOT NULL, entity_id INT NOT NULL, detail JSON NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

