import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Check your .env path!");
}

export async function verifyConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    console.log("✅ Database connection successful!");
  } catch (error) {
    console.error("❌ Database connection failed.");
    console.error(error);
    process.exit(1);
  }
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
