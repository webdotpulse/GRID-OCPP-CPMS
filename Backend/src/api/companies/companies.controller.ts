import { Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { AuthRequest } from "../../middleware/auth.js";
import { parsePagination, parseId } from "../../utils/validation.js";

/**
 * GET /api/companies - Get all companies / clients with metrics
 */
export const getAllCompanies = async (req: AuthRequest, res: Response) => {
  try {
    const { page: queryPage, limit: queryLimit, search, status } = req.query;
    const { page, limit } = parsePagination(queryPage as string, queryLimit as string);

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { clientNumber: { contains: search as string, mode: "insensitive" } },
        { contactName: { contains: search as string, mode: "insensitive" } },
        { contactEmail: { contains: search as string, mode: "insensitive" } },
        { city: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") {
      where.status = status as string;
    }

    // Role-based filtering: non-superadmin client_admin can only view own company
    if (req.userRole === "client_admin" || (req.userRole !== "superadmin" && req.userRole !== "admin")) {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.companyId) {
        where.id = user.companyId;
      }
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        skip,
        take,
        where,
        include: {
          _count: {
            select: {
              users: true,
              chargingStations: true,
              invoices: true,
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
            take: 5,
          },
          chargingStations: {
            select: {
              id: true,
              station_name: true,
              city: true,
              status: true,
              chargers: {
                select: {
                  charger_id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.company.count({ where }),
    ]);

    const formattedCompanies = companies.map((c) => {
      let totalChargersCount = 0;
      let activeChargersCount = 0;

      for (const st of c.chargingStations || []) {
        totalChargersCount += st.chargers?.length || 0;
        activeChargersCount += st.chargers?.filter((ch) => ch.status !== "offline" && ch.status !== "faulted").length || 0;
      }

      return {
        id: c.id,
        name: c.name,
        clientNumber: c.clientNumber || `CLI-${c.id.toString().padStart(4, "0")}`,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        address: c.address,
        city: c.city,
        postalCode: c.postalCode,
        country: c.country,
        taxNumber: c.taxNumber,
        kvkNumber: c.kvkNumber,
        billingEmail: c.billingEmail,
        status: c.status || "active",
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        usersCount: c._count.users,
        stationsCount: c._count.chargingStations,
        invoicesCount: c._count.invoices,
        chargersCount: totalChargersCount,
        activeChargersCount,
        recentUsers: c.users,
      };
    });

    res.json({
      success: true,
      data: formattedCompanies,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error(`Error getting companies: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to get companies",
    });
  }
};

/**
 * GET /api/companies/:id - Get specific company / client detail
 */
export const getCompanyById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid client ID" });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            userType: true,
            phone: true,
            emailVerified: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        chargingStations: {
          include: {
            chargers: {
              select: {
                charger_id: true,
                name: true,
                model: true,
                status: true,
                power_capacity: true,
              },
            },
          },
        },
        invoices: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            issueDate: true,
            dueDate: true,
          },
        },
        mollieConfig: {
          select: {
            id: true,
            profileId: true,
            testMode: true,
          },
        },
        _count: {
          select: {
            users: true,
            chargingStations: true,
            invoices: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    let totalChargersCount = 0;
    let totalPowerCapacityKw = 0;

    for (const station of company.chargingStations) {
      for (const charger of station.chargers) {
        totalChargersCount += 1;
        totalPowerCapacityKw += charger.power_capacity || 0;
      }
    }

    res.json({
      success: true,
      data: {
        ...company,
        clientNumber: company.clientNumber || `CLI-${company.id.toString().padStart(4, "0")}`,
        metrics: {
          totalUsers: company._count.users,
          totalStations: company._count.chargingStations,
          totalChargers: totalChargersCount,
          totalPowerCapacityKw,
          totalInvoices: company._count.invoices,
        },
      },
    });
  } catch (error: any) {
    logger.error(`Error getting company: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to get company details" });
  }
};

/**
 * POST /api/companies - Create new corporate client / company
 */
export const createCompany = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      clientNumber,
      contactName,
      contactEmail,
      contactPhone,
      address,
      city,
      postalCode,
      country,
      taxNumber,
      kvkNumber,
      billingEmail,
      status,
      notes,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Client company name is required" });
    }

    const trimmedName = name.trim();
    const existing = await prisma.company.findUnique({ where: { name: trimmedName } });
    if (existing) {
      return res.status(400).json({ success: false, error: "A client with this name already exists" });
    }

    const generatedClientNumber =
      clientNumber?.trim() ||
      `CLI-${Math.floor(1000 + Math.random() * 9000)}`;

    const newCompany = await prisma.company.create({
      data: {
        name: trimmedName,
        clientNumber: generatedClientNumber,
        contactName: contactName?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        postalCode: postalCode?.trim() || null,
        country: country?.trim() || "Netherlands",
        taxNumber: taxNumber?.trim() || null,
        kvkNumber: kvkNumber?.trim() || null,
        billingEmail: billingEmail?.trim() || null,
        status: status || "active",
        notes: notes?.trim() || null,
      },
    });

    res.status(201).json({ success: true, data: newCompany });
  } catch (error: any) {
    logger.error(`Error creating company: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to create client account" });
  }
};

/**
 * PUT /api/companies/:id - Update corporate client details
 */
export const updateCompany = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid client ID" });

    const {
      name,
      clientNumber,
      contactName,
      contactEmail,
      contactPhone,
      address,
      city,
      postalCode,
      country,
      taxNumber,
      kvkNumber,
      billingEmail,
      status,
      notes,
    } = req.body;

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(clientNumber !== undefined ? { clientNumber: clientNumber?.trim() || null } : {}),
        ...(contactName !== undefined ? { contactName: contactName?.trim() || null } : {}),
        ...(contactEmail !== undefined ? { contactEmail: contactEmail?.trim() || null } : {}),
        ...(contactPhone !== undefined ? { contactPhone: contactPhone?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(city !== undefined ? { city: city?.trim() || null } : {}),
        ...(postalCode !== undefined ? { postalCode: postalCode?.trim() || null } : {}),
        ...(country !== undefined ? { country: country?.trim() || "Netherlands" } : {}),
        ...(taxNumber !== undefined ? { taxNumber: taxNumber?.trim() || null } : {}),
        ...(kvkNumber !== undefined ? { kvkNumber: kvkNumber?.trim() || null } : {}),
        ...(billingEmail !== undefined ? { billingEmail: billingEmail?.trim() || null } : {}),
        ...(status ? { status } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error(`Error updating company: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to update client account" });
  }
};

/**
 * DELETE /api/companies/:id - Delete corporate client
 */
export const deleteCompany = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid client ID" });

    // Verify relations before deleting
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, chargingStations: true, invoices: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    if (company._count.users > 0 || company._count.chargingStations > 0) {
      // Soft-archive by changing status to 'inactive' if active records exist
      await prisma.company.update({
        where: { id },
        data: { status: "inactive" },
      });
      return res.json({
        success: true,
        message: "Client account marked as inactive due to linked users/stations",
      });
    }

    await prisma.company.delete({ where: { id } });
    res.json({ success: true, message: "Client deleted successfully" });
  } catch (error: any) {
    logger.error(`Error deleting company: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to delete client" });
  }
};
