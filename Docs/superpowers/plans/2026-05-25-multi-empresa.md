# Multi-Empresa: Seleção de Empresa Pós-Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um usuário pertença a múltiplas empresas (restaurantes), com role por empresa, e após login selecione a empresa desejada antes de acessar os módulos.

**Architecture:** JWT em dois estágios — `login` emite um `partialToken` (sem restaurantId) junto com a lista de empresas do usuário; `POST /auth/select-empresa` valida o partial token e emite o full token com `restaurantId + role`. O frontend mantém os dois tokens em cookies e localStorage, com o middleware Next.js roteando baseado em qual token está presente.

**Tech Stack:** NestJS + Prisma (SQLite), Next.js 14 App Router, Passport JWT, TypeScript.

---

## File Map

**Backend — criar:**
- `gercoz-backend/src/auth/strategies/partial-jwt.strategy.ts`
- `gercoz-backend/src/auth/guards/partial-jwt.guard.ts`
- `gercoz-backend/src/auth/dto/select-empresa.dto.ts`

**Backend — modificar:**
- `gercoz-backend/prisma/schema.prisma`
- `gercoz-backend/prisma/seed.ts`
- `gercoz-backend/src/auth/strategies/jwt.strategy.ts`
- `gercoz-backend/src/auth/auth.service.ts`
- `gercoz-backend/src/auth/auth.service.spec.ts`
- `gercoz-backend/src/auth/auth.controller.ts`
- `gercoz-backend/src/auth/auth.module.ts`

**Frontend — criar:**
- `gercoz-frontend/src/app/empresas/page.tsx`

**Frontend — modificar:**
- `gercoz-frontend/src/contexts/auth-context.tsx`
- `gercoz-frontend/src/app/auth/page.tsx`
- `gercoz-frontend/src/app/modulos/page.tsx`
- `gercoz-frontend/src/middleware.ts`

---

## Task 1: Prisma Schema — UserRestaurant + atualizar User e RefreshToken

**Files:**
- Modify: `gercoz-backend/prisma/schema.prisma`

- [ ] **Step 1: Atualizar schema.prisma**

Substituir o conteúdo de `gercoz-backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

enum UserRole {
  ADMIN
  CASHIER
  COOK
}

enum Unit {
  G
  KG
  ML
  L
  UN
}

enum OrderType {
  MESA
  BALCAO
}

enum OrderStatus {
  PENDING
  PREPARING
  READY
  DELIVERED
  CANCELLED
}

model Restaurant {
  id           String           @id @default(cuid())
  name         String
  slug         String           @unique
  phone        String?
  address      String?
  isActive     Boolean          @default(true)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  members      UserRestaurant[]
  ingredients  Ingredient[]
  categories   Category[]
  products     Product[]
  orders       Order[]
}

model User {
  id            String           @id @default(cuid())
  name          String
  email         String           @unique
  password      String
  isActive      Boolean          @default(true)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  restaurants            UserRestaurant[]
  refreshTokens          RefreshToken[]
  orders                 Order[]
  ingredientPriceHistory IngredientPriceHistory[]
}

model UserRestaurant {
  id           String     @id @default(cuid())
  userId       String
  restaurantId String
  role         UserRole

  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([userId, restaurantId])
}

model RefreshToken {
  id           String   @id @default(cuid())
  userId       String
  restaurantId String
  token        String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Ingredient {
  id           String    @id @default(cuid())
  restaurantId String
  name         String
  description  String?
  unit         Unit
  costPrice    Float
  supplier     String?
  stock        Float     @default(0)
  minStock     Float     @default(0)
  expiryDate   DateTime?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  restaurant   Restaurant             @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  recipeItems  RecipeItem[]
  priceHistory IngredientPriceHistory[]

  @@unique([restaurantId, name])
}

model IngredientPriceHistory {
  id           String   @id @default(cuid())
  ingredientId String
  price        Float
  changedBy    String
  changedAt    DateTime @default(now())

  ingredient Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  user       User       @relation(fields: [changedBy], references: [id])
}

model Category {
  id           String   @id @default(cuid())
  restaurantId String
  name         String
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)

  restaurant Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  products   Product[]

  @@unique([restaurantId, name])
}

model Product {
  id              String   @id @default(cuid())
  restaurantId    String
  categoryId      String?
  name            String
  description     String?
  salePrice       Float
  preparationTime Int      @default(15)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  restaurant  Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  category    Category?   @relation(fields: [categoryId], references: [id])
  recipeItems RecipeItem[]
  orderItems  OrderItem[]

  @@unique([restaurantId, name])
}

model RecipeItem {
  id           String @id @default(cuid())
  productId    String
  ingredientId String
  quantity     Float
  unit         Unit

  product    Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredient Ingredient @relation(fields: [ingredientId], references: [id])

  @@unique([productId, ingredientId])
}

model Order {
  id           String      @id @default(cuid())
  restaurantId String
  orderNumber  Int
  type         OrderType
  tableNumber  Int?
  status       OrderStatus @default(PENDING)
  notes        String?
  discount     Float       @default(0)
  createdBy    String
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  closedAt     DateTime?

  restaurant Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  user       User        @relation(fields: [createdBy], references: [id])
  items      OrderItem[]

  @@unique([restaurantId, orderNumber])
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  productId String
  quantity  Int
  unitPrice Float
  notes     String?

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])
}
```

