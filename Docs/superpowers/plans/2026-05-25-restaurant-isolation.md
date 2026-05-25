# Restaurant Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope every backend module query to the authenticated user's `restaurantId` so data from different restaurants is never mixed.

**Architecture:** The full JWT already carries `restaurantId` (set after empresa selection). `@CurrentUser()` exposes `{ userId, restaurantId, role, name }` in any guarded route. Each service method gains a `restaurantId` parameter and adds it to every Prisma `WHERE` clause. Controllers extract it from `@CurrentUser()` and pass it down.

**Tech Stack:** NestJS, Prisma, SQLite, Jest

---

## File Map

| File | Change |
|---|---|
| `src/products/products.service.ts` | Add `restaurantId` to findAll, findOne, getTechnicalSheet, update, remove |
| `src/products/products.controller.ts` | Inject `@CurrentUser()` into all route handlers |
| `src/products/products.service.spec.ts` | Update calls + add isolation tests |
| `src/ingredients/ingredients.service.ts` | Add `restaurantId` to findAll, findOne, update, remove |
| `src/ingredients/ingredients.controller.ts` | Inject `@CurrentUser()` into findAll, findOne, update, remove |
| `src/ingredients/ingredients.service.spec.ts` | Update calls + add isolation tests |
| `src/orders/orders.service.ts` | Add `restaurantId` to findAll, findOne, updateStatus, cancel, addItem, removeItem |
| `src/orders/orders.controller.ts` | Inject `@CurrentUser()` into findAll, findOne, cancel, addItem, removeItem |
| `src/orders/orders.service.spec.ts` | Update calls + add isolation tests |
| `src/menu/menu.service.ts` | Add `restaurantId` to findAll, findByCategory, toggle |
| `src/menu/menu.controller.ts` | Add `@CurrentUser()` import and inject into all handlers |
| `src/menu/menu.service.spec.ts` | Update calls + add isolation tests |
| `src/dashboard/dashboard.service.ts` | Add `restaurantId` to all public methods |
| `src/dashboard/dashboard.controller.ts` | Add `@CurrentUser()` import and inject into all handlers |
| `src/dashboard/dashboard.service.spec.ts` | Update calls + add isolation tests |

---

### Task 1: Products — scope by restaurantId

**Files:**
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.controller.ts`
- Modify: `src/products/products.service.spec.ts`

Working directory for all commands: `C:\Users\rcrosa\Desktop\SisGerCoz\gercoz-backend`

- [ ] **Step 1: Write the failing test**

Add these two tests to `products.service.spec.ts`, inside `describe('findAll', ...)`:

```typescript
it('filters products by restaurantId', async () => {
  mockPrisma.product.findMany.mockResolvedValue([]);
  await service.findAll('rest-1');
  expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
  );
});
```

And inside `describe('remove', ...)`:

```typescript
it('throws NotFoundException when product does not belong to restaurant', async () => {
  mockPrisma.product.findMany.mockResolvedValue([]);
  // findFirst returns null — product belongs to a different restaurant
  jest.spyOn(mockPrisma.product, 'findMany'); // existing mock
  // We'll add findFirst below when it's available; for now stub via update path
});
```

Actually skip the remove isolation test for now — focus on the findAll isolation test first.

Simpler approach: add a mock for `findFirst` to `mockPrisma.product`:

Replace the `mockPrisma` in the file to add `findFirst`:

```typescript
const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recipeItem: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
```

Add inside `describe('findAll')`:

```typescript
it('passes restaurantId to prisma where clause', async () => {
  mockPrisma.product.findMany.mockResolvedValue([]);
  await service.findAll('rest-1');
  expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
  );
});
```

Add inside `describe('remove')`:

```typescript
it('throws NotFoundException when product not found in restaurant', async () => {
  mockPrisma.product.findFirst.mockResolvedValue(null);
  await expect(service.remove('prod-x', 'rest-1')).rejects.toThrow(NotFoundException);
  expect(mockPrisma.product.update).not.toHaveBeenCalled();
});
```

Add `NotFoundException` to the import at the top of `products.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest src/products/products.service.spec.ts --no-coverage
```

Expected: FAIL — `service.findAll()` call fails (wrong arity), `service.remove()` doesn't take 2 args.

- [ ] **Step 3: Implement products.service.ts**

Replace the full content of `src/products/products.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface ProductMetrics {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  preparationTime: number;
  margin: number;
  marginPct: number;
  roi: number;
  recipeItems: { ingredientId: string; quantity: number; unit: string }[];
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
    description?: string | null;
    categoryId?: string | null;
    salePrice: number;
    preparationTime: number;
    category?: { name: string } | null;
    recipeItems: { ingredientId: string; quantity: number; unit: string; ingredient: { costPrice: number } }[];
  }): ProductMetrics {
    const costPrice = product.recipeItems.reduce(
      (sum, item) => sum + item.quantity * item.ingredient.costPrice,
      0,
    );
    const margin = product.salePrice - costPrice;
    const marginPct = product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
    const roi = costPrice > 0 ? (margin / costPrice) * 100 : 0;
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? undefined,
      categoryId: product.categoryId ?? undefined,
      categoryName: product.category?.name ?? 'Sem Categoria',
      costPrice,
      salePrice: product.salePrice,
      preparationTime: product.preparationTime,
      margin,
      marginPct,
      roi,
      recipeItems: product.recipeItems.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };
  }

  async findAll(restaurantId: string): Promise<ProductMetrics[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, restaurantId },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => this.calcMetrics(p));
  }

  async findOne(id: string, restaurantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, restaurantId },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async getTechnicalSheet(id: string, restaurantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, restaurantId },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    const ingredients = product.recipeItems.map((item) => {
      const unitCost = item.ingredient.costPrice;
      const partialCost = item.quantity * unitCost;
      return { name: item.ingredient.name, quantity: item.quantity, unit: item.unit, unitCost, partialCost };
    });

    const totalCost = ingredients.reduce((s, i) => s + i.partialCost, 0);
    const margin = product.salePrice - totalCost;
    const marginPct = product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
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

  async create(dto: CreateProductDto, restaurantId: string) {
    const { recipeItems, ...productData } = dto;
    return this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          ...productData,
          restaurantId,
          recipeItems: {
            create: recipeItems.map((item) => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          },
        },
        include: { category: true, recipeItems: { include: { ingredient: true } } },
      });
    });
  }

  async update(id: string, dto: UpdateProductDto, restaurantId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, restaurantId } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);

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
          } as any,
          include: { category: true, recipeItems: { include: { ingredient: true } } },
        });
      });
    }

    return this.prisma.product.update({
      where: { id },
      data: productData as any,
      include: { category: true, recipeItems: { include: { ingredient: true } } },
    });
  }

  async remove(id: string, restaurantId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, restaurantId } });
    if (!existing) throw new NotFoundException(`Product ${id} not found`);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

