# Hub de Módulos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma tela hub pós-login que exibe cards dos módulos liberados para o role do usuário, substituindo o redirecionamento direto para `/dashboard`.

**Architecture:** O backend adiciona `name` ao JWT payload. O frontend lê `user.name` e `user.role` do AuthContext para renderizar header + grid de cards filtrado por role. Apenas dois arquivos frontend e um backend são alterados.

**Tech Stack:** NestJS (backend JWT), Next.js 14 App Router, React Testing Library, Tailwind CSS, shadcn/ui Card, `useAuth` + `useRouter`

---

## File Map

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Modify | `gercoz-backend/src/auth/auth.service.ts` | Adicionar `name` ao JWT payload |
| Modify | `gercoz-frontend/src/contexts/auth-context.tsx` | Adicionar `name` ao tipo `User` e ao `decodeToken` |
| Modify | `gercoz-frontend/src/app/auth/page.tsx` | Corrigir redirect para `/` |
| Modify | `gercoz-frontend/src/app/auth/page.test.tsx` | Atualizar teste de redirect |
| Rewrite | `gercoz-frontend/src/app/page.tsx` | Hub de módulos |
| Create | `gercoz-frontend/src/app/page.test.tsx` | Testes do hub |

---

## Task 1: Adicionar `name` ao JWT payload (backend)

**Files:**
- Modify: `gercoz-backend/src/auth/auth.service.ts`

- [ ] **Step 1: Atualizar `generateTokens` para incluir `name` no payload**

Em `gercoz-backend/src/auth/auth.service.ts`, altere a assinatura do método e o payload:

```typescript
private async generateTokens(user: { id: string; restaurantId: string; role: string; name: string }) {
  const payload = { sub: user.id, restaurantId: user.restaurantId, role: user.role, name: user.name };
  const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });

  const rawToken = randomBytes(40).toString('hex');
  await this.prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: rawToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: rawToken };
}
```

- [ ] **Step 2: Atualizar os callers de `generateTokens` em `login` e `refresh`**

O `login` já faz `findFirst` retornando o usuário completo (inclui `name`).  
O `refresh` inclui `user` via `include: { user: true }` — também tem `name`.  
Nenhuma mudança nos callers é necessária — o TypeScript vai aceitar porque os objetos passados já têm `name`.

- [ ] **Step 3: Verificar que o backend compila sem erros**

```bash
cd gercoz-backend
npm run build
```

Esperado: sem erros de TypeScript.

- [ ] **Step 4: Commit**

```bash
cd gercoz-backend
git add src/auth/auth.service.ts
git commit -m "feat: include user name in JWT payload"
```

---

## Task 2: Adicionar `name` ao tipo `User` no frontend

**Files:**
- Modify: `gercoz-frontend/src/contexts/auth-context.tsx`

- [ ] **Step 1: Adicionar `name` à interface `User` e ao `decodeToken`**

Substitua a interface e a função em `gercoz-frontend/src/contexts/auth-context.tsx`:

```typescript
interface User {
  userId: string;
  restaurantId: string;
  role: string;
  name: string;
}

function decodeToken(token: string): User {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return {
    userId: payload.sub,
    restaurantId: payload.restaurantId,
    role: payload.role,
    name: payload.name ?? '',
  };
}
```

- [ ] **Step 2: Verificar que o frontend compila sem erros de tipo**

```bash
cd gercoz-frontend
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
cd gercoz-frontend
git add src/contexts/auth-context.tsx
git commit -m "feat: add name field to User type from JWT"
```

---

## Task 3: Corrigir redirect pós-login na página de auth

**Files:**
- Modify: `gercoz-frontend/src/app/auth/page.tsx`
- Modify: `gercoz-frontend/src/app/auth/page.test.tsx`

- [ ] **Step 1: Atualizar o teste existente para esperar redirect para `/`**

