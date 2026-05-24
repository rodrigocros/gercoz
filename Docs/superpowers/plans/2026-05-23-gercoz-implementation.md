# SisGerCoz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SisGerCoz MVP — a multi-tenant restaurant management system with NestJS backend and Next.js 14 frontend.

**Architecture:** Two separate repos (gercoz-backend, gercoz-frontend). Backend uses NestJS + Prisma + SQLite with multi-tenant isolation via AsyncLocalStorage. Frontend uses Next.js 14 App Router with TanStack Query for data fetching and Socket.io for real-time updates.

**Tech Stack:** NestJS, Prisma, SQLite, JWT, Socket.io, Next.js 14 App Router, Shadcn/ui, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts

---

## Part 1: Backend

---

### Task 1: Backend project setup

**Files:**
- Create: `gercoz-backend/src/main.ts`
- Create: `gercoz-backend/tsconfig.json`

- [ ] **Step 1: Scaffold the NestJS project**

```bash
npx @nestjs/cli new gercoz-backend --package-manager npm
cd gercoz-backend
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm i @nestjs/jwt @nestjs/passport passport passport-jwt @prisma/client prisma \
  bcryptjs class-validator class-transformer @nestjs/config \
  @nestjs/event-emitter @nestjs/websockets @nestjs/platform-socket.io socket.io
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm i -D @types/bcryptjs @types/passport-jwt prisma
```

- [ ] **Step 4: Initialise Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 5: Update `tsconfig.json`**

Ensure these compiler options are present:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false
  }
}
```

- [ ] **Step 6: Write `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3001);
}
bootstrap();
```

- [ ] **Step 7: Commit**

```bash
git init && git add . && git commit -m "chore: scaffold NestJS backend"
```

---

### Task 2: Prisma schema + first migration

**Files:**
- Create: `gercoz-backend/prisma/schema.prisma`

- [ ] **Step 1: Write the complete `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
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
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  phone       String?
  address     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]
  ingredients Ingredient[]
  categories  Category[]
  products    Product[]
  orders      Order[]
}

model User {
  id           String    @id @default(cuid())
  restaurantId String
  name         String
  email        String
  password     String
  role         UserRole  @default(CASHIER)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  restaurant            Restaurant             @relation(fields: [restaurantId], references: [id])
  refreshTokens         RefreshToken[]
  orders                Order[]
  ingredientPriceHistory IngredientPriceHistory[]

  @@unique([restaurantId, email])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

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

  restaurant   Restaurant             @relation(fields: [restaurantId], references: [id])
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

  ingredient Ingredient @relation(fields: [ingredientId], references: [id])
  user       User       @relation(fields: [changedBy], references: [id])
}

model Category {
  id           String   @id @default(cuid())
  restaurantId String
  name         String
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)

  restaurant Restaurant @relation(fields: [restaurantId], references: [id])
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

  restaurant  Restaurant  @relation(fields: [restaurantId], references: [id])
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

  restaurant Restaurant  @relation(fields: [restaurantId], references: [id])
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

- [ ] **Step 2: Run the initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration applied, `prisma/migrations/` folder created.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` types regenerated.

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "chore: add Prisma schema and initial migration"
```

---

### Task 3: PrismaService + Multi-tenant AsyncLocalStorage middleware

**Files:**
- Create: `src/common/tenant.context.ts`
- Create: `src/common/prisma.service.ts`
- Create: `src/common/common.module.ts`
- Test: `src/common/prisma.service.spec.ts`

- [ ] **Step 1: Write the failing unit test**

`src/common/prisma.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { tenantStorage } from './tenant.context';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose tenantStorage', () => {
    // Verify tenantStorage is an AsyncLocalStorage instance
    expect(tenantStorage).toBeDefined();
    expect(typeof tenantStorage.run).toBe('function');
  });

  it('should run tenant context and retrieve restaurantId', (done) => {
    tenantStorage.run({ restaurantId: 'rest-abc' }, () => {
      const ctx = tenantStorage.getStore();
      expect(ctx?.restaurantId).toBe('rest-abc');
      done();
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test -- prisma.service.spec
```

Expected: FAIL — `Cannot find module './prisma.service'`

- [ ] **Step 3: Implement `src/common/tenant.context.ts`**

```typescript
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  restaurantId: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();
```

- [ ] **Step 4: Implement `src/common/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { tenantStorage } from './tenant.context';

// Operations that support a `where` clause and should be tenant-scoped
const TENANT_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

// Models that belong to a restaurant (have restaurantId field)
const TENANT_MODELS = new Set([
  'User',
  'Ingredient',
  'IngredientPriceHistory',
  'Category',
  'Product',
  'RecipeItem',
  'Order',
  'OrderItem',
  'RefreshToken',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();

    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      const ctx = tenantStorage.getStore();

      if (ctx?.restaurantId && TENANT_OPERATIONS.has(params.action) && TENANT_MODELS.has(params.model)) {
        params.args = params.args ?? {};
        params.args.where = {
          ...(params.args.where ?? {}),
          restaurantId: ctx.restaurantId,
        };
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 5: Implement `src/common/common.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class CommonModule {}
```

- [ ] **Step 6: Run**

```bash
npm run test -- prisma.service.spec
```

Expected: PASS — all 3 tests green.

- [ ] **Step 7: Commit**

```bash
git add . && git commit -m "feat: add PrismaService with multi-tenant AsyncLocalStorage middleware"
```

---

### Task 4: Auth module (JWT + refresh tokens)

**Files:**
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/dto/register-restaurant.dto.ts`
- Create: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/auth/guards/jwt-auth.guard.ts`
- Create: `src/auth/guards/roles.guard.ts`
- Create: `src/auth/decorators/roles.decorator.ts`
- Create: `src/auth/decorators/current-user.decorator.ts`
- Create: `src/auth/decorators/public.decorator.ts`
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`
- Test: `src/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

`src/auth/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const mockUser = {
  id: 'user-1',
  restaurantId: 'rest-1',
  email: 'admin@test.com',
  password: bcrypt.hashSync('secret123', 10),
  role: 'ADMIN',
  isActive: true,
  name: 'Admin',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
  },
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
    it('should return access and refresh tokens on valid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'admin@test.com', password: 'secret123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
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

  describe('refresh', () => {
    it('should throw UnauthorizedException if refresh token not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        expiresAt: new Date(Date.now() - 1000),
        user: mockUser,
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
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

- [ ] **Step 2: Run**

```bash
npm run test -- auth.service.spec
```

Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Implement DTOs and decorators**

`src/auth/dto/login.dto.ts`:

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
```

`src/auth/dto/register-restaurant.dto.ts`:

```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class RegisterRestaurantDto {
  @IsString() @MinLength(2) restaurantName: string;
  @IsString() @MinLength(2) slug: string;
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
```

`src/auth/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

`src/auth/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

`src/auth/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 4: Implement guards and strategy**

`src/auth/guards/jwt-auth.guard.ts`:

```typescript
import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

`src/auth/guards/roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.role);
  }
}
```

`src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  validate(payload: { sub: string; restaurantId: string; role: string }) {
    return { userId: payload.sub, restaurantId: payload.restaurantId, role: payload.role };
  }
}
```

- [ ] **Step 5: Implement `src/auth/auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
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

    return this.generateTokens(user);
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

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.generateTokens(stored.user);
  }

  async logout(token: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  private async generateTokens(user: { id: string; restaurantId: string; role: string }) {
    const payload = { sub: user.id, restaurantId: user.restaurantId, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });

    const rawToken = randomBytes(40).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: rawToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken: rawToken };
  }
}
```

- [ ] **Step 6: Implement `src/auth/auth.controller.ts`**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

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
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('token') token: string) {
    return this.authService.refresh(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body('token') token: string) {
    return this.authService.logout(token);
  }
}
```

- [ ] **Step 7: Implement `src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

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
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 8: Update `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    CommonModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 9: Run**

```bash
npm run test -- auth.service.spec
```

Expected: PASS — all 6 tests green.

- [ ] **Step 10: Commit**

```bash
git add . && git commit -m "feat: add Auth module with JWT access/refresh tokens"
```

---

### Task 5: Restaurants module

**Files:**
- Create: `src/restaurants/dto/create-restaurant.dto.ts`
- Create: `src/restaurants/restaurants.service.ts`
- Create: `src/restaurants/restaurants.controller.ts`
- Create: `src/restaurants/restaurants.module.ts`
- Test: `src/restaurants/restaurants.service.spec.ts`

- [ ] **Step 1: Write the failing test**

`src/restaurants/restaurants.service.spec.ts`:

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

  it('should create restaurant and admin user in a transaction', async () => {
    mockPrisma.restaurant.findUnique.mockResolvedValue(null);
    const fakeRestaurant = { id: 'rest-1', slug: 'new-resto', name: 'New Resto' };
    mockPrisma.$transaction.mockImplementation(async (fn) => fn({
      restaurant: { create: jest.fn().mockResolvedValue(fakeRestaurant) },
      user: { create: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.ADMIN }) },
    }));

    const result = await service.create({
      restaurantName: 'New Resto',
      slug: 'new-resto',
      adminName: 'Admin',
      adminEmail: 'admin@test.com',
      adminPassword: 'secret123',
    });

    expect(result).toMatchObject({ id: 'rest-1', slug: 'new-resto' });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test -- restaurants.service.spec
```

Expected: FAIL — `Cannot find module './restaurants.service'`

- [ ] **Step 3: Implement `src/restaurants/dto/create-restaurant.dto.ts`**

```typescript
import { IsString, MinLength, IsEmail } from 'class-validator';

export class CreateRestaurantDto {
  @IsString() @MinLength(2) restaurantName: string;
  @IsString() @MinLength(2) slug: string;
  @IsString() @MinLength(2) adminName: string;
  @IsEmail() adminEmail: string;
  @IsString() @MinLength(6) adminPassword: string;
}
```

- [ ] **Step 4: Implement `src/restaurants/restaurants.service.ts`**

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

      await tx.user.create({
        data: {
          restaurantId: rest.id,
          name: dto.adminName,
          email: dto.adminEmail,
          password: hashedPassword,
          role: UserRole.ADMIN,
        },
      });

      return rest;
    });

    return restaurant;
  }
}
```

- [ ] **Step 5: Implement `src/restaurants/restaurants.controller.ts`**

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private restaurantsService: RestaurantsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(dto);
  }
}
```

- [ ] **Step 6: Implement `src/restaurants/restaurants.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { RestaurantsController } from './restaurants.controller';

@Module({
  providers: [RestaurantsService],
  controllers: [RestaurantsController],
})
export class RestaurantsModule {}
```

- [ ] **Step 7: Register in `src/app.module.ts`**

Add `RestaurantsModule` to the imports array:

```typescript
import { RestaurantsModule } from './restaurants/restaurants.module';
// ... existing imports ...
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  EventEmitterModule.forRoot(),
  CommonModule,
  AuthModule,
  RestaurantsModule,   // <-- add this
],
```

- [ ] **Step 8: Run**

```bash
npm run test -- restaurants.service.spec
```

Expected: PASS — all 2 tests green.

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: add Restaurants module with transactional restaurant+user creation"
```

---

### Task 6: Ingredients module (backend)

**Files:**
- Create: `src/ingredients/dto/create-ingredient.dto.ts`
- Create: `src/ingredients/dto/update-ingredient.dto.ts`
- Create: `src/ingredients/ingredients.service.ts`
- Create: `src/ingredients/ingredients.controller.ts`
- Create: `src/ingredients/ingredients.module.ts`
- Test: `src/ingredients/ingredients.service.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

`src/ingredients/ingredients.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../common/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';

