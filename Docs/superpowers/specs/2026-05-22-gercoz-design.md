# SisGerCoz — Design Spec

**Data:** 2026-05-22  
**Escopo:** MVP completo — Ingredientes, Produtos, Fichas Técnicas, Cardápio, PDV, Dashboard  
**Stack:** NestJS (backend) + Next.js 14 App Router (frontend) — repos separados  
**Banco:** SQLite via Prisma (MVP) → PostgreSQL (produção)

---

## 1. Arquitetura Geral

### Repositórios

| Repo | Tech | Descrição |
|---|---|---|
| `gercoz-backend` | NestJS + Prisma + SQLite | API REST + WebSocket |
| `gercoz-frontend` | Next.js 14 App Router + Shadcn/ui + Tailwind | Interface web |

### Módulos NestJS

- `auth` — JWT (access + refresh token), guards, decorators
- `restaurants` — criação e gestão do tenant
- `ingredients` — CRUD + histórico de preço
- `products` — CRUD + composição de receita + cálculo de custo
- `menu` — leitura do cardápio (filtrado por restaurante)
- `orders` — PDV: criação e gestão de pedidos (mesa e balcão)
- `kds` — Kitchen Display System, eventos de status
- `dashboard` — queries analíticas (custo, preço, margem, ROI por prato)

### Rotas Next.js (App Router)

| Rota | Módulo | Role |
|---|---|---|
| `/auth` | Login / registro | Público |
| `/ingredients` | Gestão de ingredientes | ADMIN |
| `/products` | Gestão de produtos e fichas | ADMIN |
| `/menu` | Cardápio com toggle ativo/inativo | ADMIN, CASHIER |
| `/pdv` | Criação de pedidos | CASHIER, ADMIN |
| `/pdv/orders` | Lista de pedidos abertos | CASHIER, ADMIN |
| `/kds` | Kitchen Display System | COOK |
| `/dashboard` | Análise de margem e ROI por prato | ADMIN |

### Comunicação

- REST JSON para todo CRUD
- Socket.io para real-time (novo pedido → KDS; mudança de status → PDV)
- TanStack Query para cache e invalidação no cliente

### Multi-tenant

`restaurantId` viaja no payload do JWT. Um Prisma middleware global injeta o filtro em toda query via `AsyncLocalStorage` — nenhum controller ou service passa `restaurantId` manualmente.

---

## 2. Schema do Banco de Dados (Prisma)

### Tenant + Auth

```prisma
model Restaurant {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  phone       String?
  address     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users        User[]
  ingredients  Ingredient[]
  categories   Category[]
  products     Product[]
  orders       Order[]
}

enum UserRole {
  ADMIN
  CASHIER
  COOK
}

model User {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  email        String
  password     String
  role         UserRole   @default(CASHIER)
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  refreshTokens          RefreshToken[]
  orders                 Order[]
  ingredientPriceHistory IngredientPriceHistory[]

  @@unique([restaurantId, email])
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

### Ingredientes

```prisma
enum Unit {
  G
  KG
  ML
  L
  UN
}

model Ingredient {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  description  String?
  unit         Unit
  costPrice    Float
  supplier     String?
  stock        Float      @default(0)
  minStock     Float      @default(0)
  expiryDate   DateTime?
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  recipeItems  RecipeItem[]
  priceHistory IngredientPriceHistory[]

  @@unique([restaurantId, name])
}

model IngredientPriceHistory {
  id           String     @id @default(cuid())
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id])
  price        Float
  changedBy    String
  user         User       @relation(fields: [changedBy], references: [id])
  changedAt    DateTime   @default(now())
}
```

### Produtos + Fichas Técnicas

```prisma
model Category {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  sortOrder    Int        @default(0)
  isActive     Boolean    @default(true)

  products     Product[]

  @@unique([restaurantId, name])
}

model Product {
  id              String     @id @default(cuid())
  restaurantId    String
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id])
  categoryId      String?
  category        Category?  @relation(fields: [categoryId], references: [id])
  name            String
  description     String?
  salePrice       Float
  preparationTime Int        @default(15)
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  recipeItems     RecipeItem[]
  orderItems      OrderItem[]

  @@unique([restaurantId, name])
}

model RecipeItem {
  id           String     @id @default(cuid())
  productId    String
  product      Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredientId String
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id])
  quantity     Float
  unit         Unit

  @@unique([productId, ingredientId])
}
```

### Pedidos (PDV)

```prisma
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

