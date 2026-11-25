-- Apply to each database used by the app. Desktop tables are unaffected.
CREATE TABLE IF NOT EXISTS mobile_station_config (
 station_id INT NOT NULL PRIMARY KEY,
 station_type ENUM('truck','durian') NOT NULL,
 data_source ENUM('db1','db2') NOT NULL,
 data_station_id INT NOT NULL,
 revision CHAR(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