const existingIngredient = {
  id: 'ing-1',
  restaurantId: 'rest-1',
  name: 'Flour',
  unit: Unit.KG,
  costPrice: 2.5,
  stock: 10,
  minStock: 2,
  isActive: true,
  description: null,
  supplier: null,
  expiryDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  ingredient: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ingredientPriceHistory: {
    create: jest.fn(),
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('IngredientsService', () => {
  let service: IngredientsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get<IngredientsService>(IngredientsService);
  });

  describe('update', () => {
    it('should emit ingredient.price_updated when costPrice changes', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({
        ...existingIngredient,
        costPrice: 3.5,
      });
      mockPrisma.ingredientPriceHistory.create.mockResolvedValue({});

      await service.update('ing-1', { costPrice: 3.5 }, 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('ingredient.price_updated', {
        ingredientId: 'ing-1',
        newCostPrice: 3.5,
      });
    });

    it('should create IngredientPriceHistory when costPrice changes', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({
        ...existingIngredient,
        costPrice: 4.0,
      });
      mockPrisma.ingredientPriceHistory.create.mockResolvedValue({});

      await service.update('ing-1', { costPrice: 4.0 }, 'user-1');

      expect(mockPrisma.ingredientPriceHistory.create).toHaveBeenCalledWith({
        data: {
          ingredientId: 'ing-1',
          price: 4.0,
          changedBy: 'user-1',
        },
      });
    });

    it('should NOT emit event when costPrice is unchanged', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue(existingIngredient);

      await service.update('ing-1', { name: 'Wheat Flour' }, 'user-1');

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockPrisma.ingredientPriceHistory.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if ingredient does not exist', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      await expect(service.update('bad-id', { name: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete ingredient by setting isActive=false', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({ ...existingIngredient, isActive: false });

      await service.remove('ing-1');

      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({
        where: { id: 'ing-1' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if ingredient does not exist', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test -- ingredients.service.spec
```

Expected: FAIL — `Cannot find module './ingredients.service'`

- [ ] **Step 3: Implement DTOs**

`src/ingredients/dto/create-ingredient.dto.ts`:

```typescript
import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Unit } from '@prisma/client';

export class CreateIngredientDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(Unit) unit: Unit;
  @IsNumber() @Min(0) costPrice: number;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsNumber() @Min(0) stock?: number;
  @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @IsOptional() isActive?: boolean;
}
```

`src/ingredients/dto/update-ingredient.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateIngredientDto } from './create-ingredient.dto';

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {}
```

- [ ] **Step 4: Implement `src/ingredients/ingredients.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(query: { isActive?: boolean; name?: string }) {
    return this.prisma.ingredient.findMany({
      where: {
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.name ? { name: { contains: query.name } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id },
      include: { priceHistory: { orderBy: { changedAt: 'desc' }, take: 10 } },
    });
    if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);
    return ingredient;
  }

  async create(dto: CreateIngredientDto, _userId: string) {
    return this.prisma.ingredient.create({ data: dto });
  }

  async update(id: string, dto: UpdateIngredientDto, userId: string) {
    const existing = await this.prisma.ingredient.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException(`Ingredient ${id} not found`);

    const priceChanged =
      dto.costPrice !== undefined && dto.costPrice !== existing.costPrice;

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: dto,
    });

    if (priceChanged) {
      await this.prisma.ingredientPriceHistory.create({
        data: { ingredientId: id, price: dto.costPrice!, changedBy: userId },
      });
      this.eventEmitter.emit('ingredient.price_updated', {
        ingredientId: id,
        newCostPrice: dto.costPrice,
      });
    }

    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.ingredient.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException(`Ingredient ${id} not found`);
    return this.prisma.ingredient.update({ where: { id }, data: { isActive: false } });
  }
}
```

- [ ] **Step 5: Implement `src/ingredients/ingredients.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('ingredients')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class IngredientsController {
  constructor(private ingredientsService: IngredientsService) {}

  @Get()
  findAll(@Query() query: { isActive?: boolean; name?: string }) {
    return this.ingredientsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateIngredientDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ingredientsService.create(dto, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.ingredientsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.ingredientsService.remove(id);
  }
}
```

- [ ] **Step 6: Implement `src/ingredients/ingredients.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { IngredientsController } from './ingredients.controller';

@Module({
  providers: [IngredientsService],
  controllers: [IngredientsController],
})
export class IngredientsModule {}
```

- [ ] **Step 7: Register in `src/app.module.ts`**

Add `IngredientsModule` to the imports array:

```typescript
import { IngredientsModule } from './ingredients/ingredients.module';
// ... existing imports ...
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  EventEmitterModule.forRoot(),
  CommonModule,
  AuthModule,
  RestaurantsModule,
  IngredientsModule,   // <-- add this
],
```

- [ ] **Step 8: Run**

```bash
npm run test -- ingredients.service.spec
```

Expected: PASS — all 6 tests green.

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: add Ingredients module with soft delete and price history tracking"
```

---

*End of Part 1 (Tasks 1–6). Continue with Part 2 for Categories, Products, Orders, and WebSocket gateway.*
## Part 1 Continued: Backend (Tasks 7–11)

---

### Task 7: Products Module + Categories Module

**Files:**
- Create: `src/products/dto/create-product.dto.ts`
- Create: `src/products/dto/update-product.dto.ts`
- Create: `src/products/products.service.ts`
- Create: `src/products/products.controller.ts`
- Create: `src/products/products.module.ts`
- Create: `src/categories/categories.service.ts`
- Create: `src/categories/categories.controller.ts`
- Create: `src/categories/categories.module.ts`
- Test: `src/products/products.service.spec.ts`

---

- [ ] **Step 1: Write the failing tests**

`src/products/products.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recipeItem: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  describe('computeCost', () => {
    it('sums quantity * costPrice for all recipe items', async () => {
      const mockProduct = {
        id: 'prod-1',
        recipeItems: [
          { quantity: 0.5, ingredient: { costPrice: 10 } },
          { quantity: 2, ingredient: { costPrice: 3 } },
        ],
      };
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue(mockProduct);

      const cost = await service.computeCost('prod-1');

      // 0.5*10 + 2*3 = 5 + 6 = 11
      expect(cost).toBe(11);
    });

    it('returns 0 when there are no recipe items', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue({
        id: 'prod-2',
        recipeItems: [],
      });

      const cost = await service.computeCost('prod-2');
      expect(cost).toBe(0);
    });
  });

  describe('create', () => {
    it('creates product with recipe items in a transaction', async () => {
      const dto = {
        name: 'Pizza Margherita',
        salePrice: 45.0,
        recipeItems: [
          { ingredientId: 'ing-1', quantity: 0.4, unit: 'KG' },
          { ingredientId: 'ing-2', quantity: 0.2, unit: 'KG' },
        ],
      };

      const createdProduct = { id: 'prod-new', ...dto };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          product: { create: jest.fn().mockResolvedValue(createdProduct) },
        };
        return fn(txMock);
      });

      const result = await service.create(dto as any);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(createdProduct);
    });
  });

  describe('findAll', () => {
    it('computes margin, marginPct and roi for each product', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'X-Burguer',
          salePrice: 18,
          category: { name: 'Lanches' },
          recipeItems: [
            { quantity: 1, ingredient: { costPrice: 1.5 } },
            { quantity: 0.1, ingredient: { costPrice: 35 } },
          ],
        },
      ]);

      const result = await service.findAll();

      // costPrice = 1*1.5 + 0.1*35 = 1.5 + 3.5 = 5
      // margin = 18 - 5 = 13
      // marginPct = (13/18)*100 ≈ 72.22
      // roi = (13/5)*100 = 260
      expect(result[0].costPrice).toBeCloseTo(5);
      expect(result[0].margin).toBeCloseTo(13);
      expect(result[0].marginPct).toBeCloseTo(72.22, 1);
      expect(result[0].roi).toBeCloseTo(260);
    });
  });

  describe('update', () => {
    it('deletes and recreates recipe items when recipeItems is provided', async () => {
      const dto = {
        name: 'Updated',
        recipeItems: [{ ingredientId: 'ing-1', quantity: 1, unit: 'UN' }],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          recipeItem: { deleteMany: jest.fn() },
          product: {
            update: jest.fn().mockResolvedValue({ id: 'prod-1', ...dto }),
          },
        };
        return fn(txMock);
      });

      const result = await service.update('prod-1', dto as any);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('soft deletes product by setting isActive=false', async () => {
      mockPrisma.product.update.mockResolvedValue({ id: 'prod-1', isActive: false });

      await service.remove('prod-1');

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
    });
  });
});
```

---

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=products.service
```

Expected: `FAIL src/products/products.service.spec.ts` — "Cannot find module './products.service'"

---

- [ ] **Step 3: Implement**

`src/products/dto/create-product.dto.ts`:

```typescript
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Unit } from '@prisma/client';

export class RecipeItemDto {
  @IsString()
  ingredientId: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(Unit)
  unit: Unit;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsOptional()
  @IsNumber()
  preparationTime?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  recipeItems: RecipeItemDto[];
}
```

`src/products/dto/update-product.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

`src/products/products.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface ProductMetrics {
  id: string;
  name: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
  roi: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCost(productId: string): Promise<number> {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { recipeItems: { include: { ingredient: true } } },
    });
    return product.recipeItems.reduce(
      (sum, item) => sum + item.quantity * item.ingredient.costPrice,
      0,
    );
  }

  private calcMetrics(product: {
    id: string;
    name: string;
    salePrice: number;
    category?: { name: string } | null;
    recipeItems: { quantity: number; ingredient: { costPrice: number } }[];
  }): ProductMetrics {
    const costPrice = product.recipeItems.reduce(
      (sum, item) => sum + item.quantity * item.ingredient.costPrice,
      0,
    );
    const margin = product.salePrice - costPrice;
    const marginPct =
      product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
    const roi = costPrice > 0 ? (margin / costPrice) * 100 : 0;
    return {
      id: product.id,
      name: product.name,
      categoryName: product.category?.name ?? 'Sem Categoria',
      costPrice,
      salePrice: product.salePrice,
      margin,
      marginPct,
      roi,
    };
  }

  async findAll(): Promise<ProductMetrics[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => this.calcMetrics(p));
  }

  async findOne(id: string) {
    return this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
    });
  }

  async getTechnicalSheet(id: string) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
    });

    const ingredients = product.recipeItems.map((item) => {
      const unitCost = item.ingredient.costPrice;
      const partialCost = item.quantity * unitCost;
      return {
        name: item.ingredient.name,
        quantity: item.quantity,
        unit: item.unit,
        unitCost,
        partialCost,
      };
    });

    const totalCost = ingredients.reduce((s, i) => s + i.partialCost, 0);
    const margin = product.salePrice - totalCost;
    const marginPct =
      product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
    const roi = totalCost > 0 ? (margin / totalCost) * 100 : 0;

    return {
      name: product.name,
      categoryName: product.category?.name ?? 'Sem Categoria',
      preparationTime: product.preparationTime,
      description: product.description,
      ingredients,
      totalCost,
      salePrice: product.salePrice,
      margin,
      marginPct,
      roi,
    };
  }

  async create(dto: CreateProductDto) {
    const { recipeItems, ...productData } = dto;
    return this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          ...productData,
          recipeItems: {
            create: recipeItems.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          },
        },
        include: {
          category: true,
          recipeItems: { include: { ingredient: true } },
        },
      });
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const { recipeItems, ...productData } = dto;

    if (recipeItems !== undefined) {
      return this.prisma.$transaction(async (tx) => {
        await tx.recipeItem.deleteMany({ where: { productId: id } });
        return tx.product.update({
          where: { id },
          data: {
            ...productData,
            recipeItems: {
              create: recipeItems.map((item) => ({
                ingredientId: item.ingredientId,
                quantity: item.quantity,
                unit: item.unit,
              })),
            },
          },
          include: {
            category: true,
            recipeItems: { include: { ingredient: true } },
          },
        });
      });
    }

    return this.prisma.product.update({
      where: { id },
      data: productData,
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

`src/products/products.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/ficha-tecnica')
  getTechnicalSheet(@Param('id') id: string) {
    return this.productsService.getTechnicalSheet(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
```

`src/categories/categories.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }
}
```

`src/categories/categories.controller.ts`:

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { CategoriesService, CreateCategoryDto } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }
}
```

`src/products/products.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

`src/categories/categories.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
```

Register both in `src/app.module.ts`:

```typescript
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';

// inside @Module imports array:
imports: [
  // ... existing modules ...
  ProductsModule,
  CategoriesModule,
],
```

---

- [ ] **Step 4: Verify passes**

```bash
npm run test -- --testPathPattern=products.service
```

Expected: `PASS src/products/products.service.spec.ts` — 6 tests passing.

---

- [ ] **Step 5: Commit**

```bash
git add src/products/ src/categories/
git commit -m "feat: add products and categories modules with TDD"
```

---

### Task 8: Menu Module

**Files:**
- Create: `src/menu/dto/menu-category.dto.ts`
- Create: `src/menu/menu.service.ts`
- Create: `src/menu/menu.controller.ts`
- Create: `src/menu/menu.module.ts`
- Test: `src/menu/menu.service.spec.ts`

---

- [ ] **Step 1: Write the failing tests**

`src/menu/menu.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
};

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('groups active products by category', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'X-Burguer',
          description: null,
          salePrice: 18,
          preparationTime: 15,
          isActive: true,
          category: { name: 'Lanches' },
        },
        {
          id: 'p2',
          name: 'Pizza',
          description: null,
          salePrice: 45,
          preparationTime: 25,
          isActive: true,
          category: { name: 'Pizzas' },
        },
        {
          id: 'p3',
          name: 'X-Salada',
          description: null,
          salePrice: 20,
          preparationTime: 12,
          isActive: true,
          category: { name: 'Lanches' },
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      const lanches = result.find((c) => c.category === 'Lanches');
      expect(lanches).toBeDefined();
      expect(lanches!.products).toHaveLength(2);
    });

    it('only returns active products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Active',
          description: null,
          salePrice: 10,
          preparationTime: 5,
          isActive: true,
          category: { name: 'Cat' },
        },
      ]);

      const result = await service.findAll();

      // findMany is called with where: { isActive: true }
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
      expect(result[0].products).toHaveLength(1);
    });

    it('assigns "Sem Categoria" for products without a category', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Orphan',
          description: null,
          salePrice: 5,
          preparationTime: 5,
          isActive: true,
          category: null,
        },
      ]);

      const result = await service.findAll();

      expect(result[0].category).toBe('Sem Categoria');
    });
  });

  describe('toggle', () => {
    it('flips isActive from true to false', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        isActive: true,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', isActive: false });

      await service.toggle('p1');

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isActive: false },
      });
    });

    it('flips isActive from false to true', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        isActive: false,
      });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', isActive: true });

      await service.toggle('p1');

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isActive: true },
      });
    });
  });
});
```

---

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=menu.service
```

