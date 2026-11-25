import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { databaseSources, pool } from "./config/db.js";
import apiRoutes from "./routes/index.js";
import { errorHandler } from "./utils/http.js";
import { checkReadiness } from "./config/readiness.js";

const app = express();
const allowedOrigins = (env.clientUrl || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Quá nhiều yêu cầu. Vui lòng đợi một lát rồi thử lại.",
    },
  }),
);

app.get("/health", async (_req, res) => {
  const checks = await Promise.allSettled(databaseSources.map((source) => checkReadiness(true, source)));
  const unavailable = checks.some((check) => check.status === "rejected");
  const appReady = checks.every((check) => check.status === "fulfilled" && !check.value.length);
  res.status(appReady ? 200 : 503).json({
    status: appReady ? "ok" : unavailable ? "unavailable" : "setup_required",
    db: unavailable ? "unreachable" : "connected",
    appReady,
    databaseSources,
    timestamp: new Date().toISOString(),
  });
});

app.use("/", apiRoutes);

app.use((_req, res) => {
  res
    .status(404)
    .json({
      message:
        "Không tìm thấy API. Vui lòng kiểm tra phiên bản backend và địa chỉ kết nối.",
    });
});

app.use(errorHandler);

async function bootstrap() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    logger.info("MySQL pool connected successfully.");
    await checkReadiness(true);
  } catch (error) {
    logger.warn(
      "MySQL not reachable yet; continuing server start for local testing.",
    );
  }

  app.listen(env.port, () => {
    logger.info(`Backend running on http://localhost:${env.port}`);
  });
}

bootstrap();
