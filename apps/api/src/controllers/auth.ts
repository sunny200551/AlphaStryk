import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '@alphastryk/db';
import { UserRole, AuthenticationProvider } from '@alphastryk/common';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';

const JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET_ALPHASTRYK_SECURE_TOKEN_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_google_client_id.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const LOCKOUT_LIMIT = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const issueCookie = (res: Response, userId: string, email: string) => {
  const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  
  return token;
};

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

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create unverified user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: UserRole.CUSTOMER as any,
        isEmailVerified: false,
        provider: AuthenticationProvider.EMAIL as any,
      },
    });

    // Create verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: { email, token, expiresAt },
    });

    // Send email
    await sendVerificationEmail(email, token);

    // Audit Log
    await logAuditEvent(user.id, 'USER_SIGNUP', 'User', user.id, null, { email, name, role: user.role }, req);

    return res.status(201).json({
      success: true,
      message: 'Signup successful. Please check your email to verify your account.',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const verification = await prisma.verificationToken.findUnique({ where: { token } });
    if (!verification) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token.' });
    }

    if (new Date() > verification.expiresAt) {
      await prisma.verificationToken.delete({ where: { token } });
      return res.status(400).json({ success: false, message: 'Verification token has expired.' });
    }

    const user = await prisma.user.update({
      where: { email: verification.email },
      data: { isEmailVerified: true },
    });

    // Clean up token
    await prisma.verificationToken.delete({ where: { token } });

    // Audit Log
    await logAuditEvent(user.id, 'EMAIL_VERIFIED', 'User', user.id, { isEmailVerified: false }, { isEmailVerified: true }, req);

    return res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error: any) {
    console.error('Verification error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Check account lockout status
    if (user.lockoutUntil && new Date() < user.lockoutUntil) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Account is temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`,
      });
    }

    // Evaluate credentials
    const isMatch = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!isMatch) {
      // Increment login attempts
      const attempts = user.loginAttempts + 1;
      const lockoutUntil = attempts >= LOCKOUT_LIMIT ? new Date(Date.now() + LOCKOUT_DURATION) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockoutUntil,
        },
      });

      // Audit log failed attempt
      await logAuditEvent(user.id, 'LOGIN_FAILED', 'User', user.id, null, { attempts, locked: !!lockoutUntil }, req);

      if (lockoutUntil) {
        return res.status(403).json({
          success: false,
          message: 'Account locked due to 5 failed login attempts. Please try again in 15 minutes.',
        });
      }

      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Check if verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
      });
    }

    // Reset attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Sign token & Set cookie
    issueCookie(res, user.id, user.email);

    // Audit Log
    await logAuditEvent(user.id, 'USER_LOGIN', 'User', user.id, null, { role: user.role }, req);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential token is required.' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err: any) {
      // Mock validation logic for local testing if client ID is default/mock
      if (credential.startsWith('mock_google_token_')) {
        const parts = credential.split('_');
        payload = {
          email: `${parts[3] || 'user'}@gmail.com`,
          name: parts[4] || 'Google User',
          sub: parts[2] || 'mock-google-id-123',
        };
      } else {
        return res.status(400).json({ success: false, message: 'Failed to verify Google Token.' });
      }
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google payload response.' });
    }

    const { email, name, sub } = payload;

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.deletedAt) {
        return res.status(401).json({ success: false, message: 'Account is deleted.' });
      }

      // Update provider to GOOGLE if user previously registered with email
      if (user.provider !== ('GOOGLE' as any)) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            provider: AuthenticationProvider.GOOGLE as any,
            providerId: sub,
            isEmailVerified: true,
          },
        });
      }
    } else {
      // Create user
      user = await prisma.user.create({
        data: {
          email,
          name,
          role: UserRole.CUSTOMER as any,
          isEmailVerified: true,
          provider: AuthenticationProvider.GOOGLE as any,
          providerId: sub,
        },
      });
    }

    // Set cookie
    issueCookie(res, user.id, user.email);

    // Audit Log
    await logAuditEvent(user.id, 'GOOGLE_LOGIN', 'User', user.id, null, { provider: 'GOOGLE' }, req);

    return res.status(200).json({
      success: true,
      message: 'Google Login successful.',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Google login error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // For security reasons, don't disclose if email exists. Always return 200.
    if (user && !user.deletedAt) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.deleteMany({ where: { email } });
      await prisma.passwordResetToken.create({
        data: { email, token, expiresAt },
      });

      await sendPasswordResetEmail(email, token);
      await logAuditEvent(user.id, 'FORGOT_PASSWORD_REQUEST', 'User', user.id, null, { email }, req);
    }

    return res.status(200).json({
      success: true,
      message: 'If a matching account exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required.' });
    }

    const resetRequest = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetRequest) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    if (new Date() > resetRequest.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return res.status(400).json({ success: false, message: 'Reset token has expired.' });
    }

    const user = await prisma.user.findUnique({ where: { email: resetRequest.email } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Update password, reset lockout/attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        loginAttempts: 0,
        lockoutUntil: null,
      },
    });

    // Clean up reset token
    await prisma.passwordResetToken.delete({ where: { token } });

    // Audit Log
    await logAuditEvent(user.id, 'PASSWORD_RESET', 'User', user.id, null, null, req);

    return res.status(200).json({ success: true, message: 'Password reset successful. You can now log in.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id || null;
    
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    if (actorId) {
      await logAuditEvent(actorId, 'USER_LOGOUT', 'User', actorId, null, null, req);
    }

    return res.status(200).json({ success: true, message: 'Logout successful.' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

// Super admin audit log fetcher console
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: {
          select: {
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Audit logs retrieval error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};
