import { Response } from "express";
import { prisma } from "../../config/database.js";
import { logger } from "../../utils/logger.js";
import { parsePagination, parseId } from "../../utils/validation.js";
import { AuthRequest } from "../../middleware/auth.js";
import { sendEmail } from "../../utils/mailer.js";
import bcrypt from "bcrypt";
import { sanitizeUsers, sanitizeUser } from "../../utils/user.dto.js";

const VALID_ROLES = ["superadmin", "admin", "operator", "client_admin", "user"];

/**
 * GET /api/users - Get all users with filters and company details
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      page: queryPage,
      limit: queryLimit,
      search,
      role,
      companyId,
      userType,
    } = req.query;
    const { page, limit } = parsePagination(queryPage as string, queryLimit as string);

    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = {
      deletedAt: null, // Exclude soft-deleted users
    };

    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: "insensitive" } },
        { name: { contains: search as string, mode: "insensitive" } },
        { companyName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (role && role !== "all" && VALID_ROLES.includes(role as string)) {
      where.role = role as string;
    }

    if (companyId && companyId !== "all") {
      const parsedCompanyId = parseInt(companyId as string, 10);
      if (!isNaN(parsedCompanyId)) {
        where.companyId = parsedCompanyId;
      }
    }

    if (userType && userType !== "all") {
      where.userType = userType as string;
    }

    // Role-based tenant scoping
    if (req.userRole === "client_admin" || (req.userRole !== "superadmin" && req.userRole !== "admin")) {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
      if (currentUser?.companyId) {
        where.companyId = currentUser.companyId;
      } else {
        where.id = req.userId;
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          userType: true,
          companyName: true,
          companyId: true,
          company: {
            select: {
              id: true,
              name: true,
              clientNumber: true,
              status: true,
            },
          },
          address: true,
          phone: true,
          taxNumber: true,
          language: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          _count: {
            select: {
              rfidUsers: true,
              chargingStations: true,
              reimbursementContracts: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((u) => ({
      ...u,
      company_name: u.company?.name || u.companyName || null,
      rfidCardsCount: u._count?.rfidUsers || 0,
      stationsCount: u._count?.chargingStations || 0,
    }));

    res.json({
      success: true,
      data: sanitizeUsers(formattedUsers),
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    logger.error(`Error getting users: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to get users",
    });
  }
};

/**
 * GET /api/users/:id - Get specific user details
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseId(req.params.id);

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    if (req.userId !== userId && req.userRole !== "superadmin" && req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userType: true,
        companyName: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
            clientNumber: true,
            status: true,
            contactName: true,
            contactEmail: true,
          },
        },
        address: true,
        phone: true,
        taxNumber: true,
        language: true,
        emailVerified: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        rfidUsers: {
          select: {
            rfid_user_id: true,
            rfid_tag: true,
            name: true,
            email: true,
            active: true,
            type: true,
            createdAt: true,
          },
        },
        vehicleEnergyProfile: {
          select: {
            id: true,
            batteryCapacity: true,
            minSocThreshold: true,
          },
        },
        chargingStations: {
          select: {
            id: true,
            station_name: true,
            city: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const formattedUser = {
      ...user,
      rfidUsers: user.rfidUsers?.map((rf: any) => ({
        ...rf,
        idTag: rf.rfid_tag,
        status: rf.active ? "Active" : "Blocked",
      })),
      vehicleEnergyProfile: user.vehicleEnergyProfile
        ? {
            ...user.vehicleEnergyProfile,
            batteryCapacityKwh: user.vehicleEnergyProfile.batteryCapacity,
            minDischargeSocPercent: user.vehicleEnergyProfile.minSocThreshold,
          }
        : null,
    };

    res.json({ success: true, data: sanitizeUser(formattedUser) });
  } catch (error: any) {
    logger.error(`Error getting user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to get user",
    });
  }
};

/**
 * POST /api/users - Create new user account
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role, userType, companyName, companyId, phone, address, language } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const targetRole = role || "user";
    if (!VALID_ROLES.includes(targetRole)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Allowed roles: ${VALID_ROLES.join(", ")}`,
      });
    }

    // Only superadmin can create superadmins or admins
    if ((targetRole === "superadmin" || targetRole === "admin") && req.userRole !== "superadmin" && req.userRole !== "admin") {
      return res.status(403).json({ success: false, error: "Insufficient permissions to assign this role" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const parsedCompanyId = companyId ? parseInt(companyId, 10) : null;

    let resolvedCompanyName = companyName || null;
    if (parsedCompanyId && !resolvedCompanyName) {
      const company = await prisma.company.findUnique({ where: { id: parsedCompanyId } });
      if (company) resolvedCompanyName = company.name;
    }

    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        role: targetRole,
        userType: userType || "private",
        companyName: resolvedCompanyName,
        companyId: parsedCompanyId,
        phone: phone || null,
        address: address || null,
        language: language || "en",
        emailVerified: true, // Created directly by an administrator
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userType: true,
        companyName: true,
        companyId: true,
        language: true,
        emailVerified: true,
      },
    });

    try {
      const loginUrl = process.env.FRONTEND_URL || "http://localhost:3002";
      await sendEmail(
        user.email,
        "Welcome to OCPP CPMS",
        `Welcome ${name || "User"}! Your account has been created by an administrator. You can log in at ${loginUrl} using your email and password.`,
        `<p>Welcome ${name || "User"}!</p><p>Your account has been created by an administrator with the role <strong>${targetRole}</strong>.</p><p>You can log in at <a href="${loginUrl}">${loginUrl}</a> using your email and the password provided.</p>`,
        "admin_welcome",
        user.language,
        {
          userEmail: user.email,
          name: name || "User",
          password,
          loginUrl,
        }
      );
    } catch (emailError) {
      logger.error(`Error sending welcome email to ${user.email}: ${emailError}`);
    }

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    logger.error(`Error creating user: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to create user" });
  }
};

/**
 * PUT /api/users/:id - Update user details
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseId(req.params.id);
    const updateData = { ...req.body };

    delete updateData.password;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    if (req.userId !== userId && req.userRole !== "superadmin" && req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    // Standard users cannot change role
    if (req.userRole !== "superadmin" && req.userRole !== "admin" && updateData.role) {
      delete updateData.role;
    }

    if (updateData.role && !VALID_ROLES.includes(updateData.role)) {
      return res.status(400).json({
        success: false,
        error: `Valid role is required (${VALID_ROLES.join(", ")})`,
      });
    }

    const parsedCompanyId = updateData.companyId ? parseInt(updateData.companyId, 10) : null;
    let resolvedCompanyName = updateData.companyName || null;
    if (parsedCompanyId && !resolvedCompanyName) {
      const company = await prisma.company.findUnique({ where: { id: parsedCompanyId } });
      if (company) resolvedCompanyName = company.name;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updateData.name !== undefined ? { name: updateData.name } : {}),
        ...(updateData.email ? { email: updateData.email } : {}),
        ...(updateData.role ? { role: updateData.role } : {}),
        ...(updateData.userType ? { userType: updateData.userType } : {}),
        ...(updateData.companyName !== undefined || resolvedCompanyName ? { companyName: resolvedCompanyName } : {}),
        ...(updateData.companyId !== undefined ? { companyId: parsedCompanyId } : {}),
        ...(updateData.address !== undefined ? { address: updateData.address } : {}),
        ...(updateData.phone !== undefined ? { phone: updateData.phone } : {}),
        ...(updateData.taxNumber !== undefined ? { taxNumber: updateData.taxNumber } : {}),
        ...(updateData.language ? { language: updateData.language } : {}),
        ...("emailVerified" in updateData ? { emailVerified: updateData.emailVerified } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userType: true,
        companyName: true,
        companyId: true,
        address: true,
        phone: true,
        taxNumber: true,
        language: true,
        emailVerified: true,
      },
    });

    res.json({ success: true, data: sanitizeUser(updatedUser) });
  } catch (error: any) {
    logger.error(`Error updating user: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
};

/**
 * PUT /api/users/:id/role - Update user role
 */
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseId(req.params.id);
    const { role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Valid role is required (${VALID_ROLES.join(", ")})`,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userType: true,
        companyName: true,
      },
    });

    res.json({ success: true, data: sanitizeUser(updatedUser) });
  } catch (error: any) {
    logger.error(`Error updating user role: ${error.message}`);
    res.status(500).json({
      success: false,
      error: "Failed to update user role",
    });
  }
};

/**
 * POST /api/users/:id/reset-password - Admin reset password for a user
 */
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseId(req.params.id);
    const { newPassword } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: "Invalid user ID" });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: "Password has been successfully updated" });
  } catch (error: any) {
    logger.error(`Error resetting user password: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to reset password" });
  }
};

/**
 * DELETE /api/users/:id - Delete user account
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: "Invalid ID" });

    if (req.userId !== id && req.userRole !== "superadmin" && req.userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.role === "superadmin" && user.id === 1) {
      return res.status(400).json({ success: false, error: "Cannot delete primary root superadmin" });
    }

    const isHardDelete = req.query.hard === "true";

    if (isHardDelete) {
      if (req.userRole !== "superadmin") {
        return res.status(403).json({ success: false, error: "Superadmin access required for hard deletion" });
      }
      await prisma.user.delete({ where: { id } });
      res.json({ success: true, message: "Hard deleted" });
    } else {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      res.json({ success: true, message: "Soft deleted" });
    }
  } catch (error: any) {
    logger.error(`Error deleting user: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
};
