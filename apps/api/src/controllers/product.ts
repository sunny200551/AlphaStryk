import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';
import { uploadImageBuffer } from '../services/cloudinary';

// Write helper for audit logging
const logAuditEvent = async (
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: any = null,
  newValues: any = null,
  req: Request
) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

// ==========================================
// 1. CATEGORY CONTROLLERS
// ==========================================

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
      },
    });

    return res.status(200).json({ success: true, data: categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, parentId } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: 'Name and slug are required.' });
    }

    const existingCategory = await prisma.category.findUnique({ where: { slug } });
    if (existingCategory) {
      return res.status(400).json({ success: false, message: 'Category slug already exists.' });
    }

    const category = await prisma.category.create({
      data: { name, slug, description, parentId },
    });

    await logAuditEvent(req.user?.id || null, 'CATEGORY_CREATE', 'Category', category.id, null, category, req);

    return res.status(201).json({ success: true, data: category });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// ==========================================
// 2. PRODUCT CATALOG CONTROLLERS
// ==========================================

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, categoryId, sortBy, page = 1, limit = 9, color, size } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build Prisma query clauses
    const whereClause: any = {
      status: 'ACTIVE',
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      // Fetch subcategories recursively to include nested product matches
      const subcategories = await prisma.category.findMany({
        where: { parentId: categoryId as string },
        select: { id: true },
      });
      const categoryIds = [categoryId as string, ...subcategories.map((c) => c.id)];
      whereClause.categoryId = { in: categoryIds };
    }

    // Filter by variant attributes (color, size)
    if (color || size) {
      whereClause.variants = {
        some: {
          isActive: true,
          AND: [],
        },
      };

      if (color) {
        whereClause.variants.some.AND.push({
          attributes: {
            path: ['color'],
            equals: color as string,
          },
        });
      }

      if (size) {
        whereClause.variants.some.AND.push({
          attributes: {
            path: ['size'],
            equals: size as string,
          },
        });
      }
    }

    // Sorting options
    let orderByClause: any = { createdAt: 'desc' };
    if (sortBy === 'price_asc') {
      orderByClause = { basePrice: 'asc' };
    } else if (sortBy === 'price_desc') {
      orderByClause = { basePrice: 'desc' };
    } else if (sortBy === 'newest') {
      orderByClause = { createdAt: 'desc' };
    }

    const [products, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: { select: { name: true, slug: true } },
          variants: { where: { isActive: true } },
        },
        orderBy: orderByClause,
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
          currentPage: pageNum,
          limit: limitNum,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: { where: { isActive: true } },
      },
    });

    if (!product || product.status === 'ARCHIVED') {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Recommended Products: other products in the same category
    const recommended = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        status: 'ACTIVE',
      },
      include: {
        variants: { where: { isActive: true } },
      },
      take: 4,
    });

    return res.status(200).json({
      success: true,
      data: {
        product,
        recommended,
      },
    });
  } catch (error: any) {
    console.error('Error fetching product detail:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// ==========================================
// 3. ADMINISTRATIVE CRUD CONTROLLERS
// ==========================================

export const getAdminProducts = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      include: {
        category: { select: { name: true } },
        variants: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    console.error('Admin fetching products error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, slug, description, basePrice, categoryId, status, images, metaTitle, metaDesc, variants } = req.body;

    if (!name || !slug || !basePrice || !categoryId) {
      return res.status(400).json({ success: false, message: 'Missing required product field entries.' });
    }

    const existingProduct = await prisma.product.findUnique({ where: { slug } });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: 'Product slug already exists.' });
    }

    // Save product transactionally with variants
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name,
          slug,
          description,
          basePrice,
          categoryId,
          status: status || 'DRAFT',
          images: images || [],
          metaTitle,
          metaDesc,
        },
      });

      if (variants && variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v: any) => ({
            productId: p.id,
            name: v.name,
            sku: v.sku,
            priceOffset: v.priceOffset || 0.0,
            stock: v.stock || 0,
            attributes: v.attributes || {},
            model3dUrl: v.model3dUrl || null,
          })),
        });
      }

      return p;
    });

    const populatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { variants: true },
    });

    await logAuditEvent(req.user?.id || null, 'PRODUCT_CREATE', 'Product', product.id, null, populatedProduct, req);

    return res.status(201).json({ success: true, data: populatedProduct });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, basePrice, categoryId, status, images, metaTitle, metaDesc, variants } = req.body;

    const oldProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!oldProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          basePrice,
          categoryId,
          status,
          images,
          metaTitle,
          metaDesc,
        },
      });

      if (variants) {
        // Simple variant sync: delete old active variants not provided, upsert modified ones
        // In local development, we clear and recreate variants for ease of sync
        await tx.productVariant.deleteMany({ where: { productId: id } });
        
        await tx.productVariant.createMany({
          data: variants.map((v: any) => ({
            productId: id,
            name: v.name,
            sku: v.sku,
            priceOffset: v.priceOffset || 0.00,
            stock: v.stock || 0,
            attributes: v.attributes || {},
            model3dUrl: v.model3dUrl || null,
          })),
        });
      }

      return p;
    });

    const populated = await prisma.product.findUnique({
      where: { id: updated.id },
      include: { variants: true },
    });

    await logAuditEvent(req.user?.id || null, 'PRODUCT_UPDATE', 'Product', id, oldProduct, populated, req);

    return res.status(200).json({ success: true, data: populated });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Soft delete product by archiving
    await prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    await logAuditEvent(req.user?.id || null, 'PRODUCT_DELETE', 'Product', id, { status: product.status }, { status: 'ARCHIVED' }, req);

    return res.status(200).json({ success: true, message: 'Product archived successfully.' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// ==========================================
// 4. INVENTORY ALERTS & CLOUDINARY UPLOADS
// ==========================================

export const getLowStockAlerts = async (req: Request, res: Response) => {
  try {
    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        stock: { lt: 10 },
        isActive: true,
        product: { status: 'ACTIVE' },
      },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { stock: 'asc' },
    });

    const alerts = lowStockVariants.map((v) => ({
      productId: v.productId,
      productName: v.product.name,
      variantId: v.id,
      variantName: v.name,
      sku: v.sku,
      stock: v.stock,
    }));

    return res.status(200).json({ success: true, data: alerts });
  } catch (error: any) {
    console.error('Error fetching low stock alerts:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const uploadProductImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    // Call Cloudinary Upload Helper
    const secureUrl = await uploadImageBuffer(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully.',
      data: { url: secureUrl },
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return res.status(550).json({ success: false, message: error.message || 'Image upload service failed.' });
  }
};
