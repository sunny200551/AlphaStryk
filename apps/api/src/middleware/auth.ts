import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@alphastryk/db';
import { UserRole } from '@alphastryk/common';

const JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET_ALPHASTRYK_SECURE_TOKEN_2026';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: UserRole;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = '';

    // 1. Check cookies
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Check auth headers
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

    // Find active user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return res.status(401).json({ success: false, message: 'User session no longer valid or user deleted.' });
    }

    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as unknown as UserRole,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token session. Please log in again.' });
  }
};

export const restrictTo = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Required roles: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};
