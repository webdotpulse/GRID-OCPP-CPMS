import { Router } from "express";
import * as vehiclesController from "./vehicles.controller.js";

const router = Router();

router.get("/energy-profile", vehiclesController.getEnergyProfile);
router.post("/energy-profile", vehiclesController.saveEnergyProfile);

router.get("/", vehiclesController.getAll);
router.post("/", vehiclesController.create);
router.put("/:id", vehiclesController.update);
router.delete("/:id", vehiclesController.remove);

export const energyProfileRouter = Router();
energyProfileRouter.get("/", vehiclesController.getEnergyProfile);
energyProfileRouter.post("/", vehiclesController.saveEnergyProfile);
energyProfileRouter.get("/energy-profile", vehiclesController.getEnergyProfile);
energyProfileRouter.post("/energy-profile", vehiclesController.saveEnergyProfile);

export default router;
