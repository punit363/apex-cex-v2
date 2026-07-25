// prisma/seed.ts
import { prisma } from "../../src/client";
import { seedAssets } from "./01_asset.seed";

async function main() {
  await seedAssets();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
