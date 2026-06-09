import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';

export const getWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            variants: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Extract products
    const products = wishlistItems.map((item) => item.product);

    return res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching wishlist:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status === 'ARCHIVED') {
      return res.status(444).json({ success: false, message: 'Product does not exist.' });
    }

    const item = await prisma.wishlistItem.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: { userId, productId },
      update: {}, // Do nothing if it already exists
    });

    return res.status(200).json({ success: true, message: 'Product added to wishlist.', data: item });
  } catch (error: any) {
    console.error('Error adding to wishlist:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    await prisma.wishlistItem.delete({
      where: {
        userId_productId: { userId, productId },
      },
    });

    return res.status(200).json({ success: true, message: 'Product removed from wishlist.' });
  } catch (error: any) {
    console.error('Error removing from wishlist:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
