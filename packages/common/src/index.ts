// Shared Types & Interfaces for AlphaStryk Workspace

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum AuthenticationProvider {
  EMAIL = 'EMAIL',
  GOOGLE = 'GOOGLE'
}

// User & Session DTOs
export interface UserSessionDto {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface GoogleAuthPayload {
  email: string;
  name: string;
  picture?: string;
  googleId: string;
}

export interface SignupDto {
  email: string;
  password?: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password?: string;
}

// Standardised API Response Wrapping
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

// 3D Canvas Designer Interfaces
export interface ColorLayer {
  layerId: string;
  name: string;
  hexCode: string;
}

export interface TextureAsset {
  assetId: string;
  name: string;
  cloudinaryUrl: string;
  scaleX?: number;
  scaleY?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CustomTextNode {
  nodeId: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  colorHex: string;
  positionX: number;
  positionY: number;
  rotation?: number;
}

export interface ThreeDDesignData {
  canvasWidth: number;
  canvasHeight: number;
  colors: ColorLayer[];
  textures: TextureAsset[];
  texts: CustomTextNode[];
  selectedAttributes: Record<string, string>; // e.g. sizing, collar-style
  cameraAngleState?: {
    zoom: number;
    rotation: [number, number, number];
  };
}

// Payment Payload Specifications
export interface RazorpayOrderDetails {
  id: string; // Razorpay Order ID
  entity: string;
  amount: number; // In paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string; // Order Number
  status: string;
}

export interface PhonePeTransactionDetails {
  merchantId: string;
  merchantTransactionId: string;
  merchantUserId: string;
  amount: number; // In paise
  redirectUrl: string;
  callbackUrl: string;
  paymentInstrument: {
    type: string;
    [key: string]: any;
  };
}

export interface PaymentVerificationRequest {
  gateway: 'RAZORPAY' | 'PHONEPE';
  transactionId: string;
  orderId: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
}

// Order & Shipping Tracking DTOs
export interface OrderTrackingInfo {
  orderId: string;
  orderNumber: string;
  status: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: string | null;
  updates: {
    timestamp: string;
    location: string;
    details: string;
  }[];
}

// eCommerce Foundation DTOs & Search Query Models
export interface ProductSearchQuery {
  search?: string;
  categoryId?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
  attributes?: Record<string, string>; // e.g. color: 'red', size: 'L'
}

export interface CreateProductVariantDto {
  name: string;
  sku: string;
  priceOffset: number;
  stock: number;
  attributes: Record<string, string>;
  model3dUrl?: string;
}

export interface CreateProductDto {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  categoryId: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  images?: string[];
  metaTitle?: string;
  metaDesc?: string;
  variants?: CreateProductVariantDto[];
}

export interface LowStockAlertItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  stock: number;
}
