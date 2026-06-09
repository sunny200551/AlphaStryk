import { Request, Response } from 'express';
import { prisma } from '@alphastryk/db';

export const getAddresses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });

    return res.status(200).json({ success: true, data: addresses });
  } catch (error: any) {
    console.error('Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type, street, city, state, country, postalCode, isDefault } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!type || !street || !city || !state || !country || !postalCode) {
      return res.status(400).json({ success: false, message: 'Missing required address parameters.' });
    }

    // If marked default, unset other default addresses of this type first
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, type },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        type,
        street,
        city,
        state,
        country,
        postalCode,
        isDefault: isDefault || false,
      },
    });

    return res.status(201).json({ success: true, data: address });
  } catch (error: any) {
    console.error('Error creating address:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const address = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      return res.status(404).json({ success: false, message: 'Address not found or unauthorized.' });
    }

    await prisma.address.delete({ where: { id } });

    return res.status(200).json({ success: true, message: 'Address deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting address:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
