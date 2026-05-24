# Hub de Módulos — Design Spec

**Data:** 2026-05-24  
**Status:** Aprovado

---

## Objetivo

Após o login, o usuário deve ser direcionado a uma tela hub que exibe cards dos módulos liberados para o seu role. Clicar em um card navega para o módulo correspondente.

---

## Decisões de design

| Decisão | Escolha |
|---|---|
| Usuário com 1 módulo (COOK) | Sempre vê o hub — sem redirecionamento automático |
| Header | Nome do usuário · badge de cargo · botão Sair |
| Módulos bloqueados | Não aparecem — hub mostra apenas módulos liberados |
| Layout dos cards | Grid compacto: ícone grande + título + subtítulo |

---

## Mapeamento role → módulos

| Role | Módulo | Rota | Ícone | Subtítulo |
|---|---|---|---|---|
| ADMIN | Dashboard | `/dashboard` | 📊 | Análises |
| ADMIN | Produtos | `/products` | 🍽️ | Cardápio |
| ADMIN | Ingredientes | `/ingredients` | 🧂 | Estoque |
| CASHIER | PDV | `/pdv` | 🛒 | Ponto de venda |
| CASHIER | Pedidos | `/pdv/orders` | 📋 | Em aberto |
| CASHIER | Cardápio | `/menu` | 🍕 | Menu digital |
| COOK | KDS | `/kds` | 👨‍🍳 | Cozinha |

---

## Arquitetura

### Arquivos modificados

**`src/app/page.tsx`** — reescrito como hub (client component).

Responsabilidades:
- Ler `user` do `useAuth()` para obter o `role`
- Redirecionar para `/auth` se não autenticado (fallback, o middleware já cobre)
- Renderizar header com nome, badge de cargo e botão de logout
- Renderizar grid de cards filtrado pelo role do usuário
- Cada card chama `router.push(rota)` ao ser clicado

**`src/app/auth/page.tsx`** — alteração mínima: trocar `router.push('/dashboard')` por `router.push('/')`.

### Nenhum outro arquivo é alterado

O middleware (`src/middleware.ts`) já protege `/` — nenhuma mudança necessária.  
O `AuthContext` já expõe `user.role` e `logout` — nenhuma mudança necessária.

---

## Estrutura do componente hub

```
HubPage                          ← 'use client', usa useAuth + useRouter
├── <header>
│   ├── nome do usuário
│   ├── badge role (Admin / Caixa / Cozinheiro)
│   └── botão Sair → logout() + router.push('/auth')
├── <main>
│   ├── subtítulo: "Selecione um módulo"
│   └── grid auto-colunas
│       └── ModuleCard (para cada módulo do role)
│           ├── ícone (emoji)
│           ├── título
│           └── subtítulo
```

### Grid adaptativo

- 1 card → centralizado, largura fixa
- 2+ cards → `grid-cols-2 sm:grid-cols-3`

### Label de cargo por role

| Role (token) | Label exibido |
|---|---|
| ADMIN | Admin |
| CASHIER | Caixa |
| COOK | Cozinheiro |

---

## Fora de escopo

- Navegação interna entre módulos (cada módulo tem seu próprio layout/header)
- Breadcrumb ou botão "voltar ao hub" dentro dos módulos
- Animações de entrada nos cards
