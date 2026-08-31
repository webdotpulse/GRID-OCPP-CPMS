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

    // Only superadmin can create superadmin accounts
    if (targetRole === "superadmin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin access required to create superadmin accounts" });
    }

    // Only superadmin can create admin accounts
    if (targetRole === "admin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin access required to create admin accounts" });
    }

    const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) {
      return res.status(400).json({ success: false, error: "Email already exists" });
    }

    // Free up any legacy soft-deleted user record occupying this email
    const legacyDeleted = await prisma.user.findFirst({ where: { email, deletedAt: { not: null } } });
    if (legacyDeleted) {
      await prisma.user.update({
        where: { id: legacyDeleted.id },
        data: { email: `deleted_${legacyDeleted.id}_${Date.now()}_${legacyDeleted.email}` },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Multi-tenant scoping for companyId assignment
    let parsedCompanyId = companyId ? parseInt(companyId, 10) : null;
    if (req.userRole !== "superadmin" && req.userId) {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
      parsedCompanyId = currentUser?.companyId || null;
    }

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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Permission and tenant boundary checks
    if (req.userRole !== "superadmin") {
      if (targetUser.role === "superadmin" && req.userId !== userId) {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot modify superadmin accounts" });
      }

      if (req.userId !== userId) {
        if (req.userRole !== "admin" && req.userRole !== "client_admin") {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }
        const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!currentUser?.companyId || currentUser.companyId !== targetUser.companyId) {
          return res.status(403).json({ success: false, error: "Access denied: User is not within your organization" });
        }
      }
    }

    // Non-superadmins cannot assign superadmin or admin roles
    if (updateData.role && updateData.role !== targetUser.role) {
      if (req.userRole !== "superadmin") {
        if (updateData.role === "superadmin" || updateData.role === "admin" || req.userId === userId) {
          delete updateData.role;
        }
      }
    }

    if (updateData.role && !VALID_ROLES.includes(updateData.role)) {
      return res.status(400).json({
        success: false,
        error: `Valid role is required (${VALID_ROLES.join(", ")})`,
      });
    }

    if (updateData.email) {
      const existingActive = await prisma.user.findFirst({
        where: { email: updateData.email, id: { not: userId }, deletedAt: null },
      });
      if (existingActive) {
        return res.status(400).json({ success: false, error: "Email already in use" });
      }

      const legacyDeleted = await prisma.user.findFirst({
        where: { email: updateData.email, id: { not: userId }, deletedAt: { not: null } },
      });
      if (legacyDeleted) {
        await prisma.user.update({
          where: { id: legacyDeleted.id },
          data: { email: `deleted_${legacyDeleted.id}_${Date.now()}_${legacyDeleted.email}` },
        });
      }
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
        ...(updateData.companyId !== undefined && req.userRole === "superadmin" ? { companyId: parsedCompanyId } : {}),
        ...(updateData.address !== undefined ? { address: updateData.address } : {}),
        ...(updateData.phone !== undefined ? { phone: updateData.phone } : {}),
        ...(updateData.taxNumber !== undefined ? { taxNumber: updateData.taxNumber } : {}),
        ...(updateData.language ? { language: updateData.language } : {}),
        ...("emailVerified" in updateData && req.userRole === "superadmin" ? { emailVerified: updateData.emailVerified } : {}),
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Role elevation checks
    if (role === "superadmin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Superadmin access required to promote to superadmin" });
    }

    if (targetUser.role === "superadmin" && req.userRole !== "superadmin") {
      return res.status(403).json({ success: false, error: "Forbidden: Cannot alter superadmin user roles" });
    }

    if (req.userRole !== "superadmin") {
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!currentUser?.companyId || currentUser.companyId !== targetUser.companyId) {
        return res.status(403).json({ success: false, error: "Access denied: User not in your organization" });
      }
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) return res.status(404).json({ success: false, error: "User not found" });

    if (req.userRole !== "superadmin") {
      if (targetUser.role === "superadmin") {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot reset superadmin password" });
      }
      const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!currentUser?.companyId || currentUser.companyId !== targetUser.companyId) {
        return res.status(403).json({ success: false, error: "Access denied: User not in your organization" });
      }
    }

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

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (targetUser.role === "superadmin" && targetUser.id === 1) {
      return res.status(400).json({ success: false, error: "Cannot delete primary root superadmin" });
    }

    if (req.userRole !== "superadmin") {
      if (targetUser.role === "superadmin") {
        return res.status(403).json({ success: false, error: "Forbidden: Cannot delete superadmin account" });
      }
      if (req.userId !== id) {
        const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!currentUser?.companyId || currentUser.companyId !== targetUser.companyId) {
          return res.status(403).json({ success: false, error: "Access denied: User not in your organization" });
        }
      }
    }

    const isHardDelete = req.query.hard === "true";

    if (isHardDelete) {
      if (req.userRole !== "superadmin") {
        return res.status(403).json({ success: false, error: "Superadmin access required for hard deletion" });
      }
      await prisma.user.delete({ where: { id } });
      res.json({ success: true, message: "Hard deleted" });
    } else {
      const anonymizedEmail = `deleted_${targetUser.id}_${Date.now()}_${targetUser.email}`;
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          email: anonymizedEmail,
        },
      });
      res.json({ success: true, message: "Soft deleted" });
    }
  } catch (error: any) {
    logger.error(`Error deleting user: ${error.message}`);
    res.status(500).json({ success: false, error: "Failed to delete user" });
  }
};

