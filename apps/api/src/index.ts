import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import productRoutes from './routes/product';
import wishlistRoutes from './routes/wishlist';
import addressRoutes from './routes/address';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/order';
import paymentRoutes from './routes/payment';
import invoiceRoutes from './routes/invoice';
import shippingRoutes from './routes/shipping';
import couponRoutes from './routes/coupon';
import designRoutes from './routes/design';
import analyticsRoutes from './routes/analytics';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable Helmet to set security headers (HSTS, CSP, clickjacking prevention)
app.use(helmet());

// Configure Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});

// Apply rate limiter to all API endpoints
app.use('/api', globalLimiter);

// Enforce production CORS origins filters
const allowedOrigins = [
  process.env.NEXTAUTH_URL || 'http://localhost:3000',
  'https://alphastryk.com',
  'https://www.alphastryk.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS security policy.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/designs', designRoutes);
app.use('/api/v1/analytics', analyticsRoutes);




app.listen(port, () => {
  console.log(`[server]: AlphaStryk backend API listening at http://localhost:${port}`);
});
