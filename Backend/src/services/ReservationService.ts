import { prisma } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { reserveNow, cancelReservation } from "../ocpp/remoteControl.js";

export interface CreateReservationDto {
  chargerId: number;
  connectorId: number;
  idTag: string;
  parentIdTag?: string;
  expiryDate: Date;
  userId?: number;
}

export class ReservationService {
  /**
   * Create an EVSE connector reservation
   */
  public static async createReservation(data: CreateReservationDto) {
    const { chargerId, connectorId, idTag, parentIdTag, expiryDate, userId } = data;

    // Check charger existence
    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
      include: {
        evses: {
          include: { connectors: true },
        },
      },
    });

    if (!charger) {
      throw new Error(`Charger ${chargerId} not found`);
    }

    // Check if connector is already reserved or occupied
    const existingActive = await prisma.reservation.findFirst({
      where: {
        chargerId,
        connectorId,
        status: "Active",
        expiryDate: { gt: new Date() },
      },
    });

    if (existingActive) {
      throw new Error(`Connector ${connectorId} on charger ${chargerId} is already reserved until ${existingActive.expiryDate.toISOString()}`);
    }

    // Lookup RFID user if exists
    const rfidUser = await prisma.rfidUser.findUnique({
      where: { rfid_tag: idTag },
    });

    // Generate unique reservation ID (positive integer)
    const reservationId = Math.floor(100000 + Math.random() * 900000);

    logger.info(
      `Sending ReserveNow to charger ${chargerId}, connector ${connectorId}, idTag: ${idTag}, reservationId: ${reservationId}`
    );

    // Call hardware RPC
    const rpcResult = await reserveNow(
      chargerId,
      connectorId,
      expiryDate.toISOString(),
      idTag,
      reservationId,
      parentIdTag
    );

    if (rpcResult.status !== "Accepted") {
      throw new Error(`Charger rejected reservation with status: ${rpcResult.status}${rpcResult.error ? ` (${rpcResult.error})` : ""}`);
    }

    // Create DB reservation record
    const reservation = await prisma.reservation.create({
      data: {
        reservationId,
        chargerId,
        connectorId,
        idTag,
        parentIdTag: parentIdTag || null,
        expiryDate,
        status: "Active",
        userId: userId || rfidUser?.owner_id || null,
        rfidUserId: rfidUser?.rfid_user_id || null,
      },
      include: {
        charger: { select: { charger_id: true, name: true, model: true } },
        user: { select: { id: true, name: true, email: true } },
        rfidUser: { select: { rfid_user_id: true, name: true, rfid_tag: true } },
      },
    });

    // Update connector status to Reserved in DB
    const connectorName = `Channel ${connectorId}`;
    const conn = await prisma.connector.findFirst({
      where: {
        evse: { charger_id: chargerId },
        connector_name: connectorName,
      },
    });

    if (conn) {
      await prisma.connector.update({
        where: { connector_id: conn.connector_id },
        data: { status: "Reserved", updatedAt: new Date() },
      });
    }

    logger.info(`Reservation ${reservationId} created successfully for charger ${chargerId}`);
    return reservation;
  }

  /**
   * Cancel an active reservation
   */
  public static async cancelReservation(reservationId: number) {
    const reservation = await prisma.reservation.findUnique({
      where: { reservationId },
    });

    if (!reservation) {
      throw new Error(`Reservation ${reservationId} not found`);
    }

    if (reservation.status !== "Active") {
      return { success: true, message: `Reservation is already ${reservation.status}` };
    }

    logger.info(`Sending CancelReservation for reservation ${reservationId} on charger ${reservation.chargerId}`);

    // Call hardware RPC
    const rpcResult = await cancelReservation(reservation.chargerId, reservationId);

    // Update status in DB
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "Cancelled" },
    });

    // Release connector status back to Available if it was Reserved
    const connectorName = `Channel ${reservation.connectorId}`;
    const conn = await prisma.connector.findFirst({
      where: {
        evse: { charger_id: reservation.chargerId },
        connector_name: connectorName,
      },
    });

    if (conn && conn.status === "Reserved") {
      await prisma.connector.update({
        where: { connector_id: conn.connector_id },
        data: { status: "Available", updatedAt: new Date() },
      });
    }

    return { success: true, data: updated, rpcStatus: rpcResult.status };
  }

  /**
   * Consume an active reservation upon transaction start
   */
  public static async consumeReservation(chargerId: number, connectorId: number, idTag?: string) {
    try {
      const activeReservation = await prisma.reservation.findFirst({
        where: {
          chargerId,
          connectorId,
          status: "Active",
          expiryDate: { gt: new Date() },
          ...(idTag && {
            OR: [
              { idTag },
              { parentIdTag: idTag },
            ],
          }),
        },
      });

      if (activeReservation) {
        await prisma.reservation.update({
          where: { id: activeReservation.id },
          data: { status: "Consumed" },
        });
        logger.info(`Reservation ${activeReservation.reservationId} marked as Consumed by transaction start`);
        return activeReservation;
      }
    } catch (error) {
      logger.error(`Error consuming reservation on charger ${chargerId}: ${error}`);
    }
    return null;
  }

  /**
   * Background sweep to expire overdue reservations
   */
  public static async expireOverdueReservations(): Promise<number> {
    try {
      const overdue = await prisma.reservation.findMany({
        where: {
          status: "Active",
          expiryDate: { lte: new Date() },
        },
      });

      if (overdue.length === 0) return 0;

      for (const res of overdue) {
        await prisma.reservation.update({
          where: { id: res.id },
          data: { status: "Expired" },
        });

        // Release connector back to Available if still Reserved
        const connectorName = `Channel ${res.connectorId}`;
        const conn = await prisma.connector.findFirst({
          where: {
            evse: { charger_id: res.chargerId },
            connector_name: connectorName,
          },
        });

        if (conn && conn.status === "Reserved") {
          await prisma.connector.update({
            where: { connector_id: conn.connector_id },
            data: { status: "Available", updatedAt: new Date() },
          });
        }
      }

      logger.info(`Expired ${overdue.length} overdue reservations`);
      return overdue.length;
    } catch (error) {
      logger.error(`Error expiring overdue reservations: ${error}`);
      return 0;
    }
  }

  /**
   * List reservations with filtering and pagination
   */
  public static async getReservations(filter: {
    chargerId?: number;
    status?: string;
    userId?: number;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, filter.limit || 50);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.chargerId) where.chargerId = filter.chargerId;
    if (filter.status && filter.status !== "all") where.status = filter.status;
    if (filter.userId) where.userId = filter.userId;
    if (filter.search) {
      where.OR = [
        { idTag: { contains: filter.search, mode: "insensitive" } },
        { charger: { name: { contains: filter.search, mode: "insensitive" } } },
      ];
    }

    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          charger: { select: { charger_id: true, name: true, model: true } },
          user: { select: { id: true, name: true, email: true } },
          rfidUser: { select: { rfid_user_id: true, name: true, rfid_tag: true } },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    return {
      reservations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
