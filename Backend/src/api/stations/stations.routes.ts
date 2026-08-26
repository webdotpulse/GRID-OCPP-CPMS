import { Router } from "express";
import {
  getAllStations,
  getStationById,
  getStationChargers,
  createStation,
  updateStation,
  deleteStation,
  getParkingSpots,
  updateParkingSpots,
  getStationTopology,
} from "./stations.controller.js";

const router = Router();

router.get("/", getAllStations);
router.get("/:id", getStationById);
router.get("/:id/chargers", getStationChargers);
router.get("/:id/topology", getStationTopology);
router.post("/", createStation);
router.put("/:id", updateStation);
router.delete("/:id", deleteStation);

// Parking Spot / Ground Plan routes
router.get("/:id/parking-spots", getParkingSpots);
router.put("/:id/parking-spots", updateParkingSpots);

export default router;
