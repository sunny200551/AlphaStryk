# Database Architecture & Schema Design - AlphaStryk

This document describes the schema architecture, relationships, performance indexing strategy, and role-based access rules for the AlphaStryk PostgreSQL database deployed on Neon.

---

## 1. Entity Relationships Model (ERD)

The database schema is divided into 4 core domain areas:

### A. Authentication & User Profiles
* `User` 1-to-1 `UserProfile` (Cascade delete user deletes profile).
* `User` 1-to-Many `Address` (Stores multiple billing and shipping options).

### B. Catalog & 3D Assets
* `Category` 1-to-Many `Category` (Self-referential hierarchy to support subcategories).
* `Category` 1-to-Many `Product` (Products must belong to an active category).
* `Product` 1-to-Many `ProductVariant` (Variants handle SKUs, colors, sizing options, and price offsets).
* `ProductVariant` 1-to-Many `ThreeDDesign` (Supports saving specific 3D model configs like custom textures or text placements).

### C. Shopping Cart & Checkout
* `User` 1-to-1 `Cart` (Maintains a single persistent shopping cart per logged-in user).
* `Cart` 1-to-Many `CartItem` (CartItems reference a specific `ProductVariant` and optional custom `ThreeDDesign`).
* `User` 1-to-Many `Order` (Tracks user transactions).
* `Order` 1-to-Many `OrderItem` (Maintains snapshots of pricing and variants purchased).
* `Order` 1-to-Many `Payment` (Supports multiple payment attempts or multi-gateway settlements).
* `Order` 1-to-Many `Refund` (Handles transaction cancellations and credit operations).

### D. Coupons & Marketing
* `Coupon` 1-to-Many `Order` (Tracks what coupon was applied to an order).
* `Coupon` 1-to-Many `CouponUsage` (Strictly enforces unique user checks to prevent coupon abuse).

---

## 2. Indexing Strategy for Serverless Postgres

To maintain lightning-fast response times (<15ms) on serverless Neon PostgreSQL, we establish explicit database indexes on critical filter and join fields:

| Table | Index Field(s) | Primary Query / Operations Supported |
|---|---|---|
| `User` | `email` | User logins, credentials checks, registration validation |
| `Address` | `userId` | Fetching customer address book during checkout |
| `Category`| `slug` | Category listing pages |
| `Product` | `slug` | Product detail page loading |
| `Product` | `categoryId` | Filtering products by category |
| `ProductVariant` | `productId` | Fetching variants for a specific product |
| `ProductVariant` | `sku` | Inventory synchronization and barcode lookups |
| `CartItem`| `cartId` | Cart retrieval |
| `Order` | `customerId` | Order history display in customer dashboard |
| `Order` | `orderNumber` | Admin search and customer order lookup |
| `Order` | `status` | Admin dashboard tracking and order processing lists |
| `Payment` | `orderId` | Correlating transactions for a specific order |
| `Payment` | `transactionId` | Payment gateway webhook processing |
| `Coupon` | `code` | Coupon validation on checkout |
| `CouponUsage` | `userId`, `couponId`, `orderId` | Single-use coupon eligibility validation |
| `AuditLog`| `actorId`, `action`, `entityType` | Admin change tracking and operations audits |

---

## 3. Role-Based Access Control (RBAC) Mapping

We enforce strict data isolation rules per user role:

| Database Domain / Table | Customer Permissions | Admin Permissions | Super Admin Permissions |
|---|---|---|---|
| **User & Profiles** | Read/Write (Self only) | Read All / Write (Self only) | Read All / Write All (Role elevation) |
| **Products & Categories** | Read (Active only) | Read/Write (All) | Read/Write (All) |
| **Orders & Items** | Read/Write (Self only) | Read All / Update Status | Read All / Update Status |
| **Payments** | Read (Self only) | Read All | Read All |
| **Coupons** | Read Code (If valid) | Read/Write (All) | Read/Write (All) |
| **Refunds** | None | Read All / Create Refund | Read All / Create / Approve Refund |
| **Audit Logs** | None | None | Read All |

---

## 4. Performance & Scalability Considerations

### Prevent Orphan Records (Cascading vs Set-Null)
- **Users**: Soft-deleted via `deletedAt` timestamp. Hard deletion cascade-deletes the `UserProfile` and `Address` entries, but `Order` and `Payment` items are preserved (using client-level soft checks) to prevent skewing accounting reports.
- **Product Deletion**: Blocked if referenced in completed `OrderItem` records to preserve purchase history.

### Address & Pricing Snapshots
- Addresses are stored as JSON blobs inside `Order.shippingAddress` and `Order.billingAddress`. If a user modifies their address in their profile later, the historical order address remains unaffected.
- `OrderItem` explicitly saves `priceAtPurchase` and `discountApplied` as static `Decimal` values. Product pricing updates do not modify old order records.
