import { Router } from "express";
import {
  getContracts,
  createOrUpdateContract,
  getLedgers,
  exportSepa,
  markLedgerPaid,
  calculateReimbursementsManual,
} from "./reimbursements.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = Router();

router.use(authenticateToken);

router.get("/contracts", getContracts as any);
router.post("/contracts", createOrUpdateContract as any);
router.get("/ledgers", getLedgers as any);
router.post("/ledgers/:id/mark-paid", markLedgerPaid as any);
router.get("/export/sepa", exportSepa as any);
router.post("/calculate", calculateReimbursementsManual as any);

export default router;