Expected: `FAIL src/menu/menu.service.spec.ts` — "Cannot find module './menu.service'"

---

- [ ] **Step 3: Implement**

`src/menu/dto/menu-category.dto.ts`:

```typescript
export interface MenuProductDto {
  id: string;
  name: string;
  description: string | null;
  salePrice: number;
  preparationTime: number;
  isActive: boolean;
}

export interface MenuCategoryDto {
  category: string;
  products: MenuProductDto[];
}
```

`src/menu/menu.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MenuCategoryDto } from './dto/menu-category.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MenuCategoryDto[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    const grouped = products.reduce(
      (acc, product) => {
        const catName = product.category?.name ?? 'Sem Categoria';
        if (!acc[catName]) {
          acc[catName] = { category: catName, products: [] };
        }
        acc[catName].products.push({
          id: product.id,
          name: product.name,
          description: product.description,
          salePrice: product.salePrice,
          preparationTime: product.preparationTime,
          isActive: product.isActive,
        });
        return acc;
      },
      {} as Record<string, MenuCategoryDto>,
    );

    return Object.values(grouped);
  }

  async findByCategory(categoryId: string): Promise<MenuCategoryDto | null> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, categoryId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) return null;

    const catName = products[0].category?.name ?? 'Sem Categoria';
    return {
      category: catName,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        salePrice: p.salePrice,
        preparationTime: p.preparationTime,
        isActive: p.isActive,
      })),
    };
  }

  async toggle(productId: string): Promise<void> {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive },
    });
  }
}
```

`src/menu/menu.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER, UserRole.COOK)
  findAll() {
    return this.menuService.findAll();
  }

  @Get('categories/:categoryId')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.menuService.findByCategory(categoryId);
  }

  @Patch(':productId/toggle')
  @Roles(UserRole.ADMIN)
  toggle(@Param('productId') productId: string) {
    return this.menuService.toggle(productId);
  }
}
```

`src/menu/menu.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
```

Register in `src/app.module.ts`:

```typescript
import { MenuModule } from './menu/menu.module';

// inside imports array:
MenuModule,
```

---

- [ ] **Step 4: Verify passes**

```bash
npm run test -- --testPathPattern=menu.service
```

Expected: `PASS src/menu/menu.service.spec.ts` — 5 tests passing.

---

- [ ] **Step 5: Commit**

```bash
git add src/menu/
git commit -m "feat: add menu module with category grouping and toggle"
```

---

### Task 9: Orders Module + Socket.io Gateway

**Files:**
- Create: `src/orders/dto/create-order.dto.ts`
- Create: `src/orders/dto/update-order-status.dto.ts`
- Create: `src/orders/orders.service.ts`
- Create: `src/orders/orders.gateway.ts`
- Create: `src/orders/orders.controller.ts`
- Create: `src/orders/orders.module.ts`
- Test: `src/orders/orders.service.spec.ts`

First, install Socket.io adapter:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

---

- [ ] **Step 1: Write the failing tests**

`src/orders/orders.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from './orders.gateway';
import { OrderType, OrderStatus } from '@prisma/client';

const mockPrisma = {
  order: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  orderItem: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockGateway = {
  emitOrderCreated: jest.fn(),
  emitStatusChanged: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrdersGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws BadRequestException if type=MESA without tableNumber', async () => {
      const dto = { type: OrderType.MESA, items: [] };

      await expect(
        service.create(dto as any, 'user-1', 'rest-1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('generates orderNumber as MAX + 1 per restaurant', async () => {
      const createdOrder = {
        id: 'order-new',
        orderNumber: 6,
        type: OrderType.BALCAO,
        items: [],
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          order: {
            findFirst: jest.fn().mockResolvedValue({ orderNumber: 5 }),
            create: jest.fn().mockResolvedValue(createdOrder),
          },
          product: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return fn(txMock);
      });

      const dto = { type: OrderType.BALCAO, items: [] };
      const result = await service.create(dto as any, 'user-1', 'rest-1');

      expect(result.orderNumber).toBe(6);
    });

    it('starts orderNumber at 1 when no previous orders exist', async () => {
      const createdOrder = { id: 'order-1', orderNumber: 1, items: [] };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          order: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(createdOrder),
          },
          product: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return fn(txMock);
      });

      const dto = { type: OrderType.BALCAO, items: [] };
      const result = await service.create(dto as any, 'user-1', 'rest-1');

      expect(result.orderNumber).toBe(1);
    });

    it('snapshots unitPrice from product.salePrice', async () => {
      let capturedCreateData: any;

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          order: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: any) => {
              capturedCreateData = args.data;
              return Promise.resolve({ id: 'o1', orderNumber: 1, items: [] });
            }),
          },
          product: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ id: 'prod-1', salePrice: 25.0 }]),
          },
        };
        return fn(txMock);
      });

      const dto = {
        type: OrderType.BALCAO,
        items: [{ productId: 'prod-1', quantity: 2 }],
      };
      await service.create(dto as any, 'user-1', 'rest-1');

      const createdItem = capturedCreateData.items.create[0];
      expect(createdItem.unitPrice).toBe(25.0);
    });

    it('emits order:created event after creation', async () => {
      const createdOrder = { id: 'o1', orderNumber: 1, items: [] };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          order: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(createdOrder),
          },
          product: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return fn(txMock);
      });

      await service.create(
        { type: OrderType.BALCAO, items: [] } as any,
        'user-1',
        'rest-1',
      );

      expect(mockGateway.emitOrderCreated).toHaveBeenCalledWith(
        'rest-1',
        createdOrder,
      );
    });
  });

  describe('updateStatus', () => {
    it('sets closedAt when status is DELIVERED', async () => {
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.DELIVERED,
        closedAt: new Date(),
      });

      await service.updateStatus('o1', OrderStatus.DELIVERED, 'rest-1');

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
            closedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not set closedAt for non-terminal statuses', async () => {
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PREPARING,
      });

      await service.updateStatus('o1', OrderStatus.PREPARING, 'rest-1');

      const callData = mockPrisma.order.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('closedAt');
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING order', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PENDING,
      });
      mockPrisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CANCELLED,
      });

      await service.cancel('o1');

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: OrderStatus.CANCELLED, closedAt: expect.any(Date) },
      });
    });

    it('throws BadRequestException when cancelling a non-PENDING order', async () => {
      mockPrisma.order.findUniqueOrThrow.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PREPARING,
      });

      await expect(service.cancel('o1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });
});
```

---

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=orders.service
```

Expected: `FAIL src/orders/orders.service.spec.ts` — "Cannot find module './orders.service'"

---

- [ ] **Step 3: Implement**

`src/orders/dto/create-order.dto.ts`:

```typescript
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';

export class CreateOrderItemDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  type: OrderType;

  @IsOptional()
  @IsInt()
  tableNumber?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
```

`src/orders/dto/update-order-status.dto.ts`:

```typescript
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

`src/orders/orders.gateway.ts`:

```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: 'http://localhost:3000', credentials: true },
})
export class OrdersGateway {
  @WebSocketServer()
  server: Server;

  emitOrderCreated(restaurantId: string, order: any): void {
    this.server
      .to(`restaurant:${restaurantId}:kds`)
      .emit('order:created', order);
  }

  emitStatusChanged(restaurantId: string, order: any): void {
    this.server
      .to(`restaurant:${restaurantId}:pdv`)
      .emit('order:status_changed', order);
  }
}
```

`src/orders/orders.service.ts`:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from './orders.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, OrderType } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: OrdersGateway,
  ) {}

  async create(dto: CreateOrderDto, userId: string, restaurantId: string) {
    if (dto.type === OrderType.MESA && !dto.tableNumber) {
      throw new BadRequestException(
        'tableNumber is required for MESA orders',
      );
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const last = await tx.order.findFirst({
        where: { restaurantId },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;

      const productIds = dto.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const priceMap = new Map(products.map((p) => [p.id, p.salePrice]));

      return tx.order.create({
        data: {
          restaurantId,
          orderNumber,
          type: dto.type,
          tableNumber: dto.tableNumber,
          notes: dto.notes,
          discount: dto.discount ?? 0,
          createdBy: userId,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: priceMap.get(item.productId) ?? 0,
              notes: item.notes,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });

    this.gateway.emitOrderCreated(restaurantId, order);
    return order;
  }

  async findAll(filters: { status?: OrderStatus; type?: OrderType }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    return this.prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
      orderBy: { orderNumber: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    restaurantId: string,
  ) {
    const isTerminal = status === OrderStatus.DELIVERED;
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(isTerminal ? { closedAt: new Date() } : {}),
      },
    });
    this.gateway.emitStatusChanged(restaurantId, order);
    return order;
  }

  async cancel(id: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
    });
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Only PENDING orders can be cancelled',
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, closedAt: new Date() },
    });
  }

  async addItem(
    orderId: string,
    item: { productId: string; quantity: number; notes?: string },
  ) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id: item.productId },
    });
    return this.prisma.orderItem.create({
      data: {
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        notes: item.notes,
      },
      include: { product: true },
    });
  }

  async removeItem(orderId: string, itemId: string) {
    return this.prisma.orderItem.delete({
      where: { id: itemId, orderId },
    });
  }
}
```

`src/orders/orders.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, OrderStatus, OrderType } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('type') type?: OrderType,
  ) {
    return this.ordersService.findAll({ status, type });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { sub: string; restaurantId: string },
  ) {
    return this.ordersService.create(dto, user.sub, user.restaurantId);
  }

  @Patch(':id/status')
  @Roles(UserRole.CASHIER, UserRole.COOK, UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.updateStatus(id, dto.status, user.restaurantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  cancel(@Param('id') id: string) {
    return this.ordersService.cancel(id);
  }

  @Post(':id/items')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  addItem(
    @Param('id') orderId: string,
    @Body() body: { productId: string; quantity: number; notes?: string },
  ) {
    return this.ordersService.addItem(orderId, body);
  }

  @Delete(':id/items/:itemId')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  removeItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.ordersService.removeItem(orderId, itemId);
  }
}
```

`src/orders/orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Register in `src/app.module.ts`:

```typescript
import { OrdersModule } from './orders/orders.module';

// inside imports array:
OrdersModule,
```

---

- [ ] **Step 4: Verify passes**

```bash
npm run test -- --testPathPattern=orders.service
```

Expected: `PASS src/orders/orders.service.spec.ts` — 8 tests passing.

---

- [ ] **Step 5: Commit**

```bash
git add src/orders/
git commit -m "feat: add orders module with Socket.io gateway and TDD"
```

---

### Task 10: Dashboard Module

**Files:**
- Create: `src/dashboard/dashboard.service.ts`
- Create: `src/dashboard/dashboard.controller.ts`
- Create: `src/dashboard/dashboard.module.ts`
- Test: `src/dashboard/dashboard.service.spec.ts`

---

- [ ] **Step 1: Write the failing tests**

