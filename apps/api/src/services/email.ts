import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_mock_api_key_for_testing';
const FRONTEND_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

let resend: Resend | null = null;
if (RESEND_API_KEY && !RESEND_API_KEY.startsWith('re_mock')) {
  resend = new Resend(RESEND_API_KEY);
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${token}`;

  console.log(`[Email Mock]: Sending verification email to ${email}`);
  console.log(`[Email Mock]: Link is: ${verificationLink}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'AlphaStryk <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your AlphaStryk Account',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #111;">Welcome to AlphaStryk!</h2>
            <p>Thank you for signing up. Please verify your email address to activate your account:</p>
            <div style="margin: 20px 0;">
              <a href="${verificationLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationLink}</p>
            <p style="margin-top: 30px; font-size: 12px; color: #999;">This link will expire in 24 hours.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send verification email via Resend to ${email}:`, err);
    }
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

  console.log(`[Email Mock]: Sending password reset email to ${email}`);
  console.log(`[Email Mock]: Link is: ${resetLink}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'AlphaStryk <security@resend.dev>',
        to: email,
        subject: 'Reset your AlphaStryk Password',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #111;">Reset your password</h2>
            <p>You requested a password reset for your AlphaStryk account. Click the button below to choose a new password:</p>
            <div style="margin: 20px 0;">
              <a href="${resetLink}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p>If you did not request this reset, you can safely ignore this email.</p>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetLink}</p>
            <p style="margin-top: 30px; font-size: 12px; color: #999;">This link will expire in 1 hour.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send password reset email via Resend to ${email}:`, err);
    }
  }
};

export const sendInvoiceEmailWithAttachment = async (
  email: string,
  invoiceNumber: string,
  pdfBuffer: Buffer
) => {
  console.log(`[Email Mock]: Sending invoice PDF attachment to ${email}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'AlphaStryk Billing <billing@resend.dev>',
        to: email,
        subject: `Your AlphaStryk Tax Invoice #${invoiceNumber}`,
        attachments: [
          {
            filename: `invoice-${invoiceNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #4f46e5;">Thank you for your order!</h2>
            <p>Your payment has been successfully verified. Please find your official tax invoice <strong>#${invoiceNumber}</strong> attached to this email.</p>
            <p>You can also log in to your AlphaStryk dashboard at any time to review your order status, download copies, or request changes.</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size: 11px; color: #999;">AlphaStryk Uniform Group Inc. &copy; 2026</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send invoice email via Resend to ${email}:`, err);
    }
  }
};

export const sendShipmentNotification = async (
  email: string,
  orderNumber: string,
  carrier: string,
  trackingNumber: string
) => {
  const trackingLink = `${FRONTEND_URL}/orders/${orderNumber}`;

  console.log(`[Email Mock]: Sending shipment notification email to ${email}`);
  console.log(`[Email Mock]: Tracking Link is: ${trackingLink}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'AlphaStryk Fulfillment <shipping@resend.dev>',
        to: email,
        subject: `Your AlphaStryk Order #${orderNumber} Has Been Shipped!`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #4f46e5;">Your order is on its way!</h2>
            <p>Great news! We have dispatched your team uniforms and customized gear. Here are your tracking details:</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #eee;">
              <p style="margin: 5px 0;"><strong>Order Reference:</strong> #${orderNumber}</p>
              <p style="margin: 5px 0;"><strong>Shipping Carrier:</strong> ${carrier}</p>
              <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
            </div>
            <div style="margin: 20px 0;">
              <a href="${trackingLink}" style="background-color: #4f46e5; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Track Your Shipment</a>
            </div>
            <p>Copy and paste this link in your browser if the button doesn't work:</p>
            <p style="word-break: break-all; color: #666;">${trackingLink}</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size: 11px; color: #999;">AlphaStryk Uniform Group Inc. &copy; 2026</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send shipment email via Resend to ${email}:`, err);
    }
  }
};

export const sendDeliveryNotification = async (
  email: string,
  orderNumber: string
) => {
  const trackingLink = `${FRONTEND_URL}/orders/${orderNumber}`;

  console.log(`[Email Mock]: Sending delivery confirmation email to ${email}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'AlphaStryk Fulfillment <shipping@resend.dev>',
        to: email,
        subject: `Your AlphaStryk Order #${orderNumber} Has Been Delivered!`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 5px;">
            <h2 style="color: #10b981;">Order Delivered!</h2>
            <p>Our records indicate that your order <strong>#${orderNumber}</strong> has been successfully delivered to your shipping address.</p>
            <p>We hope you love your custom uniforms! If you have any feedback or require refunds/exchanges, please log in to your dashboard or contact customer support.</p>
            <div style="margin: 20px 0;">
              <a href="${trackingLink}" style="background-color: #10b981; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Order Details</a>
            </div>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size: 11px; color: #999;">AlphaStryk Uniform Group Inc. &copy; 2026</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Failed to send delivery email via Resend to ${email}:`, err);
    }
  }
};