- [ ] **Step 2: Criar e aplicar migração**

```bash
cd gercoz-backend
npx prisma migrate dev --name multi-empresa
```

Esperado: mensagem `The following migration(s) have been applied: .../multi-empresa/migration.sql`

- [ ] **Step 3: Gerar Prisma Client atualizado**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client (v...)` sem erros.

- [ ] **Step 4: Commit**

```bash
cd gercoz-backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add UserRestaurant junction table, update User and RefreshToken schema"
```

---

## Task 2: Seed — Atualizar para novo schema

**Files:**
- Modify: `gercoz-backend/prisma/seed.ts`

- [ ] **Step 1: Atualizar seed.ts**

Substituir o conteúdo completo de `gercoz-backend/prisma/seed.ts`:

```typescript
import 'dotenv/config';
import {
  PrismaClient,
  Unit,
  UserRole,
  OrderType,
  OrderStatus,
} from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';

function resolveDbPath(url: string): string {
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}

const dbPath = resolveDbPath(process.env.DATABASE_URL ?? 'file:./dev.db');
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // ── Restaurants ───────────────────────────────────────────────────────────
  const restaurant1 = await prisma.restaurant.create({
    data: {
      name: 'Restaurante Demo',
      slug: 'demo',
      phone: '(11) 99999-9999',
      address: 'Rua Demo, 123',
    },
  });

  const restaurant2 = await prisma.restaurant.create({
    data: {
      name: 'Lanchonete Beta',
      slug: 'beta',
      phone: '(11) 88888-8888',
      address: 'Av. Beta, 456',
    },
  });

  console.log(`Restaurants created: ${restaurant1.name}, ${restaurant2.name}`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const cookPassword = await bcrypt.hash('cook123', 10);

  // Admin belongs to both restaurants
  const admin = await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@demo.com',
      password: adminPassword,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      name: 'Caixa',
      email: 'caixa@demo.com',
      password: cashierPassword,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Cozinheiro',
      email: 'cozinha@demo.com',
      password: cookPassword,
    },
  });

  console.log('Users created: admin, cashier, cook');

  // ── UserRestaurant memberships ─────────────────────────────────────────────
  // Admin has access to both restaurants (ADMIN role in each)
  await prisma.userRestaurant.create({
    data: { userId: admin.id, restaurantId: restaurant1.id, role: UserRole.ADMIN },
  });
  await prisma.userRestaurant.create({
    data: { userId: admin.id, restaurantId: restaurant2.id, role: UserRole.ADMIN },
  });

  // Cashier belongs only to restaurant1
  await prisma.userRestaurant.create({
    data: { userId: cashier.id, restaurantId: restaurant1.id, role: UserRole.CASHIER },
  });

  console.log('UserRestaurant memberships created');

  // ── Ingredients for restaurant1 (12) ──────────────────────────────────────
  const ingredients = await Promise.all([
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Farinha de trigo', unit: Unit.KG, costPrice: 4.5, supplier: 'Moinho', stock: 20, minStock: 5 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Ovo', unit: Unit.UN, costPrice: 0.8, supplier: 'Granja', stock: 100, minStock: 20 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Leite', unit: Unit.L, costPrice: 4.0, supplier: 'Laticínios', stock: 10, minStock: 3 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Manteiga', unit: Unit.KG, costPrice: 28.0, supplier: 'Laticínios', stock: 5, minStock: 1 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Açúcar', unit: Unit.KG, costPrice: 3.5, supplier: 'Usina', stock: 10, minStock: 2 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Sal', unit: Unit.KG, costPrice: 2.0, supplier: 'Salinas', stock: 5, minStock: 1 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Queijo muçarela', unit: Unit.KG, costPrice: 35.0, supplier: 'Laticínios', stock: 8, minStock: 2 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Presunto', unit: Unit.KG, costPrice: 25.0, supplier: 'Frigorífico', stock: 5, minStock: 1 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Tomate', unit: Unit.KG, costPrice: 6.0, supplier: 'Hortifruti', stock: 10, minStock: 2 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Alface', unit: Unit.UN, costPrice: 2.5, supplier: 'Hortifruti', stock: 30, minStock: 10 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Peito de frango', unit: Unit.KG, costPrice: 18.0, supplier: 'Frigorífico', stock: 15, minStock: 3 },
    }),
    prisma.ingredient.create({
      data: { restaurantId: restaurant1.id, name: 'Pão de hambúrguer', unit: Unit.UN, costPrice: 1.5, supplier: 'Padaria', stock: 50, minStock: 10 },
    }),
  ]);

  const [
    ingFarinha, ingOvo, ingLeite, ingManteiga, ingAcucar,
    ingSal, ingQueijo, ingPresunto, ingTomate, ingAlface,
    ingFrango, ingPao,
  ] = ingredients;

  await Promise.all(
    ingredients.map((ing) =>
      prisma.ingredientPriceHistory.create({
        data: { ingredientId: ing.id, price: ing.costPrice, changedBy: admin.id },
      }),
    ),
  );

  console.log(`Ingredients created: ${ingredients.length}`);

  // ── Categories for restaurant1 ────────────────────────────────────────────
  const [catLanches, catPizzas, catBebidas, catSobremesas] = await Promise.all([
    prisma.category.create({ data: { restaurantId: restaurant1.id, name: 'Lanches', sortOrder: 1 } }),
    prisma.category.create({ data: { restaurantId: restaurant1.id, name: 'Pizzas', sortOrder: 2 } }),
    prisma.category.create({ data: { restaurantId: restaurant1.id, name: 'Bebidas', sortOrder: 3 } }),
    prisma.category.create({ data: { restaurantId: restaurant1.id, name: 'Sobremesas', sortOrder: 4 } }),
  ]);

  console.log('Categories created: Lanches, Pizzas, Bebidas, Sobremesas');

  // ── Products + RecipeItems for restaurant1 ────────────────────────────────
  type RecipeEntry = { ing: typeof ingFarinha; qty: number; unit: Unit };
  const productData: Array<{
    name: string; categoryId: string; salePrice: number;
    preparationTime: number; recipe: RecipeEntry[];
  }> = [
    { name: 'X-Burguer', categoryId: catLanches.id, salePrice: 18.0, preparationTime: 15,
      recipe: [{ ing: ingPao, qty: 1, unit: Unit.UN }, { ing: ingQueijo, qty: 0.1, unit: Unit.KG }, { ing: ingTomate, qty: 0.1, unit: Unit.KG }] },
    { name: 'X-Bacon', categoryId: catLanches.id, salePrice: 22.0, preparationTime: 15,
      recipe: [{ ing: ingPao, qty: 1, unit: Unit.UN }, { ing: ingQueijo, qty: 0.1, unit: Unit.KG }, { ing: ingPresunto, qty: 0.1, unit: Unit.KG }, { ing: ingTomate, qty: 0.05, unit: Unit.KG }] },
    { name: 'X-Salada', categoryId: catLanches.id, salePrice: 20.0, preparationTime: 12,
      recipe: [{ ing: ingPao, qty: 1, unit: Unit.UN }, { ing: ingAlface, qty: 1, unit: Unit.UN }, { ing: ingTomate, qty: 0.1, unit: Unit.KG }] },
    { name: 'Pizza Margherita', categoryId: catPizzas.id, salePrice: 45.0, preparationTime: 25,
      recipe: [{ ing: ingFarinha, qty: 0.4, unit: Unit.KG }, { ing: ingQueijo, qty: 0.2, unit: Unit.KG }, { ing: ingTomate, qty: 0.3, unit: Unit.KG }, { ing: ingSal, qty: 0.01, unit: Unit.KG }] },
    { name: 'Pizza Frango', categoryId: catPizzas.id, salePrice: 52.0, preparationTime: 25,
      recipe: [{ ing: ingFarinha, qty: 0.4, unit: Unit.KG }, { ing: ingFrango, qty: 0.3, unit: Unit.KG }, { ing: ingQueijo, qty: 0.2, unit: Unit.KG }] },
    { name: 'Pizza Calabresa', categoryId: catPizzas.id, salePrice: 48.0, preparationTime: 25,
      recipe: [{ ing: ingFarinha, qty: 0.4, unit: Unit.KG }, { ing: ingQueijo, qty: 0.2, unit: Unit.KG }, { ing: ingTomate, qty: 0.2, unit: Unit.KG }] },
    { name: 'Suco de Laranja', categoryId: catBebidas.id, salePrice: 10.0, preparationTime: 5,
      recipe: [{ ing: ingAcucar, qty: 0.05, unit: Unit.KG }] },
    { name: 'Refrigerante', categoryId: catBebidas.id, salePrice: 7.0, preparationTime: 2, recipe: [] },
    { name: 'Água', categoryId: catBebidas.id, salePrice: 4.0, preparationTime: 1, recipe: [] },
    { name: 'Brigadeiro', categoryId: catSobremesas.id, salePrice: 5.0, preparationTime: 10,
      recipe: [{ ing: ingLeite, qty: 0.1, unit: Unit.L }, { ing: ingAcucar, qty: 0.05, unit: Unit.KG }, { ing: ingManteiga, qty: 0.02, unit: Unit.KG }] },
    { name: 'Pudim', categoryId: catSobremesas.id, salePrice: 12.0, preparationTime: 60,
      recipe: [{ ing: ingLeite, qty: 0.5, unit: Unit.L }, { ing: ingOvo, qty: 3, unit: Unit.UN }, { ing: ingAcucar, qty: 0.15, unit: Unit.KG }] },
    { name: 'Petit Gâteau', categoryId: catSobremesas.id, salePrice: 18.0, preparationTime: 20,
      recipe: [{ ing: ingFarinha, qty: 0.1, unit: Unit.KG }, { ing: ingOvo, qty: 2, unit: Unit.UN }, { ing: ingManteiga, qty: 0.08, unit: Unit.KG }, { ing: ingAcucar, qty: 0.1, unit: Unit.KG }] },
  ];

  const products: Array<{ id: string; salePrice: number }> = [];
  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        restaurantId: restaurant1.id,
        name: p.name,
        categoryId: p.categoryId,
        salePrice: p.salePrice,
        preparationTime: p.preparationTime,
        recipeItems: {
          create: p.recipe.map((r) => ({ ingredientId: r.ing.id, quantity: r.qty, unit: r.unit })),
        },
      },
      select: { id: true, salePrice: true },
    });
    products.push(product);
  }

  console.log(`Products created: ${products.length}`);

  // ── Orders for restaurant1 (12) ───────────────────────────────────────────
  const statuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.DELIVERED];

  for (let i = 0; i < 12; i++) {
    const isMesa = i % 2 === 0;
    const product1 = products[i % products.length];
    const product2 = products[(i + 3) % products.length];
    const status = statuses[i % statuses.length];
    const isDelivered = status === OrderStatus.DELIVERED;

    await prisma.order.create({
      data: {
        restaurantId: restaurant1.id,
        orderNumber: i + 1,
        type: isMesa ? OrderType.MESA : OrderType.BALCAO,
        tableNumber: isMesa ? (i % 8) + 1 : undefined,
        status,
        closedAt: isDelivered ? new Date() : undefined,
        createdBy: cashier.id,
        items: {
          create: [
            { productId: product1.id, quantity: 1, unitPrice: product1.salePrice },
            { productId: product2.id, quantity: 2, unitPrice: product2.salePrice },
          ],
        },
      },
    });
  }

  console.log('Orders created: 12');
  console.log('');
  console.log('Seed completed successfully!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Admin (2 empresas): admin@demo.com   / admin123');
  console.log('  Caixa (1 empresa):  caixa@demo.com   / cashier123');
  console.log('  Cook  (sem acesso): cozinha@demo.com / cook123');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Recriar banco e executar seed**

