import { Router } from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../../config/redis.js";
import {
  getAllRfidUsers,
  getRfidUserById,
  createRfidUser,
  updateRfidUser,
  toggleRfidUserStatus,
  deleteRfidUser,
} from "./rfid.controller.js";

const router = Router();

const rfidCreationLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known typing issue with rate-limit-redis and ioredis
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)),
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each user to 5 requests per windowMs
  keyGenerator: (req) => {
    // @ts-expect-error userId is attached by authenticateToken middleware
    return `rfid_create_user_${req.userId || req.ip}`;
  },
  skip: (req) => {
    // @ts-expect-error userRole is attached by authenticateToken middleware
    return req.userRole === "superadmin";
  },
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "You have reached the maximum limit of 5 RFID cards per day.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/", getAllRfidUsers);
router.get("/:id", getRfidUserById);
router.post("/", rfidCreationLimiter, createRfidUser);
router.put("/:id", updateRfidUser);
router.patch("/:id/toggle", toggleRfidUserStatus);
router.delete("/:id", deleteRfidUser);

export default router;
