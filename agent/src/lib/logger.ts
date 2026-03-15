import path from "path";
import fs from "fs";
import { app } from "electron";
import { createLogger, format, transports } from "winston";

const { combine, timestamp, printf } = format;

function getLogDirectory(): string {
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    const fallback = path.join(process.cwd(), "logs");
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const logDir = getLogDirectory();

const logFormat = printf(({ level, message, timestamp: ts }) => {
  return `[${ts}] [${level.toUpperCase()}] ${String(message)}`;
});

export const logger = createLogger({
  level: "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    new transports.File({
      filename: path.join(logDir, "agent.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 7,
      tailable: true
    }),
    ...(process.env.NODE_ENV === "development"
      ? [new transports.Console()]
      : [])
  ]
});