```bash
cd gercoz-backend
npx prisma migrate reset --force
```

Esperado: migração rodada + seed executado + `Seed completed successfully!` no output.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed for multi-empresa schema"
```

---

## Task 3: Backend — Estratégias e Guards JWT

**Files:**
- Modify: `gercoz-backend/src/auth/strategies/jwt.strategy.ts`
- Create: `gercoz-backend/src/auth/strategies/partial-jwt.strategy.ts`
- Create: `gercoz-backend/src/auth/guards/partial-jwt.guard.ts`

- [ ] **Step 1: Escrever testes para as estratégias**

Criar `gercoz-backend/src/auth/strategies/jwt.strategy.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

const mockConfig = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfig);
  });

  it('should return user object for full token payload', () => {
    const payload = { sub: 'user-1', restaurantId: 'rest-1', role: 'ADMIN', name: 'Admin', type: 'full' };
    const result = strategy.validate(payload);
    expect(result).toEqual({ userId: 'user-1', restaurantId: 'rest-1', role: 'ADMIN', name: 'Admin' });
  });

  it('should throw UnauthorizedException for partial token payload', () => {
    const payload = { sub: 'user-1', name: 'Admin', type: 'partial' };
    expect(() => strategy.validate(payload as any)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when type is missing', () => {
    const payload = { sub: 'user-1', restaurantId: 'rest-1', role: 'ADMIN', name: 'Admin' };
    expect(() => strategy.validate(payload as any)).toThrow(UnauthorizedException);
  });
});
```

Criar `gercoz-backend/src/auth/strategies/partial-jwt.strategy.spec.ts`:

```typescript
import { UnauthorizedException } from '@nestjs/common';
import { PartialJwtStrategy } from './partial-jwt.strategy';
import { ConfigService } from '@nestjs/config';

