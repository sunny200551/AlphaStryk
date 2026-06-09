# Database Migration & Deployment Strategy - AlphaStryk

This document outlines the workflow for running migrations, deploying schemas to Neon Serverless PostgreSQL, seeding the initial admin account, and managing backups.

---

## 1. Local Development Migration Flow

We use Prisma Migrate to manage schema history locally. All schema modifications are versioned in `packages/db/prisma/migrations/`.

### Migration Commands
1. **Modify Schema**: Edit `packages/db/prisma/schema.prisma` to add or update models.
2. **Generate Migration**: Run the command:
   ```bash
   npx prisma migrate dev --name <migration_description_slug>
   ```
   *This generates the SQL file, updates the database, and regenerates the Prisma Client.*
3. **Regenerate Client**: If the database was updated externally, run:
   ```bash
   npx prisma generate
   ```

---

## 2. Neon Production Deployment Pipeline

Neon provides serverless PostgreSQL with branching. We leverage branches to test migrations before deploying them to production.

```text
[Production Branch (Main)]
     │
     ├──► Create Branch [migration-test-temp]
     │         │
     │         ▼ Run migrations on test branch
     │    npx prisma migrate deploy
     │         │
     │         ▼ Run end-to-end integration tests
     │    (Tests Pass)
     │         │
     │         ▼ Run migrations on Main Production
     │    DATABASE_URL=$PROD_DB_URL npx prisma migrate deploy
     │
     └──► Delete Branch [migration-test-temp]
```

### Connection Pooling Configurations
To manage serverless scaling, Neon uses connection poolers. In production, configure two distinct variables:
- **`DATABASE_URL`**: Connects to the pooled port (port 5432 or with transaction pooling parameters). Used by the Express API to handle concurrent user requests.
- **`DIRECT_DATABASE_URL`**: Connects directly to the unpooled database. **Required** by Prisma CLI to run migrations, as Prisma requires session-level locks that pooled connections do not support.

---

## 3. Seed Strategy & Initial Data Load

To seed base categories, products, and default roles (including the initial Super Admin credentials), implement a dedicated seed script.

### Seed Script Path
Create `packages/db/prisma/seed.ts` containing the initial data load configuration:

```typescript
import { PrismaClient, Role, AuthProvider } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Default Super Admin
  const adminPasswordHash = await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD || 'Admin@AlphaStryk2026', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@alphastryk.com' },
    update: {},
    create: {
      email: 'superadmin@alphastryk.com',
      name: 'Super Administrator',
      passwordHash: adminPasswordHash,
      role: Role.SUPER_ADMIN,
      isEmailVerified: true,
      provider: AuthProvider.EMAIL,
    },
  });
  console.log(`Super admin seeded: ${superAdmin.email}`);

  // 2. Create Base Product Categories
  const apparel = await prisma.category.upsert({
    where: { slug: 'apparel' },
    update: {},
    create: {
      name: 'Apparel',
      slug: 'apparel',
      description: 'Custom sports apparel and high-performance clothing',
    },
  });

  const gear = await prisma.category.upsert({
    where: { slug: 'gear' },
    update: {},
    create: {
      name: 'Sports Gear',
      slug: 'gear',
      description: 'Premium customized sports equipment and athletic gear',
    },
  });
  console.log('Categories seeded successfully.');

  // 3. Create Sample Product with 3D model properties
  const customJersey = await prisma.product.upsert({
    where: { slug: 'pro-sports-jersey' },
    update: {},
    create: {
      name: 'Pro Athletic Jersey',
      slug: 'pro-sports-jersey',
      description: 'Fully customizable 3D athletic jersey with moisture-wicking technology.',
      basePrice: 49.99,
      categoryId: apparel.id,
      images: ['https://res.cloudinary.com/alphastryk/image/upload/v1/samples/jersey-base.png'],
      variants: {
        create: [
          {
            name: 'Red / Large',
            sku: 'AS-JERSEY-RED-L',
            priceOffset: 0.00,
            stock: 100,
            attributes: { color: 'red', size: 'L' },
            model3dUrl: 'https://res.cloudinary.com/alphastryk/raw/upload/v1/models/jersey.glb',
            config3d: {
              defaultColor: '#FF0000',
              textureSlots: ['front_chest', 'back_name', 'left_shoulder'],
            },
          },
        ],
      },
    },
  });
  console.log(`Products and variants seeded: ${customJersey.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

To enable seeding via Prisma, reference this in `packages/db/package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```
Run `npx prisma db seed` to execute the load.

---

## 4. Disaster Recovery & Backup Policy

1. **Neon Point-in-Time Recovery (PITR)**: Automatically configured in Neon production instances. Allows reverting the database state to any exact microsecond within the retention window (e.g., 7 or 14 days).
2. **Pre-Migration logical backup**: Always execute a logical backup before running migrations on production database branches:
   ```bash
   pg_dump -d "$DIRECT_DATABASE_URL" -f "backup_$(date +%F_%H-%M-%S).sql"
   ```
3. **Data Loss Prevention Policy**: For major Schema alterations (e.g. dropping columns, modifying column types), create a dual-deployment phase where the column is marked deprecated first, populated in new schemas, and only dropped in a later phase to prevent production downtime.
