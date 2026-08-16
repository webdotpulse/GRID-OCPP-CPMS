import { Router } from "express";
import multer from "multer";
import path from "path";
import { getCampaigns, createCampaign, uploadMedia, pushCampaign } from "./media-campaigns.controller.js";
import { requireAdmin } from "../../middleware/auth.js";

const router = Router();

router.use(requireAdmin as any);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, WEBP, MP4, and WEBM are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter
});

router.get("/", getCampaigns);
router.post("/", createCampaign);
router.post("/upload", upload.single("file"), uploadMedia);
router.post("/:id/push", pushCampaign);

export default router;
