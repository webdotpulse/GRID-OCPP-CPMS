import { RedisMemoryServer } from "redis-memory-server";

async function main() {
  console.log("[Redis] Starting standalone Redis instance on 127.0.0.1:6379...");
  const redisServer = new RedisMemoryServer({
    instance: {
      port: 6379,
      ip: "127.0.0.1",
    },
  });
  await redisServer.getHost();
  console.log("[Redis] Standalone Redis server is active on 127.0.0.1:6379");
}

main().catch((err) => {
  console.error("Failed to start Redis:", err);
  process.exit(1);
});
