import { PrismaClient } from "../../generated/prisma";
import { config } from "../config";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: config.env === "development" ? ["warn", "error"] : ["error"],
  });

if (config.env !== "production") {
  global.__prisma = prisma;
}