- [ ] **Step 4: Update products.controller.ts**

Replace the full content of `src/products/products.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('products')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@CurrentUser() user: { restaurantId: string }) {
    return this.productsService.findAll(user.restaurantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: { restaurantId: string }) {
    return this.productsService.findOne(id, user.restaurantId);
  }

  @Get(':id/ficha-tecnica')
  async getTechnicalSheet(@Param('id') id: string, @CurrentUser() user: { restaurantId: string }) {
    return this.productsService.getTechnicalSheet(id, user.restaurantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.productsService.create(dto, user.restaurantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.productsService.update(id, dto, user.restaurantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: { restaurantId: string }) {
    return this.productsService.remove(id, user.restaurantId);
  }
}
```

- [ ] **Step 5: Update products.service.spec.ts to pass restaurantId**

Update existing `findAll` test and `update` test to pass `restaurantId`. In the spec file:

- `service.findAll()` → `service.findAll('rest-1')`
- `service.update('prod-1', dto as any)` → `service.update('prod-1', dto as any, 'rest-1')`
- For the `update` test, add a `findFirst` mock before the transaction: `mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });`
- `service.remove('prod-1')` → no longer exists; `remove` now needs `restaurantId`. Update the `remove` test to use `service.remove('prod-1', 'rest-1')` and add `mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });` before the call. Also update the expectation to `mockPrisma.product.update` (unchanged).

