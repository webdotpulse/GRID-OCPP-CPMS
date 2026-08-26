import { Router } from "express";
import {
  getOcpiCdrs,
  getOcpiCdrById,
  postOcpiCdr,
} from "./cdrs.controller.js";

const router = Router();

router.get("/", getOcpiCdrs);
router.get("/:cdr_id", getOcpiCdrById);
router.post("/", postOcpiCdr);

export default router;
