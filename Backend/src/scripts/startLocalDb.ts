import { PGlite } from "@electric-sql/pglite";
import { fromNodeSocket } from "pg-gateway/node";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { RedisMemoryServer } from "redis-memory-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/postgres");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function main() {
  console.log("==================================================");
  console.log(" Starting Local CPMS PostgreSQL & Redis Services ");
  console.log("==================================================");

  // 1. Initialize PGlite database
  console.log(`[Database] Initializing PGlite at: ${DATA_DIR}`);
  const db = new PGlite(DATA_DIR);
  await db.waitReady;
  console.log("[Database] PGlite engine is ready.");

  // Apply schema DDL
  const schemaSqlPath = path.resolve(__dirname, "schema.sql");
  if (fs.existsSync(schemaSqlPath)) {
    console.log("[Database] Applying complete schema DDL from schema.sql...");
    const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");
    await db.exec(schemaSql);
    console.log("[Database] Schema DDL applied successfully.");
  }

  // 2. Start PostgreSQL TCP Gateway on Port 5432
  const pgServer = net.createServer((socket) => {
    fromNodeSocket(socket, {
      serverVersion: "16.0",
      auth: {
        method: "trust",
      },
      async handleQuery(query: any) {
        try {
          const res = await db.query(query);
          return res;
        } catch (err: any) {
          console.error("[Database] Query Error:", err.message);
          throw err;
        }
      },
    } as any);
  });

  pgServer.listen(5432, "127.0.0.1", () => {
    console.log("[Database] PostgreSQL server listening on 127.0.0.1:5432 (Database: ocpp_cpms)");
  });

  // 3. Start Redis Server on Port 6379
  console.log("[Redis] Launching standalone Redis server on 127.0.0.1:6379...");
  try {
    const redisServer = new RedisMemoryServer({
      instance: {
        port: 6379,
        ip: "127.0.0.1",
      },
    });
    await redisServer.getHost();
    console.log("[Redis] Redis server listening on 127.0.0.1:6379");
  } catch (err: any) {
    console.warn(`[Redis] Note: Redis server starting info: ${err.message}`);
  }

  console.log("\n>>> Local infrastructure ready for Prisma & Backend services.");
}

main().catch((err) => {
  console.error("Fatal error starting local db services:", err);
  process.exit(1);
});