Em `gercoz-frontend/src/app/auth/page.test.tsx`, localize o teste `'redirects to /dashboard after successful login'` e altere-o:

```typescript
it('redirects to / after successful login', async () => {
  mockLogin.mockResolvedValueOnce(undefined);
  render(<AuthPage />);
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'admin@demo.com' },
  });
  fireEvent.change(screen.getByLabelText(/senha/i), {
    target: { value: 'admin123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd gercoz-frontend
npm test -- --testPathPattern="auth/page" --watchAll=false
```

Esperado: FAIL — `expect(mockPush).toHaveBeenCalledWith('/')` — recebeu `'/dashboard'`.

- [ ] **Step 3: Corrigir o redirect em `auth/page.tsx`**

Em `gercoz-frontend/src/app/auth/page.tsx`, linha 31, troque:

```typescript
router.push('/dashboard');
```

por:

```typescript
router.push('/');
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd gercoz-frontend
npm test -- --testPathPattern="auth/page" --watchAll=false
```

Esperado: PASS — todos os 5 testes da `AuthPage`.

- [ ] **Step 5: Commit**

```bash
cd gercoz-frontend
git add src/app/auth/page.tsx src/app/auth/page.test.tsx
git commit -m "feat: redirect to hub (/) after login"
```

---

## Task 4: Implementar o hub de módulos

**Files:**
- Create: `gercoz-frontend/src/app/page.test.tsx`
- Rewrite: `gercoz-frontend/src/app/page.tsx`

- [ ] **Step 1: Criar o arquivo de testes do hub**

Crie `gercoz-frontend/src/app/page.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import HubPage from './page';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

jest.mock('@/contexts/auth-context');
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));

const mockLogout = jest.fn();
const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

function renderWithRole(role: string, name = 'Teste') {
  (useAuth as jest.Mock).mockReturnValue({
    user: { userId: '1', restaurantId: 'r1', role, name },
    logout: mockLogout,
  });
  render(<HubPage />);
}

describe('HubPage', () => {
  it('renders nothing when user is null', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, logout: mockLogout });
    const { container } = render(<HubPage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows user name and role badge in header', () => {
    renderWithRole('ADMIN', 'João Silva');
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows correct modules for ADMIN', () => {
    renderWithRole('ADMIN');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Ingredientes')).toBeInTheDocument();
  });

  it('shows correct modules for CASHIER', () => {
    renderWithRole('CASHIER');
    expect(screen.getByText('PDV')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Cardápio')).toBeInTheDocument();
  });

  it('shows correct modules for COOK', () => {
    renderWithRole('COOK');
    expect(screen.getByText('KDS')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('navigates to module route when card is clicked', () => {
    renderWithRole('ADMIN');
    fireEvent.click(screen.getByText('Dashboard'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('calls logout and redirects to /auth when Sair is clicked', () => {
    renderWithRole('ADMIN');
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/auth');
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd gercoz-frontend
npm test -- --testPathPattern="src/app/page" --watchAll=false
```

Esperado: FAIL — `HubPage` não existe / não tem os elementos esperados.

- [ ] **Step 3: Reescrever `src/app/page.tsx` como hub**

Substitua todo o conteúdo de `gercoz-frontend/src/app/page.tsx`:

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

export default function HubPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const modules = MODULE_CONFIG[user.role] ?? [];
  const colsClass = modules.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3';

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
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded hover:bg-gray-50"
        >
          Sair
        </button>
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

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd gercoz-frontend
npm test -- --testPathPattern="src/app/page" --watchAll=false
```

Esperado: PASS — todos os 7 testes do `HubPage`.

- [ ] **Step 5: Commit**

```bash
cd gercoz-frontend
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "feat: add role-based module hub as home page"
```

---

## Task 5: Push final

- [ ] **Step 1: Push do backend**

```bash
cd gercoz-backend
git push origin main
```

- [ ] **Step 2: Push do frontend**

```bash
cd gercoz-frontend
git push origin main
```