Full updated `products.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../common/prisma.service';

const mockPrisma = {
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recipeItem: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  describe('computeCost', () => {
    it('sums quantity * costPrice for all recipe items', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue({
        id: 'prod-1',
        recipeItems: [
          { quantity: 0.5, ingredient: { costPrice: 10 } },
          { quantity: 2, ingredient: { costPrice: 3 } },
        ],
      });
      const cost = await service.computeCost('prod-1');
      expect(cost).toBe(11);
    });

    it('returns 0 when there are no recipe items', async () => {
      mockPrisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'prod-2', recipeItems: [] });
      const cost = await service.computeCost('prod-2');
      expect(cost).toBe(0);
    });
  });

  describe('create', () => {
    it('creates product with recipe items in a transaction', async () => {
      const dto = {
        name: 'Pizza Margherita', salePrice: 45.0,
        recipeItems: [{ ingredientId: 'ing-1', quantity: 0.4, unit: 'KG' }],
      };
      const createdProduct = { id: 'prod-new', ...dto };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({ product: { create: jest.fn().mockResolvedValue(createdProduct) } })
      );
      const result = await service.create(dto as any, 'rest-1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(createdProduct);
    });
  });

  describe('findAll', () => {
    it('computes margin, marginPct and roi for each product', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{
        id: 'p1', name: 'X-Burguer', salePrice: 18,
        category: { name: 'Lanches' },
        recipeItems: [
          { quantity: 1, ingredient: { costPrice: 1.5 } },
          { quantity: 0.1, ingredient: { costPrice: 35 } },
        ],
      }]);
      const result = await service.findAll('rest-1');
      expect(result[0].costPrice).toBeCloseTo(5);
      expect(result[0].margin).toBeCloseTo(13);
      expect(result[0].marginPct).toBeCloseTo(72.22, 1);
      expect(result[0].roi).toBeCloseTo(260);
    });

    it('passes restaurantId to prisma where clause', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await service.findAll('rest-1');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
      );
    });
  });

  describe('update', () => {
    it('deletes and recreates recipe items when recipeItems is provided', async () => {
      const dto = { name: 'Updated', recipeItems: [{ ingredientId: 'ing-1', quantity: 1, unit: 'UN' }] };
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          recipeItem: { deleteMany: jest.fn() },
          product: { update: jest.fn().mockResolvedValue({ id: 'prod-1', ...dto }) },
        })
      );
      const result = await service.update('prod-1', dto as any, 'rest-1');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('soft deletes product by setting isActive=false', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.product.update.mockResolvedValue({ id: 'prod-1', isActive: false });
      await service.remove('prod-1', 'rest-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
    });

    it('throws NotFoundException when product not found in restaurant', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.remove('prod-x', 'rest-1')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run tests and verify all pass**

```bash
npx jest src/products/products.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/products/products.service.ts src/products/products.controller.ts src/products/products.service.spec.ts
git commit -m "feat: scope products module to restaurantId"
```

---

### Task 2: Ingredients — scope by restaurantId

**Files:**
- Modify: `src/ingredients/ingredients.service.ts`
- Modify: `src/ingredients/ingredients.controller.ts`
- Modify: `src/ingredients/ingredients.service.spec.ts`

Working directory: `C:\Users\rcrosa\Desktop\SisGerCoz\gercoz-backend`

- [ ] **Step 1: Write failing tests**

Add to `ingredients.service.spec.ts`, inside `describe('findAll')` (add this describe if it doesn't exist):

```typescript
describe('findAll', () => {
  it('passes restaurantId to prisma where clause', async () => {
    mockPrisma.ingredient.findMany.mockResolvedValue([]);
    await service.findAll({}, 'rest-1');
    expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
    );
  });
});
```

Add inside `describe('remove')`:

```typescript
it('scopes removal to restaurantId', async () => {
  mockPrisma.ingredient.findFirst.mockResolvedValue(null);
  await expect(service.remove('ing-1', 'rest-other')).rejects.toThrow(NotFoundException);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest src/ingredients/ingredients.service.spec.ts --no-coverage
```

Expected: FAIL — `findAll` takes wrong number of args, `remove` takes wrong number of args.

- [ ] **Step 3: Implement ingredients.service.ts**

Replace the full content of `src/ingredients/ingredients.service.ts`:

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

  async findAll(query: { isActive?: boolean; name?: string }, restaurantId: string) {
    return this.prisma.ingredient.findMany({
      where: {
        restaurantId,
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.name ? { name: { contains: query.name } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, restaurantId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, restaurantId },
      include: { priceHistory: { orderBy: { changedAt: 'desc' }, take: 10 } },
    });
    if (!ingredient) throw new NotFoundException(`Ingredient ${id} not found`);
    return ingredient;
  }

  async create(dto: CreateIngredientDto, _userId: string, restaurantId: string) {
    return this.prisma.ingredient.create({ data: { ...dto, restaurantId } });
  }

  async update(id: string, dto: UpdateIngredientDto, userId: string, restaurantId: string) {
    const existing = await this.prisma.ingredient.findFirst({ where: { id, restaurantId } });
    if (!existing) throw new NotFoundException(`Ingredient ${id} not found`);

    const dtoAny = dto as any;
    const priceChanged =
      dtoAny.costPrice !== undefined && dtoAny.costPrice !== existing.costPrice;

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: dto as any,
    });

    if (priceChanged) {
      await this.prisma.ingredientPriceHistory.create({
        data: { ingredientId: id, price: dtoAny.costPrice, changedBy: userId },
      });
      this.eventEmitter.emit('ingredient.price_updated', {
        ingredientId: id,
        newCostPrice: dtoAny.costPrice,
      });
    }

    return updated;
  }

  async remove(id: string, restaurantId: string) {
    const existing = await this.prisma.ingredient.findFirst({ where: { id, restaurantId } });
    if (!existing) throw new NotFoundException(`Ingredient ${id} not found`);
    return this.prisma.ingredient.update({ where: { id }, data: { isActive: false } });
  }
}
```

- [ ] **Step 4: Update ingredients.controller.ts**

Replace the full content of `src/ingredients/ingredients.controller.ts`:

```typescript
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
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
  async findAll(
    @Query() query: { isActive?: string; name?: string },
    @CurrentUser() user: { restaurantId: string },
  ) {
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;
    return this.ingredientsService.findAll({ isActive, name: query.name }, user.restaurantId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ingredientsService.findOne(id, user.restaurantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateIngredientDto,
    @CurrentUser() user: { userId: string; restaurantId: string },
  ) {
    return this.ingredientsService.create(dto, user.userId, user.restaurantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() user: { userId: string; restaurantId: string },
  ) {
    return this.ingredientsService.update(id, dto, user.userId, user.restaurantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ingredientsService.remove(id, user.restaurantId);
  }
}
```

- [ ] **Step 5: Update ingredients.service.spec.ts**

The existing tests call `service.update('ing-1', dto, 'user-1')` — add `restaurantId` as 4th arg. The `remove` tests call `service.remove('ing-1')` — add `restaurantId`.

Replace the full content of `src/ingredients/ingredients.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../common/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';

const existingIngredient = {
  id: 'ing-1', restaurantId: 'rest-1', name: 'Flour',
  unit: Unit.KG, costPrice: 2.5, stock: 10, minStock: 2,
  isActive: true, description: null, supplier: null,
  expiryDate: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockPrisma = {
  ingredient: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  ingredientPriceHistory: { create: jest.fn() },
};

const mockEventEmitter = { emit: jest.fn() };

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

  describe('findAll', () => {
    it('passes restaurantId to prisma where clause', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([]);
      await service.findAll({}, 'rest-1');
      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
      );
    });
  });

  describe('create', () => {
    it('should include restaurantId from caller in prisma create', async () => {
      mockPrisma.ingredient.create.mockResolvedValue({ ...existingIngredient });
      await service.create(
        { name: 'Flour', unit: Unit.KG, costPrice: 2.5 },
        'user-1',
        'rest-1',
      );
      expect(mockPrisma.ingredient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ restaurantId: 'rest-1' }),
      });
    });
  });

  describe('update', () => {
    it('should emit ingredient.price_updated when costPrice changes', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({ ...existingIngredient, costPrice: 3.5 });
      mockPrisma.ingredientPriceHistory.create.mockResolvedValue({});
      await service.update('ing-1', { costPrice: 3.5 }, 'user-1', 'rest-1');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('ingredient.price_updated', { ingredientId: 'ing-1', newCostPrice: 3.5 });
    });

    it('should create IngredientPriceHistory when costPrice changes', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({ ...existingIngredient, costPrice: 4.0 });
      mockPrisma.ingredientPriceHistory.create.mockResolvedValue({});
      await service.update('ing-1', { costPrice: 4.0 }, 'user-1', 'rest-1');
      expect(mockPrisma.ingredientPriceHistory.create).toHaveBeenCalledWith({
        data: { ingredientId: 'ing-1', price: 4.0, changedBy: 'user-1' },
      });
    });

    it('should NOT emit event when costPrice is unchanged', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue(existingIngredient);
      await service.update('ing-1', { name: 'Wheat Flour' }, 'user-1', 'rest-1');
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockPrisma.ingredientPriceHistory.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if ingredient does not exist', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      await expect(service.update('bad-id', { name: 'X' }, 'user-1', 'rest-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete ingredient by setting isActive=false', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(existingIngredient);
      mockPrisma.ingredient.update.mockResolvedValue({ ...existingIngredient, isActive: false });
      await service.remove('ing-1', 'rest-1');
      expect(mockPrisma.ingredient.update).toHaveBeenCalledWith({ where: { id: 'ing-1' }, data: { isActive: false } });
    });

    it('should throw NotFoundException if ingredient does not exist', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'rest-1')).rejects.toThrow(NotFoundException);
    });

    it('scopes removal to restaurantId', async () => {
      mockPrisma.ingredient.findFirst.mockResolvedValue(null);
      await expect(service.remove('ing-1', 'rest-other')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/ingredients/ingredients.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ingredients/ingredients.service.ts src/ingredients/ingredients.controller.ts src/ingredients/ingredients.service.spec.ts
git commit -m "feat: scope ingredients module to restaurantId"
```

---

### Task 3: Orders — scope by restaurantId

**Files:**
- Modify: `src/orders/orders.service.ts`
- Modify: `src/orders/orders.controller.ts`
- Modify: `src/orders/orders.service.spec.ts`

Working directory: `C:\Users\rcrosa\Desktop\SisGerCoz\gercoz-backend`

- [ ] **Step 1: Write failing test**

Add to `orders.service.spec.ts`, a new `describe('findAll')` block:

```typescript
describe('findAll', () => {
  it('passes restaurantId to prisma where clause', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    await service.findAll({}, 'rest-1');
    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
    );
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest src/orders/orders.service.spec.ts --no-coverage
```

Expected: FAIL — `findAll` wrong arity.

- [ ] **Step 3: Implement orders.service.ts**

Replace the full content of `src/orders/orders.service.ts`:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
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
      throw new BadRequestException('tableNumber is required for MESA orders');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const last = await tx.order.findFirst({
        where: { restaurantId },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;

      const productIds = dto.items.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
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

  private mapOrder(order: any) {
    const items = order.items.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      name: item.product?.name ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
    }));
    const subtotal = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
    const discount = order.discount ?? 0;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableNumber: order.tableNumber,
      status: order.status,
      notes: order.notes,
      items,
      subtotal,
      discount,
      total: subtotal - discount,
      createdAt: order.createdAt,
      closedAt: order.closedAt,
    };
  }

  async findAll(filters: { status?: OrderStatus; type?: OrderType }, restaurantId: string) {
    const where: any = { restaurantId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
      orderBy: { orderNumber: 'desc' },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async findOne(id: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, restaurantId },
      include: { items: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.mapOrder(order);
  }

  async updateStatus(id: string, status: OrderStatus, restaurantId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, restaurantId } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    const isTerminal = status === OrderStatus.DELIVERED;
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status, ...(isTerminal ? { closedAt: new Date() } : {}) },
    });
    this.gateway.emitStatusChanged(restaurantId, updated);
    return updated;
  }

  async cancel(id: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({ where: { id, restaurantId } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only PENDING orders can be cancelled');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED, closedAt: new Date() },
    });
  }

  async addItem(orderId: string, item: { productId: string; quantity: number; notes?: string }, restaurantId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, restaurantId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
    return this.prisma.orderItem.create({
      data: { orderId, productId: item.productId, quantity: item.quantity, unitPrice: product.salePrice, notes: item.notes },
      include: { product: true },
    });
  }

  async removeItem(orderId: string, itemId: string, restaurantId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, restaurantId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return this.prisma.orderItem.delete({ where: { id: itemId, orderId } });
  }
}
```

- [ ] **Step 4: Update orders.controller.ts**

Replace the full content of `src/orders/orders.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, OrderStatus, OrderType } from '@prisma/client';

