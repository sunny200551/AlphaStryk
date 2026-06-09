import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';

// Helper to fetch or create user cart
const getOrCreateCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: { name: true, basePrice: true, images: true, slug: true },
              },
            },
          },
          customDesign: true,
        },
      },
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: { name: true, basePrice: true, images: true, slug: true },
                },
              },
            },
            customDesign: true,
          },
        },
      },
    });
  }

  return cart;
};

export const getCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const cart = await getOrCreateCart(userId);
    return res.status(200).json({ success: true, data: cart });
  } catch (error: any) {
    console.error('Error fetching cart:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productVariantId, quantity = 1, customDesignId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!productVariantId) {
      return res.status(400).json({ success: false, message: 'Product variant ID is required.' });
    }

    // Verify stock availability
    const variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
    if (!variant || !variant.isActive) {
      return res.status(404).json({ success: false, message: 'Variant not found or inactive.' });
    }

    if (variant.stock < quantity) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Only ${variant.stock} available.` });
    }

    const cart = await getOrCreateCart(userId);

    // Check if variant already exists in cart with same custom design configuration
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productVariantId,
        customDesignId: customDesignId || null,
      },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (variant.stock < newQty) {
        return res.status(400).json({ success: false, message: `Cannot exceed available stock limit (${variant.stock}).` });
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId,
          quantity,
          customDesignId: customDesignId || null,
        },
      });
    }

    const updated = await getOrCreateCart(userId);
    return res.status(200).json({ success: true, message: 'Added to cart successfully.', data: updated });
  } catch (error: any) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { variant: true },
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }

    if (cartItem.variant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot update quantity. Only ${cartItem.variant.stock} items available in stock.`,
      });
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    const updated = await getOrCreateCart(userId);
    return res.status(200).json({ success: true, message: 'Cart item updated.', data: updated });
  } catch (error: any) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found or unauthorized.' });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    const updated = await getOrCreateCart(userId);
    return res.status(200).json({ success: true, message: 'Item removed from cart.', data: updated });
  } catch (error: any) {
    console.error('Error removing from cart:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// Sync guest cart with user cart on login
export const syncCart = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { items } = req.body; // Array of { productVariantId, quantity, customDesignId }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid payload list items.' });
    }

    const cart = await getOrCreateCart(userId);

    for (const item of items) {
      const { productVariantId, quantity, customDesignId } = item;
      
      const variant = await prisma.productVariant.findUnique({ where: { id: productVariantId } });
      if (!variant || !variant.isActive) continue;

      const existing = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productVariantId,
          customDesignId: customDesignId || null,
        },
      });

      if (existing) {
        const targetQty = existing.quantity + quantity;
        const finalQty = Math.min(targetQty, variant.stock);
        await prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: finalQty },
        });
      } else {
        const finalQty = Math.min(quantity, variant.stock);
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productVariantId,
            quantity: finalQty,
            customDesignId: customDesignId || null,
          },
        });
      }
    }

    const synced = await getOrCreateCart(userId);
    return res.status(200).json({ success: true, message: 'Cart synchronized successfully.', data: synced });
  } catch (error: any) {
    console.error('Error syncing cart:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
