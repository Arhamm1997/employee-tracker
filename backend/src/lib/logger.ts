import winston from "winston";
import path from "path";
import fs from "fs";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Hidden error reports directory (root of project, shared with frontend/agent)
export const errorsDir = path.join(process.cwd(), "..", ".errors");
if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Detailed format for the error report file (human + AI readable)
const errorReportFormat = printf(({ level, message, timestamp, stack }) => {
  const sep = "=".repeat(80);
  return `${sep}\n[${timestamp}] [${level.toUpperCase()}] ${message}${stack ? `\nSTACK:\n${stack}` : ""}\n`;
});

const logger = winston.createLogger({
  levels: { error: 0, warn: 1, info: 2, http: 3, debug: 4 },
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        errors({ stack: true }),
        timestamp({ format: "HH:mm:ss" }),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
    }),
    // ── Error report file (shared .errors/ folder) ───────────────────────────
    new winston.transports.File({
      filename: path.join(errorsDir, "backend-errors.log"),
      level: "warn",
      format: combine(
        errors({ stack: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        errorReportFormat
      ),
    }),
  ],
});

export default logger;