@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  async findAll(
    @Query('status') status: OrderStatus | undefined,
    @Query('type') type: OrderType | undefined,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.findAll({ status, type }, user.restaurantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.findOne(id, user.restaurantId);
  }

  @Post()
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: { userId: string; restaurantId: string },
  ) {
    return this.ordersService.create(dto, user.userId, user.restaurantId);
  }

  @Patch(':id/status')
  @Roles(UserRole.CASHIER, UserRole.COOK, UserRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.updateStatus(id, dto.status, user.restaurantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.cancel(id, user.restaurantId);
  }

  @Post(':id/items')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Param('id') orderId: string,
    @Body() body: { productId: string; quantity: number; notes?: string },
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.addItem(orderId, body, user.restaurantId);
  }

  @Delete(':id/items/:itemId')
  @Roles(UserRole.CASHIER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.ordersService.removeItem(orderId, itemId, user.restaurantId);
  }
}
```

- [ ] **Step 5: Update orders.service.spec.ts**

The `cancel` test uses `mockPrisma.order.findUniqueOrThrow` — after the change, `cancel` uses `findFirst`. Also `updateStatus` now calls `findFirst` before `update`. Update the spec:

Replace full content of `src/orders/orders.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../common/prisma.service';
import { OrdersGateway } from './orders.gateway';
import { OrderType, OrderStatus } from '@prisma/client';

