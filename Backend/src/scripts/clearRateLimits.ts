import { redisClient } from "../config/redis.js";
import { logger } from "../utils/logger.js";

async function clearRateLimits() {
  try {
    logger.info("Connecting to Redis to clear rate limit keys...");
    const keys = await redisClient.keys("rl:*");
    
    if (keys.length === 0) {
      console.log("No active rate limit keys found in Redis.");
    } else {
      console.log(`Found ${keys.length} rate limit key(s):`, keys);
      await redisClient.del(...keys);
      console.log(`Successfully cleared ${keys.length} rate limit key(s). Any blocked IPs are now unblocked.`);
    }
  } catch (error: any) {
    console.error("Failed to clear rate limits from Redis:", error.message);
  } finally {
    await redisClient.quit();
    process.exit(0);
  }
}

clearRateLimits();