model Order {
  id           String      @id @default(cuid())
  restaurantId String
  restaurant   Restaurant  @relation(fields: [restaurantId], references: [id])
  orderNumber  Int
  type         OrderType
  tableNumber  Int?
  status       OrderStatus @default(PENDING)
  notes        String?
  discount     Float       @default(0)
  createdBy    String
  user         User        @relation(fields: [createdBy], references: [id])
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  closedAt     DateTime?

  items        OrderItem[]

  @@unique([restaurantId, orderNumber])
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Float
  notes     String?
}
```

### Notas de design do schema

- `costPrice` do produto é calculado em runtime (soma de `recipeItem.quantity × ingredient.costPrice`) — não armazenado, evita inconsistência
- `unitPrice` no `OrderItem` é snapshot — preço travado no momento do pedido
- `orderNumber` é sequencial por restaurante (query `MAX(orderNumber) + 1`)
- Cardápio = `Product` com `isActive = true`, sem modelo separado

---

## 3. Auth + Multi-tenant

### Fluxo de autenticação

1. `POST /auth/login` → valida email + senha → retorna `accessToken` (15min) + `refreshToken` (7d, salvo no banco)
2. `POST /auth/refresh` → valida refresh token → emite novo par de tokens
3. `POST /auth/logout` → deleta refresh token do banco
4. Todo request autenticado leva `Authorization: Bearer <accessToken>`

### JWT Payload

```typescript
{
  sub: string,         // userId
  restaurantId: string,
  role: UserRole,
  iat: number,
  exp: number
}
```

### Guards NestJS

- `JwtAuthGuard` — valida token em toda rota protegida (global por padrão)
- `RolesGuard` — verifica `role` onde necessário via `@Roles(UserRole.ADMIN)`

### Tenant Isolation

Prisma middleware global injeta `restaurantId` via `AsyncLocalStorage`:

```
Request → JwtAuthGuard → extrai restaurantId → AsyncLocalStorage.run() → PrismaMiddleware injeta filtro
```

### Rotas públicas

- `POST /auth/login`
- `POST /restaurants` (criação de conta)

### Roles e permissões

| Role | Acesso |
|---|---|
| `ADMIN` | Tudo: ingredientes, produtos, dashboard, relatórios |
| `CASHIER` | PDV, pedidos, cardápio (leitura) |
| `COOK` | KDS (leitura + atualização de status) |

---

## 4. Módulo: Ingredientes

### Backend

| Método | Rota | Descrição | Role |
|---|---|---|---|
| `GET` | `/ingredients` | Lista todos (filtro: isActive, busca por nome) | ADMIN |
| `GET` | `/ingredients/:id` | Detalhe + histórico de preço | ADMIN |
| `POST` | `/ingredients` | Cria ingrediente | ADMIN |
| `PATCH` | `/ingredients/:id` | Atualiza — se costPrice mudar, grava histórico e dispara evento | ADMIN |
| `DELETE` | `/ingredients/:id` | Soft delete (isActive = false) | ADMIN |

Ao atualizar `costPrice`: grava `IngredientPriceHistory` e emite evento interno `ingredient.price_updated` que o `ProductsService` escuta para invalidar cache de custo dos produtos afetados.

### Frontend — `/ingredients`

- Tabela: nome, unidade, custo atual, estoque, estoque mínimo, fornecedor, status
- Badge vermelho quando `stock ≤ minStock`
- Botões: Novo, Editar, Desativar
- Modal criação/edição com React Hook Form + Zod
- Aba lateral "Histórico de Preço" — gráfico de linha (Recharts) com evolução do custo

### Seeds (12 ingredientes)

Farinha de trigo, Ovo, Leite, Manteiga, Açúcar, Sal, Queijo muçarela, Presunto, Tomate, Alface, Peito de frango, Pão de hambúrguer — com preços, estoques e fornecedores variados.

---

## 5. Módulo: Produtos + Fichas Técnicas

### Backend

| Método | Rota | Descrição | Role |
|---|---|---|---|
| `GET` | `/products` | Lista com custo calculado, margem e ROI | ADMIN |
| `GET` | `/products/:id` | Detalhe completo com receita | ADMIN |
| `GET` | `/products/:id/ficha-tecnica` | Ficha técnica formatada | ADMIN |
| `POST` | `/products` | Cria produto com recipeItems | ADMIN |
| `PATCH` | `/products/:id` | Atualiza produto e/ou receita | ADMIN |
| `DELETE` | `/products/:id` | Soft delete | ADMIN |
| `GET` | `/categories` | Lista categorias | ADMIN, CASHIER |
| `POST` | `/categories` | Cria categoria | ADMIN |

### Cálculo automático (runtime, nunca persistido)

```
costPrice  = Σ (recipeItem.quantity × ingredient.costPrice)
margin     = salePrice - costPrice
marginPct  = (margin / salePrice) × 100
roi        = (margin / costPrice) × 100
```

### Ficha Técnica — resposta de `/products/:id/ficha-tecnica`

```
nome, categoria, tempo de preparo
ingredientes: [nome, quantidade, unidade, custo unitário, custo parcial]
custo total, preço de venda, margem (R$ e %), ROI (%)
descrição/modo de preparo (se preenchido)
```

### Frontend — `/products`

- Cards por categoria com custo, preço, margem e badge de lucratividade (verde/amarelo/vermelho)
- Formulário de criação com seção "Receita" — adicionar ingredientes dinamicamente
- Preview ao vivo do custo calculado enquanto o usuário monta a receita
- Botão "Ver Ficha Técnica" → modal com todos os dados formatados

### Seeds (12 produtos, 4 categorias)

**Categorias:** Lanches, Pizzas, Bebidas, Sobremesas

**Produtos:** X-Burguer, X-Bacon, X-Salada, Pizza Margherita, Pizza Frango, Pizza Calabresa, Suco de Laranja, Refrigerante, Água, Brigadeiro, Pudim, Petit Gâteau — cada um com 2–5 ingredientes da lista de seeds.

---

## 6. Módulo: Cardápio

### Backend

O cardápio é uma projeção de `Product.isActive = true`, agrupado por categoria. Sem modelo separado.

| Método | Rota | Descrição | Role |
|---|---|---|---|
| `GET` | `/menu` | Produtos ativos agrupados por categoria | ADMIN, CASHIER, COOK |
| `GET` | `/menu/categories/:categoryId` | Produtos de uma categoria | ADMIN, CASHIER |
| `PATCH` | `/menu/:productId/toggle` | Ativa/desativa produto no cardápio | ADMIN |

Custo não é exposto no cardápio — informação interna visível só em `/products`.

### Frontend — `/menu`

- Grid de cards agrupados por categoria, com abas por categoria no topo
- Card: nome, descrição, preço de venda, tempo de preparo, badge ativo/inativo
- Toggle rápido ativo/inativo direto no card (role ADMIN)
- Barra de busca por nome
- Layout otimizado para tablet

### Seeds

Sem seeds exclusivos — cardápio gerado automaticamente pelos 12 produtos seed.

---

## 7. Módulo: PDV (Ponto de Venda)

### Backend

| Método | Rota | Descrição | Role |
|---|---|---|---|
| `GET` | `/orders` | Lista pedidos (filtro: status, tipo, data) | ADMIN, CASHIER |
| `GET` | `/orders/:id` | Detalhe com itens | ADMIN, CASHIER |
| `POST` | `/orders` | Cria pedido com itens | CASHIER, ADMIN |
| `PATCH` | `/orders/:id/status` | Atualiza status | CASHIER, COOK, ADMIN |
| `PATCH` | `/orders/:id/cancel` | Cancela pedido (só PENDING) | CASHIER, ADMIN |
| `POST` | `/orders/:id/items` | Adiciona item ao pedido aberto | CASHIER, ADMIN |
| `DELETE` | `/orders/:id/items/:itemId` | Remove item do pedido aberto | CASHIER, ADMIN |

### Regras de negócio

- `orderNumber` gerado sequencialmente por restaurante (`MAX(orderNumber) + 1`)
- `unitPrice` no `OrderItem` é snapshot do `product.salePrice` no momento da criação
- `tableNumber` obrigatório quando `type = MESA`, ignorado em `BALCAO`
- Edição de itens só permitida com `status = PENDING`
- Ao mudar para `PREPARING` → emite WebSocket `order:status_changed` para KDS

### WebSocket (Socket.io)

- `order:created` → broadcast para `restaurant:{restaurantId}:kds`
- `order:status_changed` → broadcast para `restaurant:{restaurantId}:pdv`
- Frontend conecta autenticado (token no handshake) e entra na sala do restaurante automaticamente

### Frontend — `/pdv`

1. Seleção de tipo (Mesa / Balcão) + número da mesa se Mesa
2. Grid de produtos do cardápio (filtrável por categoria e busca)
3. Carrinho lateral com itens, quantidades editáveis, notas por item
4. Preview: subtotal, desconto, total
5. Botão "Confirmar Pedido" → POST `/orders` → notificação de sucesso

### Frontend — `/pdv/orders`

- Cards com número, tipo, mesa, status, total, tempo decorrido
- Badge de cor por status: cinza (PENDING), amarelo (PREPARING), verde (READY), azul (DELIVERED)
- Atualização em real-time via Socket.io
- Ação rápida "Marcar Entregue" quando status = READY

### Frontend — `/kds`

- Grid fullscreen de pedidos PENDING e PREPARING
- Card: número, tipo, itens, tempo desde criação
- Botões "Iniciar Preparo" (PENDING→PREPARING) e "Marcar Pronto" (PREPARING→READY)
- Som + flash visual ao receber novo pedido via WebSocket

### Seeds (12 pedidos)

Mix de tipos (MESA e BALCAO), status variados (PENDING, PREPARING, READY, DELIVERED), com itens dos 12 produtos seed. Tabelas 1–8 para pedidos de mesa. Datas distribuídas no dia atual.

---

## 8. Módulo: Dashboard (Análise por Prato)

### Backend

| Método | Rota | Descrição | Role |
|---|---|---|---|
| `GET` | `/dashboard/products` | Todos os pratos com métricas calculadas | ADMIN |
| `GET` | `/dashboard/products/:id` | Métricas detalhadas de um prato | ADMIN |
| `GET` | `/dashboard/summary` | Resumo geral do restaurante | ADMIN |
| `GET` | `/dashboard/top-profitable` | Top 5 pratos por margem absoluta | ADMIN |
| `GET` | `/dashboard/low-margin` | Pratos com margem < 30% | ADMIN |

### Métricas por prato (runtime)

```
costPrice      = Σ (recipeItem.quantity × ingredient.costPrice)
salePrice      = product.salePrice
margin         = salePrice - costPrice         (R$)
marginPct      = (margin / salePrice) × 100    (%)
roi            = (margin / costPrice) × 100    (%)
classification = "ALTO" | "MEDIO" | "BAIXO"
```

Classificação:
- `ALTO` — margem ≥ 50%
- `MEDIO` — margem entre 30% e 49%
- `BAIXO` — margem < 30%

### Resumo geral (`/dashboard/summary`)

```
totalProducts, avgMarginPct, avgRoi
highMarginCount, mediumMarginCount, lowMarginCount
mostProfitableProduct { name, margin, roi }
leastProfitableProduct { name, margin, roi }
ingredientsLowStock: Ingredient[]
```

### Frontend — `/dashboard`

**Cards de resumo no topo:**
- Total de produtos ativos
- Margem média do cardápio (%)
- ROI médio (%)
- Produtos com margem baixa (badge vermelho com contagem)

**Tabela principal:**
- Colunas: nome, categoria, custo (R$), preço venda (R$), margem (R$), margem (%), ROI (%), classificação
- Ordenável por qualquer coluna
- Linha colorida: verde (ALTO), amarelo (MEDIO), vermelho (BAIXO)
- Filtro por categoria e classificação

**Gráficos (Recharts):**
- Barras horizontais — Top 10 pratos por ROI
- Scatter plot — Custo × Preço de venda
- Pizza — distribuição de pratos por classificação

**Painel de alertas:**
- Ingredientes com estoque abaixo do mínimo

### Seeds

Sem seeds exclusivos — métricas derivadas dos 12 produtos e 12 ingredientes seed.

---

## 9. Seeds Resumo

| Entidade | Quantidade |
|---|---|
| Restaurant | 1 |
| User | 2 (1 ADMIN, 1 CASHIER) |
| Ingredient | 12 |
| IngredientPriceHistory | ~12 (1 entrada por ingrediente) |
| Category | 4 (Lanches, Pizzas, Bebidas, Sobremesas) |
| Product | 12 |
| RecipeItem | ~36 (média 3 por produto) |
| Order | 12 |
| OrderItem | ~24 (média 2 por pedido) |

---

## 10. Decisões fora do escopo (MVP)

| Funcionalidade | Motivo |
|---|---|
| Pagamento integrado | Fase 2 |
| Delivery / endereço | Fase 2 |
| Integrações iFood / Uber Eats | Fase 2 |
| PDF da ficha técnica | Fase 2 |
| Histórico de versões da receita | Fase 2 |
| Offline first (KDS) | Fase 2 |
| Upload de imagens de produtos | Fase 2 |
| Impostos (NF-e) | Fase 3 |