const mockPrisma = {
  order: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  product: { findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  orderItem: { create: jest.fn(), delete: jest.fn() },
  $transaction: jest.fn(),
};

const mockGateway = { emitOrderCreated: jest.fn(), emitStatusChanged: jest.fn() };

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrdersGateway, useValue: mockGateway },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  describe('create', () => {
    it('throws BadRequestException if type=MESA without tableNumber', async () => {
      await expect(service.create({ type: OrderType.MESA, items: [] } as any, 'user-1', 'rest-1'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('generates orderNumber as MAX + 1 per restaurant', async () => {
      const createdOrder = { id: 'order-new', orderNumber: 6, type: OrderType.BALCAO, items: [] };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          order: { findFirst: jest.fn().mockResolvedValue({ orderNumber: 5 }), create: jest.fn().mockResolvedValue(createdOrder) },
          product: { findMany: jest.fn().mockResolvedValue([]) },
        })
      );
      const result = await service.create({ type: OrderType.BALCAO, items: [] } as any, 'user-1', 'rest-1');
      expect(result.orderNumber).toBe(6);
    });

    it('starts orderNumber at 1 when no previous orders exist', async () => {
      const createdOrder = { id: 'order-1', orderNumber: 1, items: [] };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          order: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(createdOrder) },
          product: { findMany: jest.fn().mockResolvedValue([]) },
        })
      );
      const result = await service.create({ type: OrderType.BALCAO, items: [] } as any, 'user-1', 'rest-1');
      expect(result.orderNumber).toBe(1);
    });

    it('snapshots unitPrice from product.salePrice', async () => {
      let capturedCreateData: any;
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          order: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((args: any) => { capturedCreateData = args.data; return Promise.resolve({ id: 'o1', orderNumber: 1, items: [] }); }),
          },
          product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod-1', salePrice: 25.0 }]) },
        })
      );
      await service.create({ type: OrderType.BALCAO, items: [{ productId: 'prod-1', quantity: 2 }] } as any, 'user-1', 'rest-1');
      expect(capturedCreateData.items.create[0].unitPrice).toBe(25.0);
    });

    it('emits order:created event after creation', async () => {
      const createdOrder = { id: 'o1', orderNumber: 1, items: [] };
      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          order: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(createdOrder) },
          product: { findMany: jest.fn().mockResolvedValue([]) },
        })
      );
      await service.create({ type: OrderType.BALCAO, items: [] } as any, 'user-1', 'rest-1');
      expect(mockGateway.emitOrderCreated).toHaveBeenCalledWith('rest-1', createdOrder);
    });
  });

  describe('findAll', () => {
    it('passes restaurantId to prisma where clause', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      await service.findAll({}, 'rest-1');
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
      );
    });
  });

  describe('updateStatus', () => {
    it('sets closedAt when status is DELIVERED', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'o1', status: OrderStatus.PREPARING });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.DELIVERED, closedAt: new Date() });
      await service.updateStatus('o1', OrderStatus.DELIVERED, 'rest-1');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.DELIVERED, closedAt: expect.any(Date) }),
      }));
    });

    it('does not set closedAt for non-terminal statuses', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'o1', status: OrderStatus.PENDING });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.PREPARING });
      await service.updateStatus('o1', OrderStatus.PREPARING, 'rest-1');
      const callData = mockPrisma.order.update.mock.calls[0][0].data;
      expect(callData).not.toHaveProperty('closedAt');
    });

    it('throws NotFoundException when order not in restaurant', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.updateStatus('o1', OrderStatus.PREPARING, 'rest-other')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels a PENDING order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'o1', status: OrderStatus.PENDING });
      mockPrisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.CANCELLED });
      await service.cancel('o1', 'rest-1');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: OrderStatus.CANCELLED, closedAt: expect.any(Date) },
      });
    });

    it('throws BadRequestException when cancelling a non-PENDING order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'o1', status: OrderStatus.PREPARING });
      await expect(service.cancel('o1', 'rest-1')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when order not in restaurant', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.cancel('o1', 'rest-other')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/orders/orders.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/orders/orders.service.ts src/orders/orders.controller.ts src/orders/orders.service.spec.ts
git commit -m "feat: scope orders module to restaurantId"
```

---

### Task 4: Menu — scope by restaurantId

**Files:**
- Modify: `src/menu/menu.service.ts`
- Modify: `src/menu/menu.controller.ts`
- Modify: `src/menu/menu.service.spec.ts`

Working directory: `C:\Users\rcrosa\Desktop\SisGerCoz\gercoz-backend`

- [ ] **Step 1: Write failing test**

Add to `menu.service.spec.ts`, inside `describe('findAll')`:

```typescript
it('passes restaurantId to prisma where clause', async () => {
  mockPrisma.product.findMany.mockResolvedValue([]);
  await service.findAll('rest-1');
  expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
  );
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest src/menu/menu.service.spec.ts --no-coverage
```

Expected: FAIL — `findAll()` wrong arity.

- [ ] **Step 3: Implement menu.service.ts**

Replace the full content of `src/menu/menu.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MenuItemDto, MenuCategoryDto } from './dto/menu-category.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(restaurantId: string): Promise<MenuItemDto[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, restaurantId },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? 'Sem Categoria',
      salePrice: p.salePrice,
      preparationTime: p.preparationTime,
      isActive: p.isActive,
    }));
  }

  async findByCategory(categoryId: string, restaurantId: string): Promise<MenuCategoryDto | null> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, categoryId, restaurantId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) return null;

    const catName = products[0].category?.name ?? 'Sem Categoria';
    return {
      category: catName,
      products: products.map((p) => ({
        id: p.id, name: p.name, description: p.description,
        categoryId: p.categoryId, categoryName: catName,
        salePrice: p.salePrice, preparationTime: p.preparationTime, isActive: p.isActive,
      })),
    };
  }

  async toggle(productId: string, restaurantId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, restaurantId } });
    if (!product) return;
    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive },
    });
  }
}
```

- [ ] **Step 4: Update menu.controller.ts**

Replace the full content of `src/menu/menu.controller.ts`:

```typescript
import { Controller, Get, Param, Patch, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('menu')
@UseGuards(RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER, UserRole.COOK)
  async findAll(@CurrentUser() user: { restaurantId: string }) {
    return this.menuService.findAll(user.restaurantId);
  }

  @Get('categories/:categoryId')
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  async findByCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.menuService.findByCategory(categoryId, user.restaurantId);
  }

  @Patch(':productId/toggle')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async toggle(
    @Param('productId') productId: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.menuService.toggle(productId, user.restaurantId);
  }
}
```

- [ ] **Step 5: Update menu.service.spec.ts**

Update existing tests that call `service.findAll()` to pass `'rest-1'`.

Replace the full content of `src/menu/menu.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../common/prisma.service';

