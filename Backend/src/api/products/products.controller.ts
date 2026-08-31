import { Response } from "express";
import { prisma } from "../../config/database.js";
import { AuthRequest } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { parseId } from "../../utils/validation.js";

/**
 * GET /api/products - List all subscription products with optional category and active filtering
 */
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { category, isActive, search } = req.query;

    const where: any = {};

    if (category && category !== "all") {
      where.category = String(category);
    }
    if (isActive !== undefined && isActive !== "all") {
      where.isActive = String(isActive) === "true";
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const products = await prisma.subscriptionProduct.findMany({
      where,
      include: {
        _count: {
          select: { chargers: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error: any) {
    logger.error("Error fetching subscription products:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch products" });
  }
};

/**
 * GET /api/products/:id - Retrieve single subscription product details with attached chargers
 */
export const getProductById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const product = await prisma.subscriptionProduct.findUnique({
      where: { id },
      include: {
        chargers: {
          select: {
            charger_id: true,
            name: true,
            model: true,
            status: true,
            isPublic: true,
            chargingStation: {
              select: { id: true, station_name: true, city: true },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: "Subscription product not found" });
    }

    res.json({ success: true, data: product });
  } catch (error: any) {
    logger.error(`Error fetching product #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch product" });
  }
};

/**
 * POST /api/products - Create a new subscription product (Admin only)
 */
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      category = "public",
      price,
      currency = "EUR",
      paymentFrequency = "monthly",
      vatRate = 21.0,
      isActive = true,
    } = req.body;

    if (!name || price === undefined || isNaN(Number(price))) {
      return res.status(400).json({ success: false, error: "Product name and price (excl. VAT) are required" });
    }

    const validCategories = ["private", "business", "public"];
    const productCategory = validCategories.includes(category) ? category : "public";

    const validFrequencies = ["monthly", "quarterly", "yearly"];
    const productFrequency = validFrequencies.includes(paymentFrequency) ? paymentFrequency : "monthly";

    const newProduct = await prisma.subscriptionProduct.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        category: productCategory,
        price: Number(price),
        currency: String(currency).toUpperCase(),
        paymentFrequency: productFrequency,
        vatRate: Number(vatRate) || 21.0,
        isActive: Boolean(isActive),
      },
    });

    logger.info(`Subscription product created: ${newProduct.name} (€${newProduct.price} excl. VAT / ${newProduct.paymentFrequency})`);

    res.status(201).json({
      success: true,
      message: `Subscription product "${newProduct.name}" created successfully`,
      data: newProduct,
    });
  } catch (error: any) {
    logger.error("Error creating subscription product:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create product" });
  }
};

/**
 * PUT /api/products/:id - Update an existing subscription product (Admin only)
 */
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const {
      name,
      description,
      category,
      price,
      currency,
      paymentFrequency,
      vatRate,
      isActive,
    } = req.body;

    const existing = await prisma.subscriptionProduct.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Subscription product not found" });
    }

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (category !== undefined) data.category = String(category);
    if (price !== undefined) data.price = Number(price);
    if (currency !== undefined) data.currency = String(currency).toUpperCase();
    if (paymentFrequency !== undefined) data.paymentFrequency = String(paymentFrequency);
    if (vatRate !== undefined) data.vatRate = Number(vatRate);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.subscriptionProduct.update({
      where: { id },
      data,
    });

    logger.info(`Subscription product #${id} (${updated.name}) updated`);

    res.json({
      success: true,
      message: `Subscription product "${updated.name}" updated successfully`,
      data: updated,
    });
  } catch (error: any) {
    logger.error(`Error updating product #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to update product" });
  }
};

/**
 * DELETE /api/products/:id - Delete or deactivate a subscription product (Admin only)
 */
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const existing = await prisma.subscriptionProduct.findUnique({
      where: { id },
      include: {
        _count: { select: { chargers: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Subscription product not found" });
    }

    // Detach product from chargers first
    if (existing._count.chargers > 0) {
      await prisma.charger.updateMany({
        where: { productId: id },
        data: { productId: null },
      });
    }

    await prisma.subscriptionProduct.delete({
      where: { id },
    });

    logger.info(`Subscription product #${id} (${existing.name}) deleted`);

    res.json({
      success: true,
      message: `Subscription product "${existing.name}" deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Error deleting product #${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete product" });
  }
};

/**
 * PATCH /api/products/chargers/:chargerId/attach - Attach or detach a product to a charger
 */
export const attachChargerProduct = async (req: AuthRequest, res: Response) => {
  try {
    const chargerId = parseId(req.params.chargerId);
    const { productId } = req.body; // number or null to detach

    if (!chargerId) {
      return res.status(400).json({ success: false, error: "Invalid charger ID" });
    }

    const charger = await prisma.charger.findUnique({
      where: { charger_id: chargerId },
    });

    if (!charger) {
      return res.status(404).json({ success: false, error: "Charger not found" });
    }

    if (productId !== null && productId !== undefined && productId !== "") {
      const product = await prisma.subscriptionProduct.findUnique({
        where: { id: Number(productId) },
      });
      if (!product) {
        return res.status(404).json({ success: false, error: "Product not found" });
      }
    }

    const updatedCharger = await prisma.charger.update({
      where: { charger_id: chargerId },
      data: {
        productId: productId ? Number(productId) : null,
      },
      include: {
        product: true,
      },
    });

    logger.info(`Charger #${chargerId} product assignment updated: ${updatedCharger.product?.name || "None"}`);

    res.json({
      success: true,
      message: updatedCharger.product
        ? `Product "${updatedCharger.product.name}" attached to charger`
        : "Product detached from charger",
      data: updatedCharger,
    });
  } catch (error: any) {
    logger.error(`Error attaching product to charger #${req.params.chargerId}:`, error);
    res.status(500).json({ success: false, error: error.message || "Failed to attach product" });
  }
};
