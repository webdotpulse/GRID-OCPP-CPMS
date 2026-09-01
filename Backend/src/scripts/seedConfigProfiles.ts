import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { prisma, pgliteInstance } from "../config/database.js";
import { seedAllBeneluxProfiles, BENELUX_CHARGER_PROFILES } from "../utils/benelux-charger-profiles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("===============================================================");
  console.log("  Seeding Optimized Benelux & Universal OCPP Configuration Profiles ");
  console.log("===============================================================");
  console.log(`Discovered ${BENELUX_CHARGER_PROFILES.length} OEM & baseline profile definitions.`);

  // Ensure schema DDL is created in database if running with local pglite
  const schemaSqlPath = path.resolve(__dirname, "schema.sql");
  if (fs.existsSync(schemaSqlPath) && pgliteInstance && typeof pgliteInstance.exec === "function") {
    try {
      const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");
      await pgliteInstance.exec(schemaSql);
    } catch {
      // already exists
    }
  }

  const startTime = Date.now();
  const profiles = await seedAllBeneluxProfiles();
  const duration = Date.now() - startTime;

  console.log("---------------------------------------------------------------");
  console.log(`✅ Successfully seeded/updated ${profiles.length} profiles in ${duration}ms:`);
  profiles.forEach((p, idx) => {
    console.log(`  ${idx + 1}. [ID: ${p.id}] ${p.name} (${p.items.length} keys)`);
  });
  console.log("===============================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed to seed configuration profiles:", err);
  process.exit(1);
});