`src/dashboard/dashboard.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
  },
  ingredient: {
    findMany: jest.fn(),
  },
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  // Access private method via bracket notation for unit tests
  describe('classify', () => {
    it('returns ALTO for marginPct >= 50', () => {
      expect((service as any).classify(50)).toBe('ALTO');
      expect((service as any).classify(75)).toBe('ALTO');
      expect((service as any).classify(100)).toBe('ALTO');
    });

    it('returns MEDIO for 30 <= marginPct < 50', () => {
      expect((service as any).classify(30)).toBe('MEDIO');
      expect((service as any).classify(40)).toBe('MEDIO');
      expect((service as any).classify(49.9)).toBe('MEDIO');
    });

    it('returns BAIXO for marginPct < 30', () => {
      expect((service as any).classify(0)).toBe('BAIXO');
      expect((service as any).classify(15)).toBe('BAIXO');
      expect((service as any).classify(29.9)).toBe('BAIXO');
    });
  });

  describe('computeMetrics', () => {
    it('correctly computes costPrice, margin, marginPct, roi and classification', () => {
      const product = {
        id: 'p1',
        name: 'Test Product',
        salePrice: 20,
        category: { name: 'Cat' },
        recipeItems: [
          { quantity: 2, ingredient: { costPrice: 5 } },
          { quantity: 0.5, ingredient: { costPrice: 4 } },
        ],
      };

      const result = (service as any).computeMetrics(product);

      // costPrice = 2*5 + 0.5*4 = 10 + 2 = 12
      expect(result.costPrice).toBeCloseTo(12);
      // margin = 20 - 12 = 8
      expect(result.margin).toBeCloseTo(8);
      // marginPct = (8/20)*100 = 40
      expect(result.marginPct).toBeCloseTo(40);
      // roi = (8/12)*100 ≈ 66.67
      expect(result.roi).toBeCloseTo(66.67, 1);
      // classification = MEDIO (30 <= 40 < 50)
      expect(result.classification).toBe('MEDIO');
    });

    it('handles zero salePrice gracefully (marginPct = 0)', () => {
      const product = {
        id: 'p2',
        name: 'Free Product',
        salePrice: 0,
        category: null,
        recipeItems: [{ quantity: 1, ingredient: { costPrice: 5 } }],
      };

      const result = (service as any).computeMetrics(product);

      expect(result.marginPct).toBe(0);
      expect(result.categoryName).toBe('Sem Categoria');
    });

    it('handles zero costPrice gracefully (roi = 0)', () => {
      const product = {
        id: 'p3',
        name: 'No Cost',
        salePrice: 10,
        category: { name: 'Cat' },
        recipeItems: [],
      };

      const result = (service as any).computeMetrics(product);

      expect(result.costPrice).toBe(0);
      expect(result.roi).toBe(0);
    });
  });

  describe('getAllProducts', () => {
    it('maps prisma products to ProductMetrics', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Pizza',
          salePrice: 45,
          category: { name: 'Pizzas' },
          recipeItems: [{ quantity: 0.4, ingredient: { costPrice: 4.5 } }],
        },
      ]);

      const result = await service.getAllProducts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pizza');
      // costPrice = 0.4 * 4.5 = 1.8
      expect(result[0].costPrice).toBeCloseTo(1.8);
    });
  });

  describe('getSummary', () => {
    it('returns correct high/medium/low counts', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'High',
          salePrice: 100,
          category: { name: 'C' },
          recipeItems: [{ quantity: 1, ingredient: { costPrice: 40 } }], // margin=60, marginPct=60 → ALTO
        },
        {
          id: 'p2',
          name: 'Medium',
          salePrice: 100,
          category: { name: 'C' },
          recipeItems: [{ quantity: 1, ingredient: { costPrice: 65 } }], // margin=35, marginPct=35 → MEDIO
        },
        {
          id: 'p3',
          name: 'Low',
          salePrice: 100,
          category: { name: 'C' },
          recipeItems: [{ quantity: 1, ingredient: { costPrice: 80 } }], // margin=20, marginPct=20 → BAIXO
        },
      ]);
      mockPrisma.ingredient.findMany.mockResolvedValue([]);

      const summary = await service.getSummary();

      expect(summary.totalProducts).toBe(3);
      expect(summary.highMarginCount).toBe(1);
      expect(summary.mediumMarginCount).toBe(1);
      expect(summary.lowMarginCount).toBe(1);
    });

    it('identifies low stock ingredients', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.ingredient.findMany.mockResolvedValue([
        { id: 'i1', name: 'Flour', stock: 2, minStock: 5 },  // low
        { id: 'i2', name: 'Salt', stock: 10, minStock: 1 },  // ok
      ]);

      const summary = await service.getSummary();

      expect(summary.ingredientsLowStock).toHaveLength(1);
      expect(summary.ingredientsLowStock[0].name).toBe('Flour');
    });
  });

  describe('getTopProfitable', () => {
    it('returns top 5 products sorted by margin descending', async () => {
      const makeProduct = (id: string, margin: number) => ({
        id,
        name: `Prod ${id}`,
        salePrice: 100,
        category: { name: 'C' },
        recipeItems: [{ quantity: 1, ingredient: { costPrice: 100 - margin } }],
      });

      mockPrisma.product.findMany.mockResolvedValue([
        makeProduct('p1', 10),
        makeProduct('p2', 50),
        makeProduct('p3', 30),
        makeProduct('p4', 70),
        makeProduct('p5', 20),
        makeProduct('p6', 60),
      ]);

      const result = await service.getTopProfitable();

      expect(result).toHaveLength(5);
      expect(result[0].margin).toBeCloseTo(70);
      expect(result[1].margin).toBeCloseTo(60);
    });
  });
});
```

---

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --testPathPattern=dashboard.service
```

Expected: `FAIL src/dashboard/dashboard.service.spec.ts` — "Cannot find module './dashboard.service'"

---

- [ ] **Step 3: Implement**

`src/dashboard/dashboard.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductMetrics {
  id: string;
  name: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
  roi: number;
  classification: 'ALTO' | 'MEDIO' | 'BAIXO';
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private classify(marginPct: number): 'ALTO' | 'MEDIO' | 'BAIXO' {
    if (marginPct >= 50) return 'ALTO';
    if (marginPct >= 30) return 'MEDIO';
    return 'BAIXO';
  }

  private computeMetrics(product: {
    id: string;
    name: string;
    salePrice: number;
    category?: { name: string } | null;
    recipeItems: { quantity: number; ingredient: { costPrice: number } }[];
  }): ProductMetrics {
    const costPrice = product.recipeItems.reduce(
      (sum, item) => sum + item.quantity * item.ingredient.costPrice,
      0,
    );
    const margin = product.salePrice - costPrice;
    const marginPct =
      product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
    const roi = costPrice > 0 ? (margin / costPrice) * 100 : 0;

    return {
      id: product.id,
      name: product.name,
      categoryName: product.category?.name ?? 'Sem Categoria',
      costPrice,
      salePrice: product.salePrice,
      margin,
      marginPct,
      roi,
      classification: this.classify(marginPct),
    };
  }

  async getAllProducts(): Promise<ProductMetrics[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => this.computeMetrics(p));
  }

  async getOneProduct(id: string): Promise<ProductMetrics> {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        recipeItems: { include: { ingredient: true } },
      },
    });
    return this.computeMetrics(product);
  }

  async getSummary() {
    const metrics = await this.getAllProducts();

    const avgMarginPct =
      metrics.reduce((s, m) => s + m.marginPct, 0) / (metrics.length || 1);
    const avgRoi =
      metrics.reduce((s, m) => s + m.roi, 0) / (metrics.length || 1);
    const sorted = [...metrics].sort((a, b) => b.margin - a.margin);

    // SQLite does not support column-to-column comparisons in WHERE,
    // so we fetch all active ingredients and filter in JS.
    const ingredients = await this.prisma.ingredient.findMany({
      where: { isActive: true },
    });
    const lowStock = ingredients.filter((i) => i.stock <= i.minStock);

    return {
      totalProducts: metrics.length,
      avgMarginPct: +avgMarginPct.toFixed(2),
      avgRoi: +avgRoi.toFixed(2),
      highMarginCount: metrics.filter((m) => m.classification === 'ALTO')
        .length,
      mediumMarginCount: metrics.filter((m) => m.classification === 'MEDIO')
        .length,
      lowMarginCount: metrics.filter((m) => m.classification === 'BAIXO')
        .length,
      mostProfitableProduct:
        sorted[0]
          ? { name: sorted[0].name, margin: sorted[0].margin, roi: sorted[0].roi }
          : null,
      leastProfitableProduct:
        sorted[sorted.length - 1]
          ? {
              name: sorted[sorted.length - 1].name,
              margin: sorted[sorted.length - 1].margin,
              roi: sorted[sorted.length - 1].roi,
            }
          : null,
      ingredientsLowStock: lowStock,
    };
  }

  async getTopProfitable(): Promise<ProductMetrics[]> {
    const metrics = await this.getAllProducts();
    return [...metrics].sort((a, b) => b.margin - a.margin).slice(0, 5);
  }

  async getLowMargin(): Promise<ProductMetrics[]> {
    const metrics = await this.getAllProducts();
    return metrics.filter((m) => m.marginPct < 30);
  }
}
```

`src/dashboard/dashboard.controller.ts`:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('products')
  getAllProducts() {
    return this.dashboardService.getAllProducts();
  }

  @Get('products/:id')
  getOneProduct(@Param('id') id: string) {
    return this.dashboardService.getOneProduct(id);
  }

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('top-profitable')
  getTopProfitable() {
    return this.dashboardService.getTopProfitable();
  }

  @Get('low-margin')
  getLowMargin() {
    return this.dashboardService.getLowMargin();
  }
}
```

`src/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

Register in `src/app.module.ts`:

```typescript
import { DashboardModule } from './dashboard/dashboard.module';

// inside imports array:
DashboardModule,
```

---

- [ ] **Step 4: Verify passes**

```bash
npm run test -- --testPathPattern=dashboard.service
```

Expected: `PASS src/dashboard/dashboard.service.spec.ts` — 10 tests passing.

---

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/
git commit -m "feat: add dashboard module with margin and ROI analytics"
```

---

### Task 11: Database Seeds

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

---

- [ ] **Step 1: Add seed script to package.json**

In `package.json`, add inside the root object (alongside `"scripts"`):

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Also install `bcryptjs` if not already present:

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

---

- [ ] **Step 2: Write the complete seed file**

`prisma/seed.ts`:

