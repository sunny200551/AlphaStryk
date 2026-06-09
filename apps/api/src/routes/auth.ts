import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validateSchema } from '../middleware/validate';
import {
  signup,
  verifyEmail,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  logout,
  me,
  getAuditLogs,
} from '../controllers/auth';
import { authMiddleware, restrictTo } from '../middleware/auth';
import { UserRole } from '@alphastryk/common';

const router = Router();

// Zod schemas matching authentication payloads
export const signupSchema = z.object({
  body: z.object({
    email: z.string().email('Provide a valid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    name: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Provide a valid email address.'),
    password: z.string().min(1, 'Password cannot be empty.'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Provide a valid email address.'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
  }),
});

// General rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per window
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for forgot password requests
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public Auth Routes
router.post('/signup', authLimiter, validateSchema(signupSchema), signup);
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/login', authLimiter, validateSchema(loginSchema), login);
router.post('/google', authLimiter, googleLogin);
router.post('/forgot-password', resetPasswordLimiter, validateSchema(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validateSchema(resetPasswordSchema), resetPassword);
router.post('/logout', logout);

// Protected Auth Routes
router.get('/me', authMiddleware, me);

// Super Admin Protected Audit Logs Route
router.get('/audit-logs', authMiddleware, restrictTo(UserRole.SUPER_ADMIN), getAuditLogs);

export default router;
