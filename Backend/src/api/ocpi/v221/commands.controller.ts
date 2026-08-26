import { Request, Response } from "express";
import { prisma } from "../../../config/database.js";
import { logger } from "../../../utils/logger.js";
import { buildOcpiResponse, OcpiService } from "../../../services/OcpiService.js";
import {
  remoteStartTransaction,
  remoteStopTransaction,
  unlockConnector,
} from "../../../ocpp/remoteControl.js";

/**
 * OCPI 2.2.1 POST /commands/START_SESSION
 */
export const postStartSession = async (req: Request, res: Response) => {
  const { response_url, token, location_id, evse_uid, connector_id, authorization_reference } = req.body;

  try {
    if (!token || !token.uid || !location_id) {
      return res.status(400).json(buildOcpiResponse({ result: "REJECTED" }, 2001, "Missing required fields"));
    }

    // 1. Locate charging station and charger
    const station = await prisma.chargingStation.findUnique({
      where: { id: parseInt(location_id) || -1 },
      include: {
        chargers: {
          include: {
            evses: {
              include: {
                connectors: true,
              },
            },
          },
        },
      },
    });

    if (!station || station.chargers.length === 0) {
      return res.status(404).json(buildOcpiResponse({ result: "REJECTED" }, 2003, "Location or Charger not found"));
    }

    const charger = station.chargers[0];
    const targetConnectorId = connector_id ? parseInt(connector_id) : 1;

    // 2. Issue RemoteStartTransaction via distributed RPC
    const remoteResult = await remoteStartTransaction({
      chargerId: charger.charger_id,
      connectorId: targetConnectorId,
      idTag: token.uid,
    });

    const isAccepted = remoteResult.status === "Accepted";
    const resultStatus = isAccepted ? "ACCEPTED" : "REJECTED";

    // 3. If accepted, create RoamingSession
    if (isAccepted) {
      const defaultPartner = await prisma.roamingPartner.findFirst();
      if (defaultPartner) {
        const generatedTxId = `TX-ROAM-${Date.now()}-${charger.charger_id}`;
        await prisma.roamingSession.create({
          data: {
            partnerId: defaultPartner.id,
            stationId: station.id,
            transactionId: generatedTxId,
            status: "active",
          },
        }).catch((err) => logger.error(`Error creating roaming session: ${err}`));
      }
    }

    // 4. Asynchronous callback if response_url is provided
    if (response_url) {
      setTimeout(() => {
        OcpiService.sendCommandCallback(response_url, { result: resultStatus });
      }, 200);
    }

    return res.status(200).json(
      buildOcpiResponse(
        {
          result: resultStatus,
          timeout: 30,
        },
        1000,
        isAccepted ? "Session start initiated" : "Session start failed"
      )
    );
  } catch (error) {
    logger.error("Error handling OCPI START_SESSION:", error);
    return res.status(500).json(buildOcpiResponse({ result: "REJECTED" }, 3000, "Internal error"));
  }
};

/**
 * OCPI 2.2.1 POST /commands/STOP_SESSION
 */
export const postStopSession = async (req: Request, res: Response) => {
  const { response_url, session_id } = req.body;

  try {
    if (!session_id) {
      return res.status(400).json(buildOcpiResponse({ result: "REJECTED" }, 2001, "Missing session_id"));
    }

    // 1. Locate transaction / roaming session
    const tx = await prisma.transaction.findFirst({
      where: {
        OR: [
          { transactionId: session_id },
          { id: parseInt(session_id) || -1 },
        ],
        status: { in: ["initiated", "charging"] },
      },
      include: { charger: true },
    });

    if (!tx) {
      return res.status(404).json(buildOcpiResponse({ result: "REJECTED" }, 2003, "Active session not found"));
    }

    // 2. Issue RemoteStopTransaction
    const stopResult = await remoteStopTransaction({
      chargerId: tx.charger_id,
      transactionId: tx.transactionId,
    });

    const isAccepted = stopResult.status === "Accepted";
    const resultStatus = isAccepted ? "ACCEPTED" : "REJECTED";

    if (response_url) {
      setTimeout(() => {
        OcpiService.sendCommandCallback(response_url, { result: resultStatus });
      }, 200);
    }

    return res.status(200).json(
      buildOcpiResponse(
        {
          result: resultStatus,
          timeout: 30,
        },
        1000,
        isAccepted ? "Session stop initiated" : "Session stop rejected"
      )
    );
  } catch (error) {
    logger.error("Error handling OCPI STOP_SESSION:", error);
    return res.status(500).json(buildOcpiResponse({ result: "REJECTED" }, 3000, "Internal error"));
  }
};

/**
 * OCPI 2.2.1 POST /commands/UNLOCK_CONNECTOR
 */
export const postUnlockConnector = async (req: Request, res: Response) => {
  const { response_url, location_id, connector_id } = req.body;

  try {
    if (!location_id) {
      return res.status(400).json(buildOcpiResponse({ result: "REJECTED" }, 2001, "Missing location_id"));
    }

    const station = await prisma.chargingStation.findUnique({
      where: { id: parseInt(location_id) || -1 },
      include: { chargers: true },
    });

    if (!station || station.chargers.length === 0) {
      return res.status(404).json(buildOcpiResponse({ result: "REJECTED" }, 2003, "Location not found"));
    }

    const charger = station.chargers[0];
    const targetConnector = connector_id ? parseInt(connector_id) : 1;

    const unlockResult = await unlockConnector(
      charger.charger_id,
      targetConnector
    );

    const isAccepted = unlockResult.status === "Accepted";
    const resultStatus = isAccepted ? "ACCEPTED" : "REJECTED";

    if (response_url) {
      setTimeout(() => {
        OcpiService.sendCommandCallback(response_url, { result: resultStatus });
      }, 200);
    }

    return res.status(200).json(
      buildOcpiResponse(
        {
          result: resultStatus,
        },
        1000,
        isAccepted ? "Connector unlocked" : "Unlock rejected"
      )
    );
  } catch (error) {
    logger.error("Error handling OCPI UNLOCK_CONNECTOR:", error);
    return res.status(500).json(buildOcpiResponse({ result: "REJECTED" }, 3000, "Internal error"));
  }
};
