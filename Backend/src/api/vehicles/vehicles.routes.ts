import { Router } from "express";
import * as vehiclesController from "./vehicles.controller.js";

const router = Router();

router.get("/energy-profile", vehiclesController.getEnergyProfile);
router.post("/energy-profile", vehiclesController.saveEnergyProfile);

router.get("/", vehiclesController.getCertificates);
router.get("/:id", vehiclesController.getCertificateById);
router.post("/", vehiclesController.createCertificate);
router.put("/:id", vehiclesController.updateCertificate);
router.delete("/:id", vehiclesController.deleteCertificate);

export const energyProfileRouter = Router();
energyProfileRouter.get("/", vehiclesController.getEnergyProfile);
energyProfileRouter.post("/", vehiclesController.saveEnergyProfile);
energyProfileRouter.get("/energy-profile", vehiclesController.getEnergyProfile);
energyProfileRouter.post("/energy-profile", vehiclesController.saveEnergyProfile);

export default router;