const mockConfig = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

describe('PartialJwtStrategy', () => {
  let strategy: PartialJwtStrategy;

  beforeEach(() => {
    strategy = new PartialJwtStrategy(mockConfig);
  });

  it('should return partial user for partial token payload', () => {
    const payload = { sub: 'user-1', name: 'Admin', type: 'partial' };
    const result = strategy.validate(payload);
    expect(result).toEqual({ userId: 'user-1', name: 'Admin' });
  });

  it('should throw UnauthorizedException for full token payload', () => {
    const payload = { sub: 'user-1', restaurantId: 'rest-1', role: 'ADMIN', name: 'Admin', type: 'full' };
    expect(() => strategy.validate(payload)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Rodar testes — verificar que falham**

```bash
cd gercoz-backend
npx jest src/auth/strategies --no-coverage
```

Esperado: FAIL — `Cannot find module './jwt.strategy.spec'` ou erros de importação.

- [ ] **Step 3: Atualizar jwt.strategy.ts**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type FullPayload = { sub: string; restaurantId: string; role: string; name: string; type: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  validate(payload: FullPayload) {
    if (payload.type !== 'full') throw new UnauthorizedException('Full token required');
    return { userId: payload.sub, restaurantId: payload.restaurantId, role: payload.role, name: payload.name };
  }
}
```

- [ ] **Step 4: Criar partial-jwt.strategy.ts**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type PartialPayload = { sub: string; name: string; type: string };

@Injectable()
export class PartialJwtStrategy extends PassportStrategy(Strategy, 'partial-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  validate(payload: PartialPayload) {
    if (payload.type !== 'partial') throw new UnauthorizedException('Partial token required');
    return { userId: payload.sub, name: payload.name };
  }
}
```

- [ ] **Step 5: Criar partial-jwt.guard.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PartialJwtGuard extends AuthGuard('partial-jwt') {}
```

- [ ] **Step 6: Rodar testes — verificar que passam**

```bash
cd gercoz-backend
npx jest src/auth/strategies --no-coverage
```

Esperado: PASS — 5 testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/auth/strategies/jwt.strategy.ts \
        src/auth/strategies/jwt.strategy.spec.ts \
        src/auth/strategies/partial-jwt.strategy.ts \
        src/auth/strategies/partial-jwt.strategy.spec.ts \
        src/auth/guards/partial-jwt.guard.ts
git commit -m "feat: add PartialJwtStrategy/Guard, update JwtStrategy to require type=full"
```

---

## Task 4: Backend — Auth Service (login + selectEmpresa + refresh)

**Files:**
- Modify: `gercoz-backend/src/auth/auth.service.ts`
- Modify: `gercoz-backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Atualizar auth.service.spec.ts com novos testes**

Substituir o conteúdo completo de `gercoz-backend/src/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  password: bcrypt.hashSync('secret123', 10),
  isActive: true,
  name: 'Admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRestaurant = { id: 'rest-1', name: 'Restaurante Demo' };

const mockUserRestaurant = {
  restaurantId: 'rest-1',
  role: 'ADMIN',
  restaurant: mockRestaurant,
};

const mockPrisma = {
  user: { findFirst: jest.fn() },
  userRestaurant: { findMany: jest.fn(), findUnique: jest.fn() },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('signed-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return partialToken and empresas on valid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.userRestaurant.findMany.mockResolvedValue([mockUserRestaurant]);

      const result = await service.login({ email: 'admin@test.com', password: 'secret123' });

      expect(result).toHaveProperty('partialToken', 'signed-token');
      expect(result.empresas).toEqual([
        { id: 'rest-1', nome: 'Restaurante Demo', role: 'ADMIN' },
      ]);
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', name: 'Admin', type: 'partial' },
        { expiresIn: '7d' },
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'secret123' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      await expect(service.login({ email: 'admin@test.com', password: 'wrongpass' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('selectEmpresa', () => {
    it('should return accessToken and refreshToken on valid restaurantId', async () => {
      mockPrisma.userRestaurant.findUnique.mockResolvedValue({
        ...mockUserRestaurant,
        userId: 'user-1',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.selectEmpresa('user-1', 'Admin', 'rest-1');

      expect(result).toHaveProperty('accessToken', 'signed-token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockJwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', restaurantId: 'rest-1', role: 'ADMIN', name: 'Admin', type: 'full' },
        { expiresIn: '15m' },
      );
    });

    it('should throw ForbiddenException if user has no access to restaurantId', async () => {
      mockPrisma.userRestaurant.findUnique.mockResolvedValue(null);
      await expect(service.selectEmpresa('user-1', 'Admin', 'rest-other'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if refresh token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        restaurantId: 'rest-1',
        expiresAt: new Date(Date.now() - 1000),
        user: mockUser,
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should return new accessToken and refreshToken on valid token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        restaurantId: 'rest-1',
        expiresAt: new Date(Date.now() + 60_000),
        user: mockUser,
      });
      mockPrisma.userRestaurant.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('valid-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should delete the refresh token', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      await service.logout('some-token');
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-token' },
      });
    });
  });
});
```

- [ ] **Step 2: Rodar testes — verificar que falham**

```bash
cd gercoz-backend
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Esperado: FAIL — `service.selectEmpresa is not a function` e outros erros de API.

- [ ] **Step 3: Atualizar auth.service.ts**

Substituir o conteúdo completo de `gercoz-backend/src/auth/auth.service.ts`:

```typescript
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const memberships = await this.prisma.userRestaurant.findMany({
      where: { userId: user.id },
      include: { restaurant: true },
    });

    const partialToken = await this.jwt.signAsync(
      { sub: user.id, name: user.name, type: 'partial' },
      { expiresIn: '7d' },
    );

    const empresas = memberships.map((m) => ({
      id: m.restaurantId,
      nome: m.restaurant.name,
      role: m.role,
    }));

    return { partialToken, empresas };
  }

  async selectEmpresa(userId: string, userName: string, restaurantId: string) {
    const membership = await this.prisma.userRestaurant.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });
    if (!membership) throw new ForbiddenException('Acesso negado a esta empresa');

    return this.generateFullTokens(userId, userName, restaurantId, membership.role as string);
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');
    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    const membership = await this.prisma.userRestaurant.findUnique({
      where: { userId_restaurantId: { userId: stored.userId, restaurantId: stored.restaurantId } },
    });

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.generateFullTokens(
      stored.user.id,
      stored.user.name,
      stored.restaurantId,
      membership?.role as string ?? 'CASHIER',
    );
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async generateFullTokens(
    userId: string,
    userName: string,
    restaurantId: string,
    role: string,
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, restaurantId, role, name: userName, type: 'full' },
      { expiresIn: '15m' },
    );

    const rawToken = randomBytes(40).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        restaurantId,
        token: rawToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawToken };
  }
}
```

- [ ] **Step 4: Rodar testes — verificar que passam**

```bash
cd gercoz-backend
npx jest src/auth/auth.service.spec.ts --no-coverage
```

Esperado: PASS — 8 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/auth/auth.service.ts src/auth/auth.service.spec.ts
git commit -m "feat: update auth service — login returns partialToken+empresas, add selectEmpresa"
```

---

## Task 5: Backend — Controller, DTO e Module

**Files:**
- Create: `gercoz-backend/src/auth/dto/select-empresa.dto.ts`
- Modify: `gercoz-backend/src/auth/auth.controller.ts`
- Modify: `gercoz-backend/src/auth/auth.module.ts`

- [ ] **Step 1: Criar select-empresa.dto.ts**

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class SelectEmpresaDto {
  @IsString()
  @IsNotEmpty()
  restaurantId: string;
}
```

- [ ] **Step 2: Atualizar auth.controller.ts**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectEmpresaDto } from './dto/select-empresa.dto';
import { Public } from './decorators/public.decorator';
import { PartialJwtGuard } from './guards/partial-jwt.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(PartialJwtGuard)
  @Post('select-empresa')
  @HttpCode(HttpStatus.OK)
  selectEmpresa(
    @CurrentUser() user: { userId: string; name: string },
    @Body() dto: SelectEmpresaDto,
  ) {
    return this.authService.selectEmpresa(user.userId, user.name, dto.restaurantId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('token') token: string) {
    return this.authService.refresh(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body('token') token: string) {
    return this.authService.logout(token);
  }
}
```

- [ ] **Step 3: Atualizar auth.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PartialJwtStrategy } from './strategies/partial-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, PartialJwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 4: Rodar todos os testes de auth**

```bash
cd gercoz-backend
npx jest src/auth --no-coverage
```

Esperado: PASS — todos os testes passando.

- [ ] **Step 5: Testar manualmente o endpoint login**

Com o servidor rodando (`npm run start:dev`):

```bash
curl -s -X POST http://localhost:3333/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}' | jq .
```

Esperado:
```json
{
  "partialToken": "eyJ...",
  "empresas": [
    { "id": "...", "nome": "Restaurante Demo", "role": "ADMIN" },
    { "id": "...", "nome": "Lanchonete Beta", "role": "ADMIN" }
  ]
}
```

- [ ] **Step 6: Commit**

```bash
git add src/auth/dto/select-empresa.dto.ts \
        src/auth/auth.controller.ts \
        src/auth/auth.module.ts
git commit -m "feat: add POST /auth/select-empresa endpoint with PartialJwtGuard"
```

---

## Task 6: Frontend — Expandir AuthContext

**Files:**
- Modify: `gercoz-frontend/src/contexts/auth-context.tsx`

- [ ] **Step 1: Substituir auth-context.tsx**

```typescript
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface Empresa {
  id: string;
  nome: string;
  role: string;
}

interface User {
  userId: string;
  restaurantId: string;
  role: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  empresas: Empresa[];
  partialToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  selectEmpresa: (restaurantId: string) => Promise<void>;
  switchEmpresa: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

function decodeUser(token: string): User {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return {
    userId: payload.sub,
    restaurantId: payload.restaurantId,
    role: payload.role,
    name: payload.name ?? '',
  };
}

function setAccessTokenCookie(token: string) {
  document.cookie = `accessToken=${token}; path=/; max-age=900; SameSite=Strict`;
}

function setPartialTokenCookie(token: string) {
  document.cookie = `partialToken=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Strict`;
}

function clearCookies() {
  document.cookie = 'accessToken=; path=/; max-age=0';
  document.cookie = 'partialToken=; path=/; max-age=0';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [partialToken, setPartialToken] = useState<string | null>(null);

  useEffect(() => {
    // Restore full session
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      try {
        setUser(decodeUser(accessToken));
        setAccessTokenCookie(accessToken);
      } catch {
        localStorage.removeItem('accessToken');
      }
    }

    // Restore partial session
    const stored = localStorage.getItem('partialToken');
    const storedEmpresas = localStorage.getItem('empresas');
    if (stored && storedEmpresas) {
      try {
        setPartialToken(stored);
        setEmpresas(JSON.parse(storedEmpresas));
        setPartialTokenCookie(stored);
      } catch {
        localStorage.removeItem('partialToken');
        localStorage.removeItem('empresas');
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { partialToken: pt, empresas: emp } = data as { partialToken: string; empresas: Empresa[] };

    localStorage.setItem('partialToken', pt);
    localStorage.setItem('empresas', JSON.stringify(emp));
    setPartialTokenCookie(pt);
    setPartialToken(pt);
    setEmpresas(emp);
  };

  const selectEmpresa = async (restaurantId: string) => {
    const { data } = await api.post(
      '/auth/select-empresa',
      { restaurantId },
      { headers: { Authorization: `Bearer ${partialToken}` } },
    );
    const { accessToken, refreshToken } = data as { accessToken: string; refreshToken: string };

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setAccessTokenCookie(accessToken);
    setUser(decodeUser(accessToken));
  };

  const switchEmpresa = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    document.cookie = 'accessToken=; path=/; max-age=0';
    setUser(null);
    // partialToken e empresas permanecem — middleware vai redirecionar para /empresas
  };

  const logout = () => {
    const token = localStorage.getItem('refreshToken');
    if (token) api.post('/auth/logout', { token }).catch(() => {});
    localStorage.clear();
    clearCookies();
    setUser(null);
    setPartialToken(null);
    setEmpresas([]);
  };

  return (
    <AuthContext.Provider value={{ user, empresas, partialToken, login, selectEmpresa, switchEmpresa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 2: Verificar que não há erros de TypeScript**

```bash
cd gercoz-frontend
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/auth-context.tsx
git commit -m "feat: expand AuthContext with partialToken, empresas, selectEmpresa, switchEmpresa"
```

---

## Task 7: Frontend — Página /empresas

**Files:**
- Create: `gercoz-frontend/src/app/empresas/page.tsx`

- [ ] **Step 1: Criar a pasta e o arquivo**

```bash
mkdir -p gercoz-frontend/src/app/empresas
```

- [ ] **Step 2: Criar empresas/page.tsx**

```typescript
'use client';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CASHIER: 'Caixa',
  COOK: 'Cozinheiro',
};

export default function EmpresasPage() {
  const { empresas, selectEmpresa, logout } = useAuth();
  const router = useRouter();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (restaurantId: string) => {
    setSelecting(restaurantId);
    setError(null);
    try {
      await selectEmpresa(restaurantId);
      router.push('/modulos');
    } catch {
      setError('Não foi possível acessar esta empresa. Tente novamente.');
      setSelecting(null);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-sm">Selecione a empresa</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
        >
          Sair
        </button>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-6">
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              onClick={() => handleSelect(empresa.id)}
              disabled={selecting !== null}
              className="bg-white border border-gray-200 rounded-xl p-6 text-left hover:border-gray-400 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <div className="text-sm font-semibold mb-1">{empresa.nome}</div>
              <div className="text-xs text-gray-500">
                {ROLE_LABELS[empresa.role] ?? empresa.role}
              </div>
              {selecting === empresa.id && (
                <div className="text-xs text-gray-400 mt-2">Acessando...</div>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que não há erros de TypeScript**

```bash
cd gercoz-frontend
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/app/empresas/page.tsx
git commit -m "feat: add /empresas page for company selection"
```

---

## Task 8: Frontend — Atualizar Middleware

**Files:**
- Modify: `gercoz-frontend/src/middleware.ts`

- [ ] **Step 1: Substituir middleware.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;
  const partialToken = request.cookies.get('partialToken')?.value;

  // /auth: redireciona se já autenticado
  if (pathname.startsWith('/auth')) {
    if (accessToken) return NextResponse.redirect(new URL('/modulos', request.url));
    if (partialToken) return NextResponse.redirect(new URL('/empresas', request.url));
    return NextResponse.next();
  }

  // /empresas: requer partialToken
  if (pathname.startsWith('/empresas')) {
    if (!partialToken) return NextResponse.redirect(new URL('/auth', request.url));
    return NextResponse.next();
  }

  // Demais rotas: requer accessToken (full)
  if (!accessToken) {
    if (partialToken) return NextResponse.redirect(new URL('/empresas', request.url));
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

- [ ] **Step 2: Verificar que não há erros de TypeScript**

```bash
cd gercoz-frontend
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: update middleware — route /empresas with partialToken, protect all other routes"
```

---

## Task 9: Frontend — /auth redirect + switcher em /modulos

**Files:**
- Modify: `gercoz-frontend/src/app/auth/page.tsx`
- Modify: `gercoz-frontend/src/app/modulos/page.tsx`

- [ ] **Step 1: Atualizar auth/page.tsx — redirecionar para /empresas**

Alterar apenas a linha de redirect dentro de `onSubmit` em `gercoz-frontend/src/app/auth/page.tsx`:

```typescript
// Linha 32 — substituir:
router.push('/modulos');
// Por:
router.push('/empresas');
```

- [ ] **Step 2: Atualizar modulos/page.tsx — adicionar switcher de empresa**

Substituir o conteúdo completo de `gercoz-frontend/src/app/modulos/page.tsx`:

```typescript
'use client';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CASHIER: 'Caixa',
  COOK: 'Cozinheiro',
};

interface Module {
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

const MODULE_CONFIG: Record<string, Module[]> = {
  ADMIN: [
    { title: 'Dashboard', subtitle: 'Análises', icon: '📊', href: '/dashboard' },
    { title: 'Produtos', subtitle: 'Cardápio', icon: '🍽️', href: '/products' },
    { title: 'Ingredientes', subtitle: 'Estoque', icon: '🧂', href: '/ingredients' },
    { title: 'PDV', subtitle: 'Ponto de venda', icon: '🛒', href: '/pdv' },
    { title: 'Pedidos', subtitle: 'Em aberto', icon: '📋', href: '/pdv/orders' },
    { title: 'Cardápio', subtitle: 'Menu digital', icon: '🍕', href: '/menu' },
    { title: 'KDS', subtitle: 'Cozinha', icon: '👨‍🍳', href: '/kds' },
  ],
  CASHIER: [
    { title: 'PDV', subtitle: 'Ponto de venda', icon: '🛒', href: '/pdv' },
    { title: 'Pedidos', subtitle: 'Em aberto', icon: '📋', href: '/pdv/orders' },
    { title: 'Cardápio', subtitle: 'Menu digital', icon: '🍕', href: '/menu' },
  ],
  COOK: [
    { title: 'KDS', subtitle: 'Cozinha', icon: '👨‍🍳', href: '/kds' },
  ],
};

export default function ModulosPage() {
  const { user, switchEmpresa, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const modules = MODULE_CONFIG[user.role] ?? [];
  const colsClass = modules.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3';

  const handleSwitch = () => {
    switchEmpresa();
    router.push('/empresas');
  };

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm">{user.name}</span>
          <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSwitch}
            className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
          >
            Trocar empresa
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-65px)] px-6">
        <p className="text-sm text-gray-500 mb-8">Selecione um módulo</p>
        <div className={`grid ${colsClass} gap-4 w-full max-w-lg`}>
          {modules.map((mod) => (
            <button
              key={mod.href}
              onClick={() => router.push(mod.href)}
              className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-gray-400 hover:shadow-sm transition-all"
            >
              <div className="text-3xl mb-2">{mod.icon}</div>
              <div className="text-sm font-semibold">{mod.title}</div>
              <div className="text-xs text-gray-500 mt-1">{mod.subtitle}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que não há erros de TypeScript**

```bash
cd gercoz-frontend
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Rodar todos os testes do backend para garantir que nada quebrou**

```bash
cd gercoz-backend
npx jest --no-coverage
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit final**

```bash
cd gercoz-frontend
git add src/app/auth/page.tsx src/app/modulos/page.tsx
git commit -m "feat: redirect to /empresas after login, add company switcher in /modulos header"
```

---

## Task 10: Backend — Atualizar RestaurantsService para novo schema

**Files:**
- Modify: `gercoz-backend/src/restaurants/restaurants.service.ts`
- Modify: `gercoz-backend/src/restaurants/restaurants.service.spec.ts`

> Esta task deve ser executada junto com a Task 1 (schema) — após a migração, o `POST /restaurants` quebraria sem esta correção.

- [ ] **Step 1: Atualizar restaurants.service.spec.ts**

Substituir o conteúdo completo de `gercoz-backend/src/restaurants/restaurants.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantsService } from './restaurants.service';
import { PrismaService } from '../common/prisma.service';
import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

const mockPrisma = {
  restaurant: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

describe('RestaurantsService', () => {
  let service: RestaurantsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RestaurantsService>(RestaurantsService);
  });

  it('should throw ConflictException if slug already exists', async () => {
    mockPrisma.restaurant.findUnique.mockResolvedValue({ id: 'r1', slug: 'my-resto' });
    await expect(
      service.create({
        restaurantName: 'My Resto',
        slug: 'my-resto',
        adminName: 'Admin',
        adminEmail: 'admin@test.com',
        adminPassword: 'secret123',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create restaurant, admin user and UserRestaurant in a transaction', async () => {
    mockPrisma.restaurant.findUnique.mockResolvedValue(null);
    const fakeRestaurant = { id: 'rest-1', slug: 'new-resto', name: 'New Resto' };
    const fakeUser = { id: 'u1' };
    const txMock = {
      restaurant: { create: jest.fn().mockResolvedValue(fakeRestaurant) },
      user: { create: jest.fn().mockResolvedValue(fakeUser) },
      userRestaurant: { create: jest.fn().mockResolvedValue({ userId: 'u1', restaurantId: 'rest-1', role: UserRole.ADMIN }) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));

    const result = await service.create({
      restaurantName: 'New Resto',
      slug: 'new-resto',
      adminName: 'Admin',
      adminEmail: 'admin@test.com',
      adminPassword: 'secret123',
    });

    expect(result).toMatchObject({ id: 'rest-1', slug: 'new-resto' });
    expect(txMock.userRestaurant.create).toHaveBeenCalledWith({
      data: { userId: 'u1', restaurantId: 'rest-1', role: UserRole.ADMIN },
    });
  });
});
```

- [ ] **Step 2: Rodar teste — verificar que falha**

```bash
cd gercoz-backend
npx jest src/restaurants --no-coverage
```

Esperado: FAIL — `txMock.userRestaurant.create is not a function` ou similar.

- [ ] **Step 3: Atualizar restaurants.service.ts**

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

@Injectable()
export class RestaurantsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRestaurantDto) {
    const existing = await this.prisma.restaurant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);

    const restaurant = await this.prisma.$transaction(async (tx) => {
      const rest = await tx.restaurant.create({
        data: { name: dto.restaurantName, slug: dto.slug },
      });

      const user = await tx.user.create({
        data: {
          name: dto.adminName,
          email: dto.adminEmail,
          password: hashedPassword,
        },
      });

      await tx.userRestaurant.create({
        data: { userId: user.id, restaurantId: rest.id, role: UserRole.ADMIN },
      });

      return rest;
    });

    return restaurant;
  }
}
```

- [ ] **Step 4: Rodar teste — verificar que passa**

```bash
cd gercoz-backend
npx jest src/restaurants --no-coverage
```

Esperado: PASS — 2 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/restaurants/restaurants.service.ts src/restaurants/restaurants.service.spec.ts
git commit -m "feat: update RestaurantsService to create UserRestaurant on registration"
```

---

## Smoke Test Manual

Após implementar todas as tasks, validar o fluxo completo:

1. Acessar `/auth` — tela de login aparece
2. Login com `admin@demo.com / admin123` — deve ir para `/empresas`
3. Página `/empresas` mostra 2 cards: "Restaurante Demo — Admin" e "Lanchonete Beta — Admin"
4. Clicar em "Restaurante Demo" — vai para `/modulos` com os 7 módulos do ADMIN
5. Clicar "Trocar empresa" — volta para `/empresas`
6. Clicar em "Lanchonete Beta" — vai para `/modulos` novamente
7. Clicar "Sair" — vai para `/auth`, cookies limpos
8. Login com `caixa@demo.com / cashier123` — vai para `/empresas` com 1 card
9. Clicar no card — vai para `/modulos` com 3 módulos do CASHIER
10. Tentar acessar `/empresas` diretamente estando logado (com accessToken) — deve redirecionar para `/modulos`