```typescript
import {
  PrismaClient,
  Unit,
  UserRole,
  OrderType,
  OrderStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ── Restaurant ────────────────────────────────────────────────────────────
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Restaurante Demo',
      slug: 'demo',
      phone: '(11) 99999-9999',
      address: 'Rua Demo, 123',
    },
  });
  console.log(`Restaurant created: ${restaurant.name} (${restaurant.id})`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const cookPassword = await bcrypt.hash('cook123', 10);

  const admin = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Admin',
      email: 'admin@demo.com',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const cashier = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Caixa',
      email: 'caixa@demo.com',
      password: cashierPassword,
      role: UserRole.CASHIER,
    },
  });

  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Cozinheiro',
      email: 'cozinha@demo.com',
      password: cookPassword,
      role: UserRole.COOK,
    },
  });

  console.log('Users created: admin, cashier, cook');

  // ── Ingredients (12) ──────────────────────────────────────────────────────
  const ingredients = await Promise.all([
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Farinha de trigo',
        unit: Unit.KG,
        costPrice: 4.5,
        supplier: 'Moinho',
        stock: 20,
        minStock: 5,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Ovo',
        unit: Unit.UN,
        costPrice: 0.8,
        supplier: 'Granja',
        stock: 100,
        minStock: 20,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Leite',
        unit: Unit.L,
        costPrice: 4.0,
        supplier: 'Laticínios',
        stock: 10,
        minStock: 3,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Manteiga',
        unit: Unit.KG,
        costPrice: 28.0,
        supplier: 'Laticínios',
        stock: 5,
        minStock: 1,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Açúcar',
        unit: Unit.KG,
        costPrice: 3.5,
        supplier: 'Usina',
        stock: 10,
        minStock: 2,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Sal',
        unit: Unit.KG,
        costPrice: 2.0,
        supplier: 'Salinas',
        stock: 5,
        minStock: 1,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Queijo muçarela',
        unit: Unit.KG,
        costPrice: 35.0,
        supplier: 'Laticínios',
        stock: 8,
        minStock: 2,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Presunto',
        unit: Unit.KG,
        costPrice: 25.0,
        supplier: 'Frigorífico',
        stock: 5,
        minStock: 1,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Tomate',
        unit: Unit.KG,
        costPrice: 6.0,
        supplier: 'Hortifruti',
        stock: 10,
        minStock: 2,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Alface',
        unit: Unit.UN,
        costPrice: 2.5,
        supplier: 'Hortifruti',
        stock: 30,
        minStock: 10,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Peito de frango',
        unit: Unit.KG,
        costPrice: 18.0,
        supplier: 'Frigorífico',
        stock: 15,
        minStock: 3,
      },
    }),
    prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Pão de hambúrguer',
        unit: Unit.UN,
        costPrice: 1.5,
        supplier: 'Padaria',
        stock: 50,
        minStock: 10,
      },
    }),
  ]);

  const [
    ingFarinha,
    ingOvo,
    ingLeite,
    ingManteiga,
    ingAcucar,
    ingSal,
    ingQueijo,
    ingPresunto,
    ingTomate,
    ingAlface,
    ingFrango,
    ingPao,
  ] = ingredients;

  // ── Price History (1 entry per ingredient) ────────────────────────────────
  await Promise.all(
    ingredients.map((ing) =>
      prisma.ingredientPriceHistory.create({
        data: {
          ingredientId: ing.id,
          price: ing.costPrice,
          changedBy: admin.id,
        },
      }),
    ),
  );

  console.log(`Ingredients created: ${ingredients.length}`);

  // ── Categories (4) ────────────────────────────────────────────────────────
  const [catLanches, catPizzas, catBebidas, catSobremesas] = await Promise.all([
    prisma.category.create({
      data: { restaurantId: restaurant.id, name: 'Lanches', sortOrder: 1 },
    }),
    prisma.category.create({
      data: { restaurantId: restaurant.id, name: 'Pizzas', sortOrder: 2 },
    }),
    prisma.category.create({
      data: { restaurantId: restaurant.id, name: 'Bebidas', sortOrder: 3 },
    }),
    prisma.category.create({
      data: { restaurantId: restaurant.id, name: 'Sobremesas', sortOrder: 4 },
    }),
  ]);

  console.log('Categories created: Lanches, Pizzas, Bebidas, Sobremesas');

  // ── Products + RecipeItems (12) ───────────────────────────────────────────
  type RecipeEntry = {
    ing: typeof ingFarinha;
    qty: number;
    unit: Unit;
  };

  const productData: Array<{
    name: string;
    categoryId: string;
    salePrice: number;
    preparationTime: number;
    recipe: RecipeEntry[];
  }> = [
    // Lanches
    {
      name: 'X-Burguer',
      categoryId: catLanches.id,
      salePrice: 18.0,
      preparationTime: 15,
      recipe: [
        { ing: ingPao, qty: 1, unit: Unit.UN },
        { ing: ingQueijo, qty: 0.1, unit: Unit.KG },
        { ing: ingTomate, qty: 0.1, unit: Unit.KG },
      ],
    },
    {
      name: 'X-Bacon',
      categoryId: catLanches.id,
      salePrice: 22.0,
      preparationTime: 15,
      recipe: [
        { ing: ingPao, qty: 1, unit: Unit.UN },
        { ing: ingQueijo, qty: 0.1, unit: Unit.KG },
        { ing: ingPresunto, qty: 0.1, unit: Unit.KG },
        { ing: ingTomate, qty: 0.05, unit: Unit.KG },
      ],
    },
    {
      name: 'X-Salada',
      categoryId: catLanches.id,
      salePrice: 20.0,
      preparationTime: 12,
      recipe: [
        { ing: ingPao, qty: 1, unit: Unit.UN },
        { ing: ingAlface, qty: 1, unit: Unit.UN },
        { ing: ingTomate, qty: 0.1, unit: Unit.KG },
      ],
    },
    // Pizzas
    {
      name: 'Pizza Margherita',
      categoryId: catPizzas.id,
      salePrice: 45.0,
      preparationTime: 25,
      recipe: [
        { ing: ingFarinha, qty: 0.4, unit: Unit.KG },
        { ing: ingQueijo, qty: 0.2, unit: Unit.KG },
        { ing: ingTomate, qty: 0.3, unit: Unit.KG },
        { ing: ingSal, qty: 0.01, unit: Unit.KG },
      ],
    },
    {
      name: 'Pizza Frango',
      categoryId: catPizzas.id,
      salePrice: 52.0,
      preparationTime: 25,
      recipe: [
        { ing: ingFarinha, qty: 0.4, unit: Unit.KG },
        { ing: ingFrango, qty: 0.3, unit: Unit.KG },
        { ing: ingQueijo, qty: 0.2, unit: Unit.KG },
      ],
    },
    {
      name: 'Pizza Calabresa',
      categoryId: catPizzas.id,
      salePrice: 48.0,
      preparationTime: 25,
      recipe: [
        { ing: ingFarinha, qty: 0.4, unit: Unit.KG },
        { ing: ingQueijo, qty: 0.2, unit: Unit.KG },
        { ing: ingTomate, qty: 0.2, unit: Unit.KG },
      ],
    },
    // Bebidas
    {
      name: 'Suco de Laranja',
      categoryId: catBebidas.id,
      salePrice: 10.0,
      preparationTime: 5,
      recipe: [{ ing: ingAcucar, qty: 0.05, unit: Unit.KG }],
    },
    {
      name: 'Refrigerante',
      categoryId: catBebidas.id,
      salePrice: 7.0,
      preparationTime: 2,
      recipe: [],
    },
    {
      name: 'Água',
      categoryId: catBebidas.id,
      salePrice: 4.0,
      preparationTime: 1,
      recipe: [],
    },
    // Sobremesas
    {
      name: 'Brigadeiro',
      categoryId: catSobremesas.id,
      salePrice: 5.0,
      preparationTime: 10,
      recipe: [
        { ing: ingLeite, qty: 0.1, unit: Unit.L },
        { ing: ingAcucar, qty: 0.05, unit: Unit.KG },
        { ing: ingManteiga, qty: 0.02, unit: Unit.KG },
      ],
    },
    {
      name: 'Pudim',
      categoryId: catSobremesas.id,
      salePrice: 12.0,
      preparationTime: 60,
      recipe: [
        { ing: ingLeite, qty: 0.5, unit: Unit.L },
        { ing: ingOvo, qty: 3, unit: Unit.UN },
        { ing: ingAcucar, qty: 0.15, unit: Unit.KG },
      ],
    },
    {
      name: 'Petit Gâteau',
      categoryId: catSobremesas.id,
      salePrice: 18.0,
      preparationTime: 20,
      recipe: [
        { ing: ingFarinha, qty: 0.1, unit: Unit.KG },
        { ing: ingOvo, qty: 2, unit: Unit.UN },
        { ing: ingManteiga, qty: 0.08, unit: Unit.KG },
        { ing: ingAcucar, qty: 0.1, unit: Unit.KG },
      ],
    },
  ];

  const products: Array<{ id: string; salePrice: number }> = [];

  for (const p of productData) {
    const product = await prisma.product.create({
      data: {
        restaurantId: restaurant.id,
        name: p.name,
        categoryId: p.categoryId,
        salePrice: p.salePrice,
        preparationTime: p.preparationTime,
        recipeItems: {
          create: p.recipe.map((r) => ({
            ingredientId: r.ing.id,
            quantity: r.qty,
            unit: r.unit,
          })),
        },
      },
      select: { id: true, salePrice: true },
    });
    products.push(product);
  }

  console.log(`Products created: ${products.length}`);

  // ── Orders (12) ───────────────────────────────────────────────────────────
  const statuses: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.DELIVERED,
  ];

  for (let i = 0; i < 12; i++) {
    const isMesa = i % 2 === 0;
    const product1 = products[i % products.length];
    const product2 = products[(i + 3) % products.length];
    const status = statuses[i % statuses.length];
    const isDelivered = status === OrderStatus.DELIVERED;

    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        orderNumber: i + 1,
        type: isMesa ? OrderType.MESA : OrderType.BALCAO,
        tableNumber: isMesa ? (i % 8) + 1 : undefined,
        status,
        closedAt: isDelivered ? new Date() : undefined,
        createdBy: cashier.id,
        items: {
          create: [
            {
              productId: product1.id,
              quantity: 1,
              unitPrice: product1.salePrice,
            },
            {
              productId: product2.id,
              quantity: 2,
              unitPrice: product2.salePrice,
            },
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
  console.log('  Admin:   admin@demo.com   / admin123');
  console.log('  Cashier: caixa@demo.com   / cashier123');
  console.log('  Cook:    cozinha@demo.com / cook123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

---

- [ ] **Step 3: Run the seed**

```bash
npx prisma db seed
```

Expected output:

```
Starting seed...
Restaurant created: Restaurante Demo (clxxxxxx)
Users created: admin, cashier, cook
Ingredients created: 12
Categories created: Lanches, Pizzas, Bebidas, Sobremesas
Products created: 12
Orders created: 12

Seed completed successfully!

Login credentials:
  Admin:   admin@demo.com   / admin123
  Cashier: caixa@demo.com   / cashier123
  Cook:    cozinha@demo.com / cook123
```

---

- [ ] **Step 4: Verify in Prisma Studio**

```bash
npx prisma studio
```

Open `http://localhost:5555` and verify:
- `Restaurant` — 1 record
- `User` — 3 records (ADMIN, CASHIER, COOK)
- `Ingredient` — 12 records
- `IngredientPriceHistory` — 12 records
- `Category` — 4 records
- `Product` — 12 records
- `RecipeItem` — records matching product recipes
- `Order` — 12 records with mixed statuses and types
- `OrderItem` — 24 records (2 per order)

---

- [ ] **Step 5: Run all tests to confirm nothing regressed**

```bash
npm run test
```

Expected: All test suites pass.

---

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add database seed with demo restaurant, products, and orders"
```

---

## Summary: Tasks 7–11 Checklist

| Task | Module | Tests | Status |
|------|--------|-------|--------|
| 7 | Products + Categories | `products.service.spec.ts` (6 tests) | [ ] |
| 8 | Menu | `menu.service.spec.ts` (5 tests) | [ ] |
| 9 | Orders + Gateway | `orders.service.spec.ts` (8 tests) | [ ] |
| 10 | Dashboard | `dashboard.service.spec.ts` (10 tests) | [ ] |
| 11 | Seeds | Manual verification via Prisma Studio | [ ] |

### Final verification — run all suites together

```bash
npm run test -- --testPathPattern="products.service|menu.service|orders.service|dashboard.service"
```

Expected: 4 test suites, 29 tests, all passing.
## Part 2: Frontend (Tasks 12–19)

---

### Task 12: Frontend project setup + shared infrastructure

**Files:**
- Create: `gercoz-frontend/src/lib/api.ts`
- Create: `gercoz-frontend/src/contexts/auth-context.tsx`
- Create: `gercoz-frontend/src/contexts/socket-context.tsx`
- Create: `gercoz-frontend/src/app/layout.tsx`
- Create: `gercoz-frontend/src/middleware.ts`

- [ ] **Step 1: Scaffold project**

```bash
npx create-next-app@14 gercoz-frontend --typescript --tailwind --eslint --app --src-dir
cd gercoz-frontend
npm i @tanstack/react-query @tanstack/react-query-devtools axios socket.io-client react-hook-form @hookform/resolvers zod recharts
npm i -D @types/node @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input label card badge table dialog form select tabs toast
```

- [ ] **Step 2: Write failing test for api.ts**

```typescript
// src/lib/api.test.ts
import { api } from './api';

describe('api instance', () => {
  it('has baseURL set to localhost:3001', () => {
    expect(api.defaults.baseURL).toBe('http://localhost:3001');
  });

  it('has Content-Type header set', () => {
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
  });
});
```

- [ ] **Step 3: Run**

Run: `npm test -- src/lib/api.test.ts`
Expected: FAIL "Cannot find module './api'"

- [ ] **Step 4: Implement `src/lib/api.ts`**

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken =
        typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      if (!refreshToken) {
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post('http://localhost:3001/auth/refresh', {
          token: refreshToken,
        });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        if (typeof window !== 'undefined') window.location.href = '/auth';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
```

- [ ] **Step 5: Implement `src/contexts/auth-context.tsx`**

