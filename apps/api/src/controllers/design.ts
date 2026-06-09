import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';
import { uploadImageBuffer } from '../services/cloudinary';

/**
 * Save customized 3D design to database
 * POST /api/v1/designs
 */
export const saveDesign = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productVariantId, name, designData, thumbnailUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!productVariantId) {
      return res.status(400).json({ success: false, message: 'Product variant ID is required.' });
    }

    // Verify variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
    });

    if (!variant) {
      return res.status(404).json({ success: false, message: 'Product variant not found.' });
    }

    const design = await prisma.threeDDesign.create({
      data: {
        userId,
        productId: variant.productId,
        productVariantId,
        name: name || 'My Custom 3D Design',
        designData: designData ? JSON.parse(JSON.stringify(designData)) : {},
        thumbnailUrl: thumbnailUrl || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: '3D Design saved successfully.',
      design,
    });
  } catch (error: any) {
    console.error('Save design error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to save design.' });
  }
};

/**
 * Fetch detailed configuration of a saved design
 * GET /api/v1/designs/detail/:id
 */
export const getDesignDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const design = await prisma.threeDDesign.findUnique({
      where: { id },
      include: {
        variant: {
          include: { product: true },
        },
      },
    });

    if (!design) {
      return res.status(404).json({ success: false, message: 'Design config not found.' });
    }

    // Owner check or Admin check
    if (design.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({
      success: true,
      design,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch all saved designs of the active customer
 * GET /api/v1/designs/my-designs
 */
export const getUserDesigns = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const designs = await prisma.threeDDesign.findMany({
      where: { userId },
      include: {
        variant: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      designs,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Admin: Fetch all designs generated on the platform (for order fulfillment review)
 * GET /api/v1/designs/admin/all
 */
export const getAdminDesigns = async (req: Request, res: Response) => {
  try {
    const designs = await prisma.threeDDesign.findMany({
      include: {
        user: {
          select: { name: true, email: true },
        },
        variant: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      designs,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload custom graphic (PNG/JPG) to Cloudinary
 * POST /api/v1/designs/upload
 */
export const uploadDesignAsset = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No graphic file uploaded.' });
    }

    // Capture file buffer and send to Cloudinary
    const fileUrl = await uploadImageBuffer(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: 'Asset uploaded successfully.',
      url: fileUrl,
    });
  } catch (error: any) {
    console.error('Asset upload error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Upload failed.' });
  }
};
