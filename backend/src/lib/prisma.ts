import { PrismaClient } from "@prisma/client";
import logger from "./logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "error" },
            { emit: "event", level: "warn" },
          ]
        : [{ emit: "event", level: "error" }],
  });

if (process.env.NODE_ENV === "development") {
  global.__prisma = prisma;
}

prisma.$on("error" as never, (e: { message: string }) => {
  logger.error("Prisma error:", e.message);
});

prisma.$on("warn" as never, (e: { message: string }) => {
  logger.warn("Prisma warning:", e.message);
});

export default prisma;