```typescript
'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';

interface User {
  userId: string;
  restaurantId: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

function decodeToken(token: string): User {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return { userId: payload.sub, restaurantId: payload.restaurantId, role: payload.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        setUser(decodeToken(token));
      } catch {
        localStorage.clear();
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(decodeToken(data.accessToken));
  };

  const logout = () => {
    const token = localStorage.getItem('refreshToken');
    if (token) api.post('/auth/logout', { token }).catch(() => {});
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 6: Implement `src/contexts/socket-context.tsx`**

```typescript
'use client';
import { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    socketRef.current = io('http://localhost:3001', {
      auth: { token },
      autoConnect: true,
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
```

- [ ] **Step 7: Implement `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SisGerCoz',
  description: 'Sistema de Gerenciamento de Cozinha',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```typescript
// src/components/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { SocketProvider } from '@/contexts/socket-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>{children}</SocketProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 8: Implement `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/auth'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

- [ ] **Step 9: Verify**

Run: `npm test -- src/lib/api.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/api.ts src/contexts/auth-context.tsx src/contexts/socket-context.tsx \
  src/app/layout.tsx src/components/providers.tsx src/middleware.ts
git commit -m "chore: scaffold Next.js frontend with auth and socket infrastructure"
```

---

### Task 13: Auth page (login)

**Files:**
- Create: `src/app/auth/page.tsx`
- Create: `src/app/auth/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/auth/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from './page';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

jest.mock('@/contexts/auth-context');
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));

const mockLogin = jest.fn();
const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: null, login: mockLogin, logout: jest.fn() });
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

describe('AuthPage', () => {
  it('renders email and password inputs', () => {
    render(<AuthPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('shows submit button with text Entrar', () => {
    render(<AuthPage />);
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith('admin@demo.com', 'admin123')
    );
  });

  it('redirects to /dashboard after successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows validation error for invalid email', async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() =>
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/app/auth/page.test.tsx`
Expected: FAIL "Cannot find module './page'"

- [ ] **Step 3: Implement `src/app/auth/page.tsx`**

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type FormData = z.infer<typeof schema>;

export default function AuthPage() {
  const { login } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch {
      setError('root', { message: 'Email ou senha inválidos' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SisGerCoz — Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>
            {errors.root && (
              <p className="text-red-500 text-sm">{errors.root.message}</p>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test -- src/app/auth/page.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/
git commit -m "feat: add login page with React Hook Form and Zod validation"
```

---

### Task 14: Ingredients page (frontend)

**Files:**
- Create: `src/hooks/use-ingredients.ts`
- Create: `src/hooks/use-ingredients.test.ts`
- Create: `src/app/(admin)/ingredients/page.tsx`
- Create: `src/app/(admin)/ingredients/components/ingredient-form.tsx`
- Create: `src/app/(admin)/ingredients/components/price-history-chart.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-ingredients.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useIngredients, useCreateIngredient } from './use-ingredients';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useIngredients', () => {
  it('fetches ingredients from /ingredients', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: '1', name: 'Farinha', unit: 'KG', costPrice: 3.5, stock: 10, minStock: 2, isActive: true }],
    });
    const { result } = renderHook(() => useIngredients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/ingredients', { params: undefined });
    expect(result.current.data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/hooks/use-ingredients.test.ts`
Expected: FAIL "Cannot find module './use-ingredients'"

- [ ] **Step 3: Implement `src/hooks/use-ingredients.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPrice: number;
  stock: number;
  minStock: number;
  supplier?: string;
  isActive: boolean;
  priceHistory?: { price: number; changedAt: string }[];
}

export const useIngredients = (params?: { isActive?: boolean; name?: string }) =>
  useQuery({
    queryKey: ['ingredients', params],
    queryFn: () => api.get('/ingredients', { params }).then((r) => r.data),
  });

export const useIngredient = (id: string) =>
  useQuery({
    queryKey: ['ingredients', id],
    queryFn: () => api.get(`/ingredients/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Ingredient>) =>
      api.post('/ingredients', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};

export const useUpdateIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ingredient> & { id: string }) =>
      api.patch(`/ingredients/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};

export const useDeleteIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ingredients/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};
```

- [ ] **Step 4: Implement `src/app/(admin)/ingredients/components/ingredient-form.tsx`**

```typescript
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateIngredient, useUpdateIngredient } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  unit: z.enum(['G', 'KG', 'ML', 'L', 'UN']),
  costPrice: z.coerce.number().min(0, 'Custo deve ser positivo'),
  stock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  supplier: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  ingredient?: Ingredient | null;
  onSuccess: () => void;
}

export default function IngredientForm({ ingredient, onSuccess }: Props) {
  const create = useCreateIngredient();
  const update = useUpdateIngredient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ingredient?.name ?? '',
      unit: (ingredient?.unit as FormData['unit']) ?? 'KG',
      costPrice: ingredient?.costPrice ?? 0,
      stock: ingredient?.stock ?? 0,
      minStock: ingredient?.minStock ?? 0,
      supplier: ingredient?.supplier ?? '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (ingredient) {
      await update.mutateAsync({ id: ingredient.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-2">
      <h2 className="text-lg font-semibold">
        {ingredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
      </h2>

      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <Label>Unidade</Label>
        <Select
          defaultValue={watch('unit')}
          onValueChange={(v) => setValue('unit', v as FormData['unit'])}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {['G', 'KG', 'ML', 'L', 'UN'].map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="costPrice">Custo (R$)</Label>
          <Input id="costPrice" type="number" step="0.01" {...register('costPrice')} />
          {errors.costPrice && (
            <p className="text-red-500 text-sm">{errors.costPrice.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="supplier">Fornecedor</Label>
          <Input id="supplier" {...register('supplier')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stock">Estoque</Label>
          <Input id="stock" type="number" step="0.001" {...register('stock')} />
        </div>
        <div>
          <Label htmlFor="minStock">Estoque Mínimo</Label>
          <Input id="minStock" type="number" step="0.001" {...register('minStock')} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Implement `src/app/(admin)/ingredients/components/price-history-chart.tsx`**

```typescript
'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PricePoint {
  price: number;
  changedAt: string;
}

interface Props {
  history: PricePoint[];
  ingredientName: string;
}

export default function PriceHistoryChart({ history, ingredientName }: Props) {
  const data = history.map((h) => ({
    price: h.price,
    date: format(new Date(h.changedAt), 'dd/MM/yy'),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Histórico de Preço — {ingredientName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => `R$${v.toFixed(2)}`}
              tick={{ fontSize: 11 }}
              width={60}
            />
            <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Preço']} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Implement `src/app/(admin)/ingredients/page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useIngredients, useDeleteIngredient } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import IngredientForm from './components/ingredient-form';
import PriceHistoryChart from './components/price-history-chart';

export default function IngredientsPage() {
  const [search, setSearch] = useState('');
  const { data: ingredients = [], isLoading } = useIngredients();
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const deleteIngredient = useDeleteIngredient();

  const filtered = ingredients.filter((i: Ingredient) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <div className="flex gap-3">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>Novo Ingrediente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <IngredientForm
                ingredient={editing}
                onSuccess={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Mín.</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ing: Ingredient) => (
              <TableRow
                key={ing.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelected(ing)}
              >
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell>{ing.unit}</TableCell>
                <TableCell>R$ {ing.costPrice.toFixed(2)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {ing.stock}
                    {ing.stock <= ing.minStock && (
                      <Badge variant="destructive">Baixo</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>{ing.minStock}</TableCell>
                <TableCell>{ing.supplier || '—'}</TableCell>
                <TableCell>
                  <Badge variant={ing.isActive ? 'default' : 'secondary'}>
                    {ing.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(ing);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteIngredient.mutate(ing.id)}
                  >
                    Desativar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[420px]">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
          </SheetHeader>
          {selected?.priceHistory && selected.priceHistory.length > 0 ? (
            <div className="mt-4">
              <PriceHistoryChart
                history={selected.priceHistory}
                ingredientName={selected.name}
              />
            </div>
          ) : (
            <p className="mt-4 text-gray-500 text-sm">Sem histórico de preço.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm test -- src/hooks/use-ingredients.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-ingredients.ts src/app/\(admin\)/ingredients/
git commit -m "feat: add ingredients page with CRUD, stock alerts, and price history chart"
```

---

### Task 15: Products page (frontend)

**Files:**
- Create: `src/hooks/use-products.ts`
- Create: `src/app/(admin)/products/page.tsx`
- Create: `src/app/(admin)/products/components/product-form.tsx`
- Create: `src/app/(admin)/products/components/ficha-tecnica-modal.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-products.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useProducts, useCategories } from './use-products';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useProducts', () => {
  it('fetches products from /products', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: '1', name: 'Pizza', salePrice: 45.0, costPrice: 12.0, isActive: true }],
    });
    const { result } = renderHook(() => useProducts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it('fetches categories from /categories', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Pizzas' }],
    });
    const { result } = renderHook(() => useCategories(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0].name).toBe('Pizzas');
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/hooks/use-products.test.ts`
Expected: FAIL "Cannot find module './use-products'"

- [ ] **Step 3: Implement `src/hooks/use-products.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  costPrice: number;
  preparationTime: number;
  isActive: boolean;
  recipeItems?: RecipeItem[];
}

export interface Category {
  id: string;
  name: string;
}

export const useProducts = (params?: { isActive?: boolean; categoryId?: string }) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then((r) => r.data),
  });

export const useProduct = (id: string) =>
  useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

export const useFichaTecnica = (id: string) =>
  useQuery({
    queryKey: ['ficha-tecnica', id],
    queryFn: () => api.get(`/products/${id}/ficha-tecnica`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) =>
      api.post('/products', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Product> & { id: string }) =>
      api.patch(`/products/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};
```

- [ ] **Step 4: Implement `src/app/(admin)/products/components/product-form.tsx`**

```typescript
'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo } from 'react';
import { useIngredients } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { useCreateProduct, useUpdateProduct, useCategories } from '@/hooks/use-products';
import type { Product } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const recipeItemSchema = z.object({
  ingredientId: z.string().min(1, 'Selecione um ingrediente'),
  quantity: z.coerce.number().min(0.001, 'Quantidade deve ser maior que 0'),
  unit: z.enum(['G', 'KG', 'ML', 'L', 'UN']),
});

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  salePrice: z.coerce.number().min(0),
  preparationTime: z.coerce.number().min(1).default(15),
  recipeItems: z.array(recipeItemSchema),
});

type FormData = z.infer<typeof schema>;

interface Props {
  product?: Product | null;
  onSuccess: () => void;
}

export default function ProductForm({ product, onSuccess }: Props) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const { data: categories = [] } = useCategories();
  const { data: ingredients = [] } = useIngredients({ isActive: true });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? '',
      salePrice: product?.salePrice ?? 0,
      preparationTime: product?.preparationTime ?? 15,
      recipeItems: product?.recipeItems ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'recipeItems' });
  const watchedItems = watch('recipeItems');
  const watchedSalePrice = watch('salePrice');

  const calculatedCost = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const ing = ingredients.find((i: Ingredient) => i.id === item.ingredientId);
      if (!ing) return sum;
      let qty = item.quantity;
      if (item.unit === 'G' && ing.unit === 'KG') qty /= 1000;
      if (item.unit === 'ML' && ing.unit === 'L') qty /= 1000;
      return sum + ing.costPrice * qty;
    }, 0);
  }, [watchedItems, ingredients]);

  const margin = watchedSalePrice - calculatedCost;
  const marginPct = watchedSalePrice > 0 ? (margin / watchedSalePrice) * 100 : 0;

  const onSubmit = async (data: FormData) => {
    if (product) {
      await update.mutateAsync({ id: product.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-2 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold">
        {product ? 'Editar Produto' : 'Novo Produto'}
      </h2>

      <div>
        <Label htmlFor="prod-name">Nome</Label>
        <Input id="prod-name" {...register('name')} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Categoria</Label>
          <Select
            defaultValue={product?.categoryId ?? ''}
            onValueChange={(v) => setValue('categoryId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: { id: string; name: string }) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="preparationTime">Tempo de Preparo (min)</Label>
          <Input id="preparationTime" type="number" {...register('preparationTime')} />
        </div>
      </div>

      <div>
        <Label htmlFor="salePrice">Preço de Venda (R$)</Label>
        <Input id="salePrice" type="number" step="0.01" {...register('salePrice')} />
      </div>

      <div className="border rounded p-3 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-sm">Receita</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ ingredientId: '', quantity: 0, unit: 'KG' })}
          >
            + Ingrediente
          </Button>
        </div>

        {fields.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-end">
            <div>
              <Label className="text-xs">Ingrediente</Label>
              <Select
                onValueChange={(v) => setValue(`recipeItems.${idx}.ingredientId`, v)}
                defaultValue={field.ingredientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i: Ingredient) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Qtd</Label>
              <Input
                type="number"
                step="0.001"
                {...register(`recipeItems.${idx}.quantity`)}
              />
            </div>
            <div>
              <Label className="text-xs">Und</Label>
              <Select
                defaultValue={field.unit}
                onValueChange={(v) =>
                  setValue(`recipeItems.${idx}.unit`, v as 'G' | 'KG' | 'ML' | 'L' | 'UN')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['G', 'KG', 'ML', 'L', 'UN'].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => remove(idx)}
            >
              ×
            </Button>
          </div>
        ))}

        <div className="pt-2 border-t text-sm space-y-1">
          <p>
            Custo calculado:{' '}
            <span className="font-semibold">R$ {calculatedCost.toFixed(2)}</span>
          </p>
          <p>
            Margem:{' '}
            <Badge
              variant={marginPct >= 40 ? 'default' : marginPct >= 20 ? 'secondary' : 'destructive'}
            >
              {marginPct.toFixed(1)}%
            </Badge>
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Implement `src/app/(admin)/products/components/ficha-tecnica-modal.tsx`**

```typescript
'use client';
import { useFichaTecnica } from '@/hooks/use-products';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  productId: string | null;
  onClose: () => void;
}

export default function FichaTecnicaModal({ productId, onClose }: Props) {
  const { data, isLoading } = useFichaTecnica(productId ?? '');

  const marginPct = data
    ? ((data.salePrice - data.totalCost) / data.salePrice) * 100
    : 0;
  const roi = data ? ((data.salePrice - data.totalCost) / data.totalCost) * 100 : 0;

  return (
    <Dialog open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ficha Técnica — {data?.productName}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-gray-500">Carregando...</p>}

        {data && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Custo Unit.</TableHead>
                  <TableHead>Custo Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items?.map(
                  (item: {
                    ingredientName: string;
                    quantity: number;
                    unit: string;
                    unitCost: number;
                    totalCost: number;
                  }) => (
                    <TableRow key={item.ingredientName}>
                      <TableCell>{item.ingredientName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>R$ {item.unitCost.toFixed(4)}</TableCell>
                      <TableCell>R$ {item.totalCost.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="border rounded p-3">
                <p className="text-gray-500">Custo Total</p>
                <p className="font-bold text-lg">R$ {data.totalCost?.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">Preço de Venda</p>
                <p className="font-bold text-lg">R$ {data.salePrice?.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">Margem</p>
                <Badge
                  variant={
                    marginPct >= 40
                      ? 'default'
                      : marginPct >= 20
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="text-base px-2 py-1"
                >
                  {marginPct.toFixed(1)}%
                </Badge>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">ROI</p>
                <p className="font-bold text-lg">{roi.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Implement `src/app/(admin)/products/page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useProducts, useDeleteProduct } from '@/hooks/use-products';
import type { Product } from '@/hooks/use-products';
import { useCategories } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductForm from './components/product-form';
import FichaTecnicaModal from './components/ficha-tecnica-modal';

function getProfitabilityVariant(
  costPrice: number,
  salePrice: number
): 'default' | 'secondary' | 'destructive' {
  if (salePrice === 0) return 'destructive';
  const pct = ((salePrice - costPrice) / salePrice) * 100;
  if (pct >= 40) return 'default';
  if (pct >= 20) return 'secondary';
  return 'destructive';
}

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const deleteProduct = useDeleteProduct();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fichaTecnicaId, setFichaTecnicaId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered =
    activeCategory === 'all'
      ? products
      : products.filter((p: Product) => p.categoryId === activeCategory);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <ProductForm product={editing} onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {categories.map((c: { id: string; name: string }) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product: Product) => (
            <Card key={product.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant={getProfitabilityVariant(product.costPrice, product.salePrice)}>
                    {product.salePrice > 0
                      ? `${(((product.salePrice - product.costPrice) / product.salePrice) * 100).toFixed(0)}%`
                      : 'N/A'}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-xs text-gray-500">{product.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-500">
                    Custo: R$ {product.costPrice.toFixed(2)}
                  </span>
                  <span className="font-semibold">
                    Venda: R$ {product.salePrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setFichaTecnicaId(product.id)}
                  >
                    Ficha Técnica
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(product);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteProduct.mutate(product.id)}
                  >
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FichaTecnicaModal
        productId={fichaTecnicaId}
        onClose={() => setFichaTecnicaId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `npm test -- src/hooks/use-products.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-products.ts src/app/\(admin\)/products/
git commit -m "feat: add products page with recipe builder, cost preview, and ficha técnica modal"
```

---

### Task 16: Menu page (frontend)

**Files:**
- Create: `src/hooks/use-menu.ts`
- Create: `src/app/(cashier)/menu/page.tsx`
- Create: `src/app/(cashier)/menu/components/product-card.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-menu.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useMenu } from './use-menu';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMenu', () => {
  it('fetches menu from /menu', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: '1', name: 'Pizza Margherita', salePrice: 45.0, isActive: true }],
    });
    const { result } = renderHook(() => useMenu(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/hooks/use-menu.test.ts`
Expected: FAIL "Cannot find module './use-menu'"

- [ ] **Step 3: Implement `src/hooks/use-menu.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  preparationTime: number;
  isActive: boolean;
}

export const useMenu = () =>
  useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu').then((r) => r.data),
  });

export const useToggleProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      api.patch(`/menu/${productId}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });
};
```

- [ ] **Step 4: Implement `src/app/(cashier)/menu/components/product-card.tsx`**

```typescript
'use client';
import { useToggleProduct } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  product: MenuItem;
}

export default function ProductCard({ product }: Props) {
  const { user } = useAuth();
  const toggle = useToggleProduct();

  return (
    <Card className={product.isActive ? '' : 'opacity-50'}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">{product.name}</CardTitle>
          <Badge variant={product.isActive ? 'default' : 'secondary'}>
            {product.isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold text-green-700">
            R$ {product.salePrice.toFixed(2)}
          </span>
          <span className="text-gray-400">{product.preparationTime} min</span>
        </div>
        {user?.role === 'ADMIN' && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => toggle.mutate(product.id)}
            disabled={toggle.isPending}
          >
            {product.isActive ? 'Desativar' : 'Ativar'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Implement `src/app/(cashier)/menu/page.tsx`**

```typescript
'use client';
import { useState, useMemo } from 'react';
import { useMenu } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from './components/product-card';

export default function MenuPage() {
  const { data: menu = [], isLoading } = useMenu();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    menu.forEach((item: MenuItem) => {
      if (item.categoryId && item.categoryName) {
        cats.set(item.categoryId, item.categoryName);
      }
    });
    return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
  }, [menu]);

  const filtered = useMemo(
    () =>
      menu.filter((item: MenuItem) => {
        const matchesSearch = item.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory =
          activeCategory === 'all' || item.categoryId === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    [menu, search, activeCategory]
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Cardápio</h1>
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-gray-500">Carregando cardápio...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item: MenuItem) => (
            <ProductCard key={item.id} product={item} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-gray-400 text-center py-8">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm test -- src/hooks/use-menu.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-menu.ts src/app/\(cashier\)/menu/
git commit -m "feat: add menu page with category tabs, search, and admin toggle"
```

---

### Task 17: PDV pages (frontend)

**Files:**
- Create: `src/hooks/use-orders.ts`
- Create: `src/app/(cashier)/pdv/page.tsx`
- Create: `src/app/(cashier)/pdv/components/cart.tsx`
- Create: `src/app/(cashier)/pdv/orders/page.tsx`
- Create: `src/app/(cashier)/pdv/orders/components/order-card.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-orders.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useOrders, useCreateOrder } from './use-orders';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useOrders', () => {
  it('fetches orders from /orders', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'o1', orderNumber: 1, status: 'PENDING', type: 'BALCAO', total: 45 }],
    });
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0].status).toBe('PENDING');
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/hooks/use-orders.test.ts`
Expected: FAIL "Cannot find module './use-orders'"

- [ ] **Step 3: Implement `src/hooks/use-orders.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  type: 'MESA' | 'BALCAO';
  tableNumber?: number;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
}

export const useOrders = (params?: { status?: string; type?: string }) =>
  useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.get('/orders', { params }).then((r) => r.data),
    refetchInterval: 30_000,
  });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: string;
      tableNumber?: number;
      items: Omit<OrderItem, 'name'>[];
      discount?: number;
    }) => api.post('/orders', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
};
```

- [ ] **Step 4: Implement `src/app/(cashier)/pdv/components/cart.tsx`**

```typescript
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface Props {
  items: CartItem[];
  discount: number;
  onQuantityChange: (productId: string, delta: number) => void;
  onNotesChange: (productId: string, notes: string) => void;
  onRemove: (productId: string) => void;
  onDiscountChange: (value: number) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export default function Cart({
  items,
  discount,
  onQuantityChange,
  onNotesChange,
  onRemove,
  onDiscountChange,
  onConfirm,
  isSubmitting,
}: Props) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-3">Carrinho</h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {items.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            Nenhum item adicionado.
          </p>
        )}
        {items.map((item) => (
          <div key={item.productId} className="border rounded p-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{item.name}</span>
              <button
                onClick={() => onRemove(item.productId)}
                className="text-red-400 text-xs hover:text-red-600"
              >
                remover
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
                onClick={() => onQuantityChange(item.productId, -1)}
              >
                −
              </Button>
              <span className="text-sm w-6 text-center">{item.quantity}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
                onClick={() => onQuantityChange(item.productId, 1)}
              >
                +
              </Button>
              <span className="text-sm text-gray-500 ml-auto">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </div>
            <Input
              placeholder="Observações..."
              value={item.notes}
              onChange={(e) => onNotesChange(item.productId, e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2 mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-500 shrink-0">Desconto R$</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={discount}
            onChange={(e) => onDiscountChange(Number(e.target.value))}
            className="h-7 text-sm"
          />
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
        <Button
          className="w-full"
          onClick={onConfirm}
          disabled={items.length === 0 || isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Confirmar Pedido'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `src/app/(cashier)/pdv/page.tsx`**

```typescript
'use client';
import { useState, useMemo } from 'react';
import { useMenu } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { useCreateOrder } from '@/hooks/use-orders';
import { useCategories } from '@/hooks/use-products';
import Cart from './components/cart';
import type { CartItem } from './components/cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function PdvPage() {
  const { data: menu = [] } = useMenu();
  const { data: categories = [] } = useCategories();
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const [orderType, setOrderType] = useState<'MESA' | 'BALCAO'>('BALCAO');
  const [tableNumber, setTableNumber] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);

  const filteredMenu = useMemo(
    () =>
      menu.filter((item: MenuItem) => {
        if (!item.isActive) return false;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          activeCategory === 'all' || item.categoryId === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    [menu, search, activeCategory]
  );

  const addToCart = (product: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          notes: '',
        },
      ];
    });
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const handleNotesChange = (productId: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, notes } : i))
    );
  };

  const handleRemove = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleConfirm = async () => {
    try {
      await createOrder.mutateAsync({
        type: orderType,
        tableNumber: orderType === 'MESA' ? Number(tableNumber) : undefined,
        items: cartItems.map(({ productId, quantity, unitPrice, notes }) => ({
          productId,
          quantity,
          unitPrice,
          notes: notes || undefined,
        })),
        discount: discount || undefined,
      });
      setCartItems([]);
      setDiscount(0);
      setTableNumber('');
      toast({ title: 'Pedido criado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao criar pedido', variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left — product selection */}
      <div className="flex-1 overflow-y-auto p-4 border-r">
        <div className="flex gap-3 mb-4 items-center">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={orderType === 'BALCAO' ? 'default' : 'outline'}
              onClick={() => setOrderType('BALCAO')}
            >
              Balcão
            </Button>
            <Button
              size="sm"
              variant={orderType === 'MESA' ? 'default' : 'outline'}
              onClick={() => setOrderType('MESA')}
            >
              Mesa
            </Button>
          </div>
          {orderType === 'MESA' && (
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Nº Mesa</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-20 h-8"
              />
            </div>
          )}
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-48 h-8"
          />
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-3">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map((c: { id: string; name: string }) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredMenu.map((item: MenuItem) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="border rounded-lg p-3 text-left hover:bg-gray-50 active:scale-95 transition-transform"
            >
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-green-700 font-semibold text-sm mt-1">
                R$ {item.salePrice.toFixed(2)}
              </p>
              {cartItems.find((i) => i.productId === item.id) && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {cartItems.find((i) => i.productId === item.id)?.quantity}x
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right — cart */}
      <div className="w-80 p-4">
        <Cart
          items={cartItems}
          discount={discount}
          onQuantityChange={handleQuantityChange}
          onNotesChange={handleNotesChange}
          onRemove={handleRemove}
          onDiscountChange={setDiscount}
          onConfirm={handleConfirm}
          isSubmitting={createOrder.isPending}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement `src/app/(cashier)/pdv/orders/components/order-card.tsx`**

```typescript
'use client';
import { useUpdateOrderStatus } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  PENDING: { label: 'Pendente', variant: 'secondary' as const },
  PREPARING: { label: 'Preparando', variant: 'default' as const },
  READY: { label: 'Pronto', variant: 'default' as const, className: 'bg-green-500' },
  DELIVERED: { label: 'Entregue', variant: 'default' as const, className: 'bg-blue-500' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' as const },
};

interface Props {
  order: Order;
}

export default function OrderCard({ order }: Props) {
  const updateStatus = useUpdateOrderStatus();
  const cfg = statusConfig[order.status];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold">#{order.orderNumber}</span>
          <Badge variant={cfg.variant} className={(cfg as any).className}>
            {cfg.label}
          </Badge>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {order.type === 'MESA' ? `Mesa ${order.tableNumber}` : 'Balcão'}
          </span>
          <span>
            {formatDistanceToNow(new Date(order.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="text-sm space-y-1 mb-3">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
              </span>
              <span className="text-gray-500">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-semibold text-sm border-t pt-2">
          <span>Total</span>
          <span>R$ {order.total.toFixed(2)}</span>
        </div>
        {order.status === 'READY' && (
          <Button
            size="sm"
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'DELIVERED' })}
            disabled={updateStatus.isPending}
          >
            Marcar Entregue
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Implement `src/app/(cashier)/pdv/orders/page.tsx`**

```typescript
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/socket-context';
import { useOrders } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import OrderCard from './components/order-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';

const STATUS_GROUPS = [
  { value: 'active', label: 'Ativos', statuses: ['PENDING', 'PREPARING', 'READY'] },
  { value: 'delivered', label: 'Entregues', statuses: ['DELIVERED'] },
  { value: 'all', label: 'Todos', statuses: [] },
];

export default function OrdersListPage() {
  const { data: orders = [] } = useOrders();
  const socket = useSocket();
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('active');

  useEffect(() => {
    if (!socket) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ['orders'] });
    socket.on('order:status_changed', refresh);
    socket.on('order:created', refresh);
    return () => {
      socket.off('order:status_changed', refresh);
      socket.off('order:created', refresh);
    };
  }, [socket, qc]);

  const group = STATUS_GROUPS.find((g) => g.value === activeGroup)!;
  const filtered =
    group.statuses.length > 0
      ? orders.filter((o: Order) => group.statuses.includes(o.status))
      : orders;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pedidos</h1>

      <Tabs value={activeGroup} onValueChange={setActiveGroup} className="mb-4">
        <TabsList>
          {STATUS_GROUPS.map((g) => (
            <TabsTrigger key={g.value} value={g.value}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((order: Order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-gray-400 text-center py-8">
            Nenhum pedido encontrado.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npm test -- src/hooks/use-orders.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/hooks/use-orders.ts src/app/\(cashier\)/pdv/
git commit -m "feat: add PDV page with cart flow and real-time orders list"
```

---

### Task 18: KDS page (frontend)

**Files:**
- Create: `src/app/(cook)/kds/page.tsx`
- Create: `src/app/(cook)/kds/components/kds-card.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/(cook)/kds/components/kds-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import KdsCard from './kds-card';
import { useUpdateOrderStatus } from '@/hooks/use-orders';

jest.mock('@/hooks/use-orders');
const mockMutate = jest.fn();
(useUpdateOrderStatus as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false });

const pendingOrder = {
  id: 'o1',
  orderNumber: 42,
  type: 'MESA',
  tableNumber: 3,
  status: 'PENDING',
  items: [{ name: 'Pizza', quantity: 2, unitPrice: 45, notes: 'sem cebola' }],
  createdAt: new Date().toISOString(),
  subtotal: 90,
  discount: 0,
  total: 90,
};

describe('KdsCard', () => {
  it('renders order number and items', () => {
    render(<KdsCard order={pendingOrder as any} />);
    expect(screen.getByText(/#42/)).toBeInTheDocument();
    expect(screen.getByText(/Pizza/)).toBeInTheDocument();
  });

  it('shows Iniciar Preparo button when status is PENDING', () => {
    render(<KdsCard order={pendingOrder as any} />);
    expect(screen.getByRole('button', { name: /iniciar preparo/i })).toBeInTheDocument();
  });

  it('calls updateStatus with PREPARING on Iniciar Preparo click', () => {
    render(<KdsCard order={pendingOrder as any} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar preparo/i }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'o1', status: 'PREPARING' });
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/app/\\(cook\\)/kds/components/kds-card.test.tsx`
Expected: FAIL "Cannot find module './kds-card'"

- [ ] **Step 3: Implement `src/app/(cook)/kds/components/kds-card.tsx`**

```typescript
'use client';
import { useUpdateOrderStatus } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  order: Order;
}

export default function KdsCard({ order }: Props) {
  const updateStatus = useUpdateOrderStatus();

  const elapsed = formatDistanceToNow(new Date(order.createdAt), {
    addSuffix: false,
    locale: ptBR,
  });

  const statusColors: Record<string, string> = {
    PENDING: 'border-yellow-400 bg-yellow-50',
    PREPARING: 'border-blue-400 bg-blue-50',
  };

  return (
    <Card className={`border-2 ${statusColors[order.status] ?? ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">#{order.orderNumber}</span>
          <Badge
            variant={order.status === 'PENDING' ? 'secondary' : 'default'}
            className={order.status === 'PREPARING' ? 'bg-blue-500' : ''}
          >
            {order.status === 'PENDING' ? 'Pendente' : 'Preparando'}
          </Badge>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{order.type === 'MESA' ? `Mesa ${order.tableNumber}` : 'Balcão'}</span>
          <span className="text-orange-500 font-medium">{elapsed}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-sm">
              <span className="font-semibold">
                {item.quantity}× {item.name}
              </span>
              {item.notes && (
                <p className="text-xs text-gray-500 italic ml-4">{item.notes}</p>
              )}
            </li>
          ))}
        </ul>

        {order.status === 'PENDING' && (
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'PREPARING' })}
            disabled={updateStatus.isPending}
          >
            Iniciar Preparo
          </Button>
        )}

        {order.status === 'PREPARING' && (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'READY' })}
            disabled={updateStatus.isPending}
          >
            Marcar Pronto
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Implement `src/app/(cook)/kds/page.tsx`**

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/socket-context';
import { useOrders } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import KdsCard from './components/kds-card';

export default function KdsPage() {
  const { data: orders = [] } = useOrders();
  const socket = useSocket();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      audioRef.current?.play().catch(() => {});
      document.body.classList.add('kds-flash');
      setTimeout(() => document.body.classList.remove('kds-flash'), 500);
    };

    const handleStatusChange = () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    };

    socket.on('order:created', handleNewOrder);
    socket.on('order:status_changed', handleStatusChange);

    return () => {
      socket.off('order:created', handleNewOrder);
      socket.off('order:status_changed', handleStatusChange);
    };
  }, [socket, qc]);

  const activeOrders = orders.filter((o: Order) =>
    ['PENDING', 'PREPARING'].includes(o.status)
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">KDS — Cozinha</h1>
        <span className="text-gray-400 text-sm">
          {activeOrders.length} pedido(s) ativo(s)
        </span>
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-xl">Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeOrders.map((order: Order) => (
            <KdsCard key={order.id} order={order} />
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes kds-flash-anim {
          0%, 100% { background-color: #111827; }
          50% { background-color: #1e3a5f; }
        }
        .kds-flash {
          animation: kds-flash-anim 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
```

Note: add `public/notification.mp3` — place any short audio file there; the ref gracefully ignores missing files via `.catch(() => {})`.

- [ ] **Step 5: Verify**

Run: `npm test -- src/app/\\(cook\\)/kds/components/kds-card.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/app/\(cook\)/kds/
git commit -m "feat: add KDS page with real-time sound and flash on new orders"
```

---

### Task 19: Dashboard page (frontend)

**Files:**
- Create: `src/hooks/use-dashboard.ts`
- Create: `src/app/(admin)/dashboard/page.tsx`
- Create: `src/app/(admin)/dashboard/components/roi-bar-chart.tsx`
- Create: `src/app/(admin)/dashboard/components/margin-pie-chart.tsx`
- Create: `src/app/(admin)/dashboard/components/cost-scatter-chart.tsx`
- Create: `src/app/(admin)/dashboard/components/stock-alerts.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/use-dashboard.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useDashboardSummary, useDashboardProducts } from './use-dashboard';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useDashboardSummary', () => {
  it('fetches from /dashboard/summary', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { totalProducts: 5, avgMarginPct: 42, avgRoi: 72, lowMarginCount: 1, stockAlerts: [] },
    });
    const { result } = renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.avgMarginPct).toBe(42);
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- src/hooks/use-dashboard.test.ts`
Expected: FAIL "Cannot find module './use-dashboard'"

- [ ] **Step 3: Implement `src/hooks/use-dashboard.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DashboardProduct {
  id: string;
  name: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
  roi: number;
  classification: 'ALTO' | 'MEDIO' | 'BAIXO';
}

export interface StockAlert {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface DashboardSummary {
  totalProducts: number;
  avgMarginPct: number;
  avgRoi: number;
  lowMarginCount: number;
  stockAlerts: StockAlert[];
}

export const useDashboardProducts = () =>
  useQuery({
    queryKey: ['dashboard', 'products'],
    queryFn: () => api.get('/dashboard/products').then((r) => r.data),
    staleTime: 60_000,
  });

export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    staleTime: 60_000,
  });
```

- [ ] **Step 4: Implement chart components**

`src/app/(admin)/dashboard/components/roi-bar-chart.tsx`:
```typescript
'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProduct } from '@/hooks/use-dashboard';

interface Props {
  products: DashboardProduct[];
}

export default function RoiBarChart({ products }: Props) {
  const top10 = [...products]
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10)
    .map((p) => ({ name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name, roi: Number(p.roi.toFixed(1)) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top 10 ROI</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={top10} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'ROI']} />
            <Bar dataKey="roi" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

`src/app/(admin)/dashboard/components/margin-pie-chart.tsx`:
```typescript
'use client';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSummary } from '@/hooks/use-dashboard';

interface Props {
  summary?: DashboardSummary;
  products?: { classification: string }[];
}

const COLORS: Record<string, string> = {
  ALTO: '#16a34a',
  MEDIO: '#d97706',
  BAIXO: '#dc2626',
};

export default function MarginPieChart({ products = [] }: Props) {
  const counts = products.reduce<Record<string, number>>(
    (acc, p) => ({ ...acc, [p.classification]: (acc[p.classification] ?? 0) + 1 }),
    {}
  );

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Distribuição de Margem</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={70}
              dataKey="value"
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] ?? '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => [v, 'Produtos']} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

`src/app/(admin)/dashboard/components/cost-scatter-chart.tsx`:
```typescript
'use client';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProduct } from '@/hooks/use-dashboard';

interface Props {
  products: DashboardProduct[];
}

export default function CostScatterChart({ products }: Props) {
  const data = products.map((p) => ({
    cost: Number(p.costPrice.toFixed(2)),
    price: Number(p.salePrice.toFixed(2)),
    name: p.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Custo × Preço de Venda</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="cost"
              name="Custo"
              tickFormatter={(v) => `R$${v}`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              dataKey="price"
              name="Preço"
              tickFormatter={(v) => `R$${v}`}
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: number, name: string) => [
                `R$ ${v.toFixed(2)}`,
                name === 'cost' ? 'Custo' : 'Preço',
              ]}
            />
            <Scatter data={data} fill="#7c3aed" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

`src/app/(admin)/dashboard/components/stock-alerts.tsx`:
```typescript
'use client';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import type { StockAlert } from '@/hooks/use-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function StockAlerts() {
  const { data: summary, isLoading } = useDashboardSummary();
  const alerts: StockAlert[] = summary?.stockAlerts ?? [];

  if (isLoading) return null;
  if (alerts.length === 0) return null;

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-sm text-red-600">
          Alertas de Estoque ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex justify-between items-center text-sm">
              <span className="font-medium">{alert.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">
                  {alert.stock} {alert.unit} / mín {alert.minStock} {alert.unit}
                </span>
                <Badge variant="destructive">Baixo</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Implement `src/app/(admin)/dashboard/page.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useDashboardSummary, useDashboardProducts } from '@/hooks/use-dashboard';
import type { DashboardProduct } from '@/hooks/use-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import RoiBarChart from './components/roi-bar-chart';
import MarginPieChart from './components/margin-pie-chart';
import CostScatterChart from './components/cost-scatter-chart';
import StockAlerts from './components/stock-alerts';

const classificationBg: Record<string, string> = {
  ALTO: 'bg-green-50',
  MEDIO: 'bg-yellow-50',
  BAIXO: 'bg-red-50',
};

const classificationBadge: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ALTO: 'default',
  MEDIO: 'secondary',
  BAIXO: 'destructive',
};

type SortKey = keyof Pick<
  DashboardProduct,
  'costPrice' | 'salePrice' | 'margin' | 'marginPct' | 'roi'
>;

export default function DashboardPage() {
  const { data: summary } = useDashboardSummary();
  const { data: products = [], isLoading } = useDashboardProducts();
  const [sortBy, setSortBy] = useState<string>('marginPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...products].sort((a: DashboardProduct, b: DashboardProduct) => {
    const av = (a as any)[sortBy] ?? 0;
    const bv = (b as any)[sortBy] ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const colIcon = (col: string) =>
    sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-gray-500">Produtos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary?.totalProducts ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-gray-500">Margem Média</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary?.avgMarginPct?.toFixed(1) ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-gray-500">ROI Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary?.avgRoi?.toFixed(1) ?? 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-gray-500">Margem Baixa</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="destructive" className="text-xl px-3 py-1">
              {summary?.lowMarginCount ?? 0}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RoiBarChart products={products} />
        <MarginPieChart products={products} />
        <CostScatterChart products={products} />
      </div>

      {/* Products table */}
      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {(
                [
                  ['name', 'Nome'],
                  ['categoryName', 'Categoria'],
                  ['costPrice', 'Custo'],
                  ['salePrice', 'Preço Venda'],
                  ['margin', 'Margem R$'],
                  ['marginPct', 'Margem %'],
                  ['roi', 'ROI %'],
                  ['classification', 'Classif.'],
                ] as [string, string][]
              ).map(([col, label]) => (
                <TableHead
                  key={col}
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort(col)}
                >
                  {label}{colIcon(col)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p: DashboardProduct) => (
              <TableRow
                key={p.id}
                className={classificationBg[p.classification] ?? ''}
              >
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.categoryName}</TableCell>
                <TableCell>R$ {p.costPrice.toFixed(2)}</TableCell>
                <TableCell>R$ {p.salePrice.toFixed(2)}</TableCell>
                <TableCell>R$ {p.margin.toFixed(2)}</TableCell>
                <TableCell>{p.marginPct.toFixed(1)}%</TableCell>
                <TableCell>{p.roi.toFixed(1)}%</TableCell>
                <TableCell>
                  <Badge variant={classificationBadge[p.classification]}>
                    {p.classification}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <StockAlerts />
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm test -- src/hooks/use-dashboard.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-dashboard.ts src/app/\(admin\)/dashboard/
git commit -m "feat: add dashboard page with ROI bar chart, margin pie, scatter chart, and stock alerts"
```
