# Multi-Empresa: Seleção de Empresa Pós-Login

**Data:** 2026-05-25  
**Status:** Aprovado

## Contexto

Atualmente um usuário tem exatamente um restaurante, e o `restaurantId` viaja fixo no JWT desde o login. O objetivo é permitir que um usuário pertença a múltiplas empresas (restaurantes), com role diferente por empresa, e que após o login o usuário escolha qual empresa quer operar antes de acessar os módulos.

## Fluxo de Navegação

```
/auth  →  /empresas  →  /modulos  →  (módulos do sistema)
```

O switcher no header de `/modulos` permite trocar de empresa sem novo login, voltando para `/empresas`.

## Decisões

- Role (ADMIN, CASHIER, COOK) é **por empresa**, não global.
- Usuário com uma empresa **sempre vê** a tela de seleção (sem auto-redirect).
- Vínculo usuário↔empresa é feito manualmente no banco (sem UI de convite no MVP).
- Troca de empresa **não requer novo login** — usa o `partialToken` armazenado.

---

## 1. Schema do Banco

### Mudanças no modelo `User`

Remove `restaurantId` e `role` do `User`. Email passa a ser único globalmente.

```prisma
model User {
  id            String           @id @default(uuid())
  name          String
  email         String           @unique
  passwordHash  String
  isActive      Boolean          @default(true)
  refreshTokens RefreshToken[]
  restaurants   UserRestaurant[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}
```

### Nova tabela `UserRestaurant`

```prisma
model UserRestaurant {
  id           String     @id @default(uuid())
  userId       String
  restaurantId String
  role         Role
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([userId, restaurantId])
}
```

Todos os outros modelos (`Ingredient`, `Product`, `Order` etc.) mantêm `restaurantId` sem alteração.

---

## 2. Backend — Auth Flow

### Tipos de JWT

| Campo        | Partial Token     | Full Token          |
|--------------|-------------------|---------------------|
| `sub`        | userId            | userId              |
| `name`       | nome              | nome                |
| `type`       | `"partial"`       | `"full"`            |
| `restaurantId` | —               | restaurantId        |
| `role`       | —                 | ADMIN/CASHIER/COOK  |
| Expiração    | 7 dias            | 15 min              |

O `partialToken` tem expiração longa (7 dias) para permitir troca de empresa sem novo login. Ele só dá acesso ao endpoint `POST /auth/select-empresa` — nenhum dado de negócio.

### Endpoints

**`POST /auth/login`** (modificado)

```
body: { email, password }

→ Valida usuário (email + senha)
→ Busca UserRestaurant[] do usuário
→ Emite partialToken (type: "partial", sem restaurantId/role)
→ Retorna: { partialToken, empresas: [{ id, nome, role }] }

Não emite accessToken nem refreshToken.
```

**`POST /auth/select-empresa`** (novo)

```
header: Authorization: Bearer <partialToken>
body: { restaurantId }

→ Valida que token.type === "partial"
→ Valida que existe UserRestaurant { userId, restaurantId }
→ Emite accessToken (type: "full", com restaurantId + role)
→ Cria RefreshToken no banco
→ Retorna: { accessToken, refreshToken }
```

**`POST /auth/refresh`** — sem mudança de contrato.  
**`POST /auth/logout`** — sem mudança de contrato.

### Guards

- `PartialJwtGuard` — novo guard para `POST /auth/select-empresa`. Valida JWT com `type === "partial"`.
- `JwtAuthGuard` (existente) — passa a exigir `type === "full"` em todas as rotas de negócio.

---

## 3. Frontend — URLs e Páginas

### Rotas

| Rota       | Status    | Descrição                                      |
|------------|-----------|------------------------------------------------|
| `/auth`    | existente | Login — sem mudança de UI                      |
| `/empresas`| **nova**  | Seleção de empresa (pós-login, pré-módulos)    |
| `/modulos` | existente | Hub de módulos — adiciona switcher de empresa  |

### Página `/empresas`

- Grid de cards, um por empresa.
- Cada card: nome da empresa + role do usuário nela (ex: "Restaurante Bela Vista — Admin").
- Clique → `POST /auth/select-empresa` → salva `accessToken` + `refreshToken` → `router.push('/modulos')`.
- Sem botão de voltar. Apenas botão de logout.

### Switcher no header de `/modulos`

- Botão "Trocar empresa" no header.
- Chama `switchEmpresa()` no `AuthContext`.
- Descarta `accessToken` + `refreshToken` do storage.
- Redireciona para `/empresas` (usa o `partialToken` ainda válido).

---

## 4. Auth Context e Middleware

### `AuthContext` — novos estados e ações

```ts
type AuthState = {
  // Fase 1: após login
  partialToken: string | null
  empresas: { id: string; nome: string; role: Role }[]

  // Fase 2: após selecionar empresa
  user: { userId: string; restaurantId: string; role: Role; name: string } | null
  accessToken: string | null

  // Ações
  login(email: string, password: string): Promise<void>
  selectEmpresa(restaurantId: string): Promise<void>
  switchEmpresa(): void   // descarta accessToken, volta para /empresas
  logout(): void          // descarta tudo (partialToken + accessToken + refreshToken)
}
```

### Armazenamento de tokens

| Token          | Onde                              | Duração |
|----------------|-----------------------------------|---------|
| `partialToken` | cookie (para middleware) + localStorage | 7 dias  |
| `accessToken`  | cookie (para middleware) + localStorage | 15 min  |
| `refreshToken` | localStorage (só client-side)     | 7 dias  |

O middleware Next.js roda no Edge runtime sem acesso ao `localStorage`, portanto `partialToken` e `accessToken` precisam estar em cookies para que as regras de roteamento funcionem. O `refreshToken` é usado apenas no cliente (para renovar o `accessToken`) e fica só no `localStorage`.

### Middleware Next.js — lógica de rotas

| Rota              | Regra de acesso                                                                 |
|-------------------|---------------------------------------------------------------------------------|
| `/auth`           | Se `accessToken` válido → `/modulos`. Se `partialToken` válido → `/empresas`. Senão → permite. |
| `/empresas`       | Se `partialToken` válido → permite. Senão → `/auth`.                            |
| `/modulos` e demais | Se `accessToken` válido → permite. Se `partialToken` válido → `/empresas`. Senão → `/auth`. |

---

## 5. Resumo das Mudanças

### Backend
- Prisma: novo modelo `UserRestaurant`, `User` perde `restaurantId` e `role`
- `auth.service.ts`: `login()` modificado, novo `selectEmpresa()`
- `auth.controller.ts`: novo endpoint `POST /auth/select-empresa`
- Novo `PartialJwtGuard`
- `JwtAuthGuard` existente passa a rejeitar tokens `type !== "full"`
- Migration Prisma + atualização do seed

### Frontend
- Nova página `src/app/empresas/page.tsx`
- `AuthContext` expandido com `partialToken`, `empresas`, `selectEmpresa()`, `switchEmpresa()`
- `middleware.ts` atualizado com nova lógica de roteamento
- Header de `/modulos` com botão "Trocar empresa"