const mockPrisma = {
  product: { findMany: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
};

describe('MenuService', () => {
  let service: MenuService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MenuService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<MenuService>(MenuService);
  });

  describe('findAll', () => {
    it('returns flat list of active products with categoryName', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'X-Burguer', description: null, salePrice: 18, preparationTime: 15, isActive: true, categoryId: 'cat-1', category: { name: 'Lanches' } },
        { id: 'p2', name: 'Pizza', description: null, salePrice: 45, preparationTime: 25, isActive: true, categoryId: 'cat-2', category: { name: 'Pizzas' } },
      ]);
      const result = await service.findAll('rest-1');
      expect(result).toHaveLength(2);
      expect(result[0].categoryName).toBe('Lanches');
      expect(result[1].categoryName).toBe('Pizzas');
    });

    it('only returns active products', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Active', description: null, salePrice: 10, preparationTime: 5, isActive: true, categoryId: 'cat-1', category: { name: 'Cat' } },
      ]);
      await service.findAll('rest-1');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true, restaurantId: 'rest-1' } }));
    });

    it('assigns "Sem Categoria" for products without a category', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Orphan', description: null, salePrice: 5, preparationTime: 5, isActive: true, categoryId: null, category: null },
      ]);
      const result = await service.findAll('rest-1');
      expect(result[0].categoryName).toBe('Sem Categoria');
    });

    it('passes restaurantId to prisma where clause', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await service.findAll('rest-1');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
      );
    });
  });

  describe('toggle', () => {
    it('flips isActive from true to false', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p1', isActive: true });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', isActive: false });
      await service.toggle('p1', 'rest-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isActive: false } });
    });

    it('flips isActive from false to true', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p1', isActive: false });
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', isActive: true });
      await service.toggle('p1', 'rest-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isActive: true } });
    });

    it('does nothing when product not found in restaurant', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await service.toggle('p1', 'rest-other');
      expect(mockPrisma.product.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/menu/menu.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/menu/menu.service.ts src/menu/menu.controller.ts src/menu/menu.service.spec.ts
git commit -m "feat: scope menu module to restaurantId"
```

---

### Task 5: Dashboard — scope by restaurantId

**Files:**
- Modify: `src/dashboard/dashboard.service.ts`
- Modify: `src/dashboard/dashboard.controller.ts`
- Modify: `src/dashboard/dashboard.service.spec.ts`

Working directory: `C:\Users\rcrosa\Desktop\SisGerCoz\gercoz-backend`

- [ ] **Step 1: Write failing test**

Add to `dashboard.service.spec.ts`, inside `describe('getAllProducts')`:

```typescript
it('passes restaurantId to prisma where clause', async () => {
  mockPrisma.product.findMany.mockResolvedValue([]);
  await service.getAllProducts('rest-1');
  expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
  );
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest src/dashboard/dashboard.service.spec.ts --no-coverage
```

Expected: FAIL — `getAllProducts()` wrong arity.

- [ ] **Step 3: Implement dashboard.service.ts**

Replace the full content of `src/dashboard/dashboard.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

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
    const marginPct = product.salePrice > 0 ? (margin / product.salePrice) * 100 : 0;
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

  async getAllProducts(restaurantId: string): Promise<ProductMetrics[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, restaurantId },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => this.computeMetrics(p));
  }

  async getOneProduct(id: string, restaurantId: string): Promise<ProductMetrics> {
    const product = await this.prisma.product.findFirst({
      where: { id, restaurantId },
      include: { category: true, recipeItems: { include: { ingredient: true } } },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return this.computeMetrics(product);
  }

  async getSummary(restaurantId: string) {
    const metrics = await this.getAllProducts(restaurantId);
    const avgMarginPct = metrics.reduce((s, m) => s + m.marginPct, 0) / (metrics.length || 1);
    const avgRoi = metrics.reduce((s, m) => s + m.roi, 0) / (metrics.length || 1);
    const sorted = [...metrics].sort((a, b) => b.margin - a.margin);

    const ingredients = await this.prisma.ingredient.findMany({ where: { isActive: true, restaurantId } });
    const lowStock = ingredients.filter((i) => i.stock <= i.minStock);

    return {
      totalProducts: metrics.length,
      avgMarginPct: +avgMarginPct.toFixed(2),
      avgRoi: +avgRoi.toFixed(2),
      highMarginCount: metrics.filter((m) => m.classification === 'ALTO').length,
      mediumMarginCount: metrics.filter((m) => m.classification === 'MEDIO').length,
      lowMarginCount: metrics.filter((m) => m.classification === 'BAIXO').length,
      mostProfitableProduct: sorted[0] ? { name: sorted[0].name, margin: sorted[0].margin, roi: sorted[0].roi } : null,
      leastProfitableProduct: sorted[sorted.length - 1] ? { name: sorted[sorted.length - 1].name, margin: sorted[sorted.length - 1].margin, roi: sorted[sorted.length - 1].roi } : null,
      ingredientsLowStock: lowStock,
    };
  }

  async getTopProfitable(restaurantId: string): Promise<ProductMetrics[]> {
    const metrics = await this.getAllProducts(restaurantId);
    return [...metrics].sort((a, b) => b.margin - a.margin).slice(0, 5);
  }

  async getLowMargin(restaurantId: string): Promise<ProductMetrics[]> {
    const metrics = await this.getAllProducts(restaurantId);
    return metrics.filter((m) => m.marginPct < 30);
  }
}
```

Note: `findFirstOrThrow` is available in Prisma. If your Prisma version doesn't support it, use `findFirst` + manual 404 throw.

- [ ] **Step 4: Update dashboard.controller.ts**

Replace the full content of `src/dashboard/dashboard.controller.ts`:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('dashboard')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('products')
  async getAllProducts(@CurrentUser() user: { restaurantId: string }) {
    return this.dashboardService.getAllProducts(user.restaurantId);
  }

  @Get('products/:id')
  async getOneProduct(
    @Param('id') id: string,
    @CurrentUser() user: { restaurantId: string },
  ) {
    return this.dashboardService.getOneProduct(id, user.restaurantId);
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: { restaurantId: string }) {
    return this.dashboardService.getSummary(user.restaurantId);
  }

  @Get('top-profitable')
  async getTopProfitable(@CurrentUser() user: { restaurantId: string }) {
    return this.dashboardService.getTopProfitable(user.restaurantId);
  }

  @Get('low-margin')
  async getLowMargin(@CurrentUser() user: { restaurantId: string }) {
    return this.dashboardService.getLowMargin(user.restaurantId);
  }
}
```

- [ ] **Step 5: Update dashboard.service.spec.ts**

Update all calls that use `service.getAllProducts()`, `service.getSummary()`, `service.getTopProfitable()` to pass `'rest-1'`.

Replace full content of `src/dashboard/dashboard.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../common/prisma.service';

const mockPrisma = {
  product: { findMany: jest.fn(), findFirst: jest.fn() },
  ingredient: { findMany: jest.fn() },
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<DashboardService>(DashboardService);
  });

  describe('classify', () => {
    it('returns ALTO for marginPct >= 50', () => {
      expect((service as any).classify(50)).toBe('ALTO');
      expect((service as any).classify(75)).toBe('ALTO');
    });
    it('returns MEDIO for 30 <= marginPct < 50', () => {
      expect((service as any).classify(30)).toBe('MEDIO');
      expect((service as any).classify(49.9)).toBe('MEDIO');
    });
    it('returns BAIXO for marginPct < 30', () => {
      expect((service as any).classify(0)).toBe('BAIXO');
      expect((service as any).classify(29.9)).toBe('BAIXO');
    });
  });

  describe('computeMetrics', () => {
    it('correctly computes costPrice, margin, marginPct, roi and classification', () => {
      const product = {
        id: 'p1', name: 'Test', salePrice: 20, category: { name: 'Cat' },
        recipeItems: [{ quantity: 2, ingredient: { costPrice: 5 } }, { quantity: 0.5, ingredient: { costPrice: 4 } }],
      };
      const result = (service as any).computeMetrics(product);
      expect(result.costPrice).toBeCloseTo(12);
      expect(result.margin).toBeCloseTo(8);
      expect(result.marginPct).toBeCloseTo(40);
      expect(result.roi).toBeCloseTo(66.67, 1);
      expect(result.classification).toBe('MEDIO');
    });

    it('handles zero salePrice gracefully (marginPct = 0)', () => {
      const product = { id: 'p2', name: 'Free', salePrice: 0, category: null, recipeItems: [{ quantity: 1, ingredient: { costPrice: 5 } }] };
      const result = (service as any).computeMetrics(product);
      expect(result.marginPct).toBe(0);
      expect(result.categoryName).toBe('Sem Categoria');
    });

    it('handles zero costPrice gracefully (roi = 0)', () => {
      const product = { id: 'p3', name: 'NoCost', salePrice: 10, category: { name: 'Cat' }, recipeItems: [] };
      const result = (service as any).computeMetrics(product);
      expect(result.costPrice).toBe(0);
      expect(result.roi).toBe(0);
    });
  });

  describe('getAllProducts', () => {
    it('maps prisma products to ProductMetrics', async () => {
      mockPrisma.product.findMany.mockResolvedValue([{
        id: 'p1', name: 'Pizza', salePrice: 45, category: { name: 'Pizzas' },
        recipeItems: [{ quantity: 0.4, ingredient: { costPrice: 4.5 } }],
      }]);
      const result = await service.getAllProducts('rest-1');
      expect(result).toHaveLength(1);
      expect(result[0].costPrice).toBeCloseTo(1.8);
    });

    it('passes restaurantId to prisma where clause', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      await service.getAllProducts('rest-1');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ restaurantId: 'rest-1' }) }),
      );
    });
  });

  describe('getSummary', () => {
    it('returns correct high/medium/low counts', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'High', salePrice: 100, category: { name: 'C' }, recipeItems: [{ quantity: 1, ingredient: { costPrice: 40 } }] },
        { id: 'p2', name: 'Medium', salePrice: 100, category: { name: 'C' }, recipeItems: [{ quantity: 1, ingredient: { costPrice: 65 } }] },
        { id: 'p3', name: 'Low', salePrice: 100, category: { name: 'C' }, recipeItems: [{ quantity: 1, ingredient: { costPrice: 80 } }] },
      ]);
      mockPrisma.ingredient.findMany.mockResolvedValue([]);
      const summary = await service.getSummary('rest-1');
      expect(summary.totalProducts).toBe(3);
      expect(summary.highMarginCount).toBe(1);
      expect(summary.mediumMarginCount).toBe(1);
      expect(summary.lowMarginCount).toBe(1);
    });

    it('identifies low stock ingredients', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.ingredient.findMany.mockResolvedValue([
        { id: 'i1', name: 'Flour', stock: 2, minStock: 5 },
        { id: 'i2', name: 'Salt', stock: 10, minStock: 1 },
      ]);
      const summary = await service.getSummary('rest-1');
      expect(summary.ingredientsLowStock).toHaveLength(1);
      expect(summary.ingredientsLowStock[0].name).toBe('Flour');
    });
  });

  describe('getTopProfitable', () => {
    it('returns top 5 products sorted by margin descending', async () => {
      const makeProduct = (id: string, margin: number) => ({
        id, name: `Prod ${id}`, salePrice: 100, category: { name: 'C' },
        recipeItems: [{ quantity: 1, ingredient: { costPrice: 100 - margin } }],
      });
      mockPrisma.product.findMany.mockResolvedValue([
        makeProduct('p1', 10), makeProduct('p2', 50), makeProduct('p3', 30),
        makeProduct('p4', 70), makeProduct('p5', 20), makeProduct('p6', 60),
      ]);
      const result = await service.getTopProfitable('rest-1');
      expect(result).toHaveLength(5);
      expect(result[0].margin).toBeCloseTo(70);
      expect(result[1].margin).toBeCloseTo(60);
    });
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx jest src/dashboard/dashboard.service.spec.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all 11 test suites pass, all tests green.

- [ ] **Step 8: Commit**

```bash
git add src/dashboard/dashboard.service.ts src/dashboard/dashboard.controller.ts src/dashboard/dashboard.service.spec.ts
git commit -m "feat: scope dashboard module to restaurantId"
```
