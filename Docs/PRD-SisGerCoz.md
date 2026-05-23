\# PRD \- SisGerCoz: Sistema de Gerenciamento de Cozinha(PDV)

\---

\#\# 🎯 Visão Geral

\*\*GerCoz\*\* é um Sistema de Ponto de Venda (PDV) completo para restaurantes que integra:  
\- Gestão de cardápio e ingredientes  
\- Criação e acompanhamento de pedidos  
\- Cálculo automático de custos baseado em ingredientes  
\- Dashboard analítico  
\- Sistema multi-tenant (múltiplos restaurantes)

\#\#\# Diferencial  
\- \*\*Controle de Custos por Ingrediente\*\*: Cada prato calcula seu custo automaticamente baseado nos ingredientes  
\- \*\*Ficha Técnica Dinâmica\*\*: Documentação automática de receitas com histórico de versões  
\- \*\*Análise de Lucratividade\*\*: Relatórios por prato, período e horário  
\- \*\*Multi-tenant Isolado\*\*: Cada restaurante é completamente isolado

\---

\#\# 🚀 Objetivos

\#\#\# Curto Prazo (MVP \- Fase 1\)  
\- ✅ Gestão de ingredientes e produtos  
\- ✅ Cardápio interativo com preços dinâmicos  
\- ✅ PDV funcional para criar pedidos  
\- ✅ KDS (Kitchen Display System) básico  
\- ✅ Dashboard com métricas principais  
\- ✅ Suporte a múltiplos restaurantes (multi-tenant)

\#\#\# Médio Prazo (Fase 2\)  
\- 🔄 Integrações com Ifood, Uber Eats  
\- 🔄 Sistema de pagamento (PagSeguro, Stripe)  
\- 🔄 Gestão de entrega e rotas  
\- 🔄 Offline first para KDS

\#\#\# Longo Prazo (Fase 3\)  
\- 📅 Mobile app nativo (delivery)  
\- 📅 IA para previsão de demanda  
\- 📅 Controle fiscal e nota fiscal eletrônica

\---

\#\# 📦 Escopo MVP (Fase 1 \- 4 semanas)

\#\#\# ✅ Incluído no MVP

\#\#\#\# Semana 1-2: Fundação  
\- \[ \] Setup infraestrutura (Vercel, GitHub, banco de dados)  
\- \[ \] Autenticação e autorização multi-tenant  
\- \[ \] Tela de login e criação de conta  
\- \[ \] Gestão de ingredientes (CRUD)  
\- \[ \] Gestão de pratos/produtos (CRUD)

\#\#\#\# Semana 2-3: Core Business  
\- \[ \] Pedidos (criação, edição, cancelamento)  
\- \[ \] Tipos de pedido (Mesa, Delivery, Balcão)  
\- \[ \] KDS básico (visualização de pedidos)  
\- \[ \] Cálculo automático de custos  
\- \[ \] Status de pedido (Pendente → Pronto → Entregue)

\#\#\#\# Semana 3-4: Análise e Polimento  
\- \[ \] Dashboard com vendas do dia  
\- \[ \] Relatório de lucro por prato  
\- \[ \] Impressão de recibo  
\- \[ \] Testes e correções  
\- \[ \] Deploy em produção

\#\#\# ❌ Fora do Escopo (Fase 2+)

| Funcionalidade | Fase | Motivo |  
|---|---|---|  
| Pagamento integrado | 2 | Complexidade alta, pode usar cash first |  
| Integrações (Ifood/UE) | 2 | Requer API setup com plataformas |  
| Delivery \+ Rotas | 2 | Georeferência e otimização complexas |  
| Offline First | 2 | Service Workers e sincronização complexa |  
| Mobile App | 3 | React Native/Flutter \- outro projeto |  
| NFC/QR Code | 3 | Requer hardware específico |

\---

\#\# 🛠 Stack Técnico

\#\#\# Frontend  
Framework: Next.js 14+ (React) Linguagem: TypeScript UI Components: Shadcn/ui \+ Tailwind CSS State Management: TanStack Query (React Query) Formulários: React Hook Form \+ Zod Real-time: Socket.io client Charts: Recharts Hospedagem: Vercel

\#\#\# Backend  
Framework: NestJS Linguagem: TypeScript ORM: Prisma Banco de Dados: SQLite (MVP) → PostgreSQL (Produção) Autenticação: JWT \+ Refresh Tokens Real-time: Socket.io Validação: Class-validator Testes: Jest API: REST (JSON)

\#\#\# Infraestrutura  
Versionamento: GitHub CI/CD: GitHub Actions Hospedagem Backend: Vercel (Node.js serverless) Banco de Dados: SQLite (arquivo local temporário) Arquivo: GitHub LFS / S3 (para imagens \- fase 2\)

\#\#\# Desenvolvimento Local  
Node.js: 20.x LTS Package Manager: npm ou yarn Containerização: Docker (opcional)

\---

\#\# 🏢 Componentes Principais

\#\#\# 1\. Gestão de Ingredientes

\#\#\#\# Funcionalidades  
\- CRUD de ingredientes com validação  
\- Unidade de medida (g, ml, kg, l, un, etc)  
\- Preço de compra e fornecedor  
\- Estoque atual e mínimo  
\- Data de validade  
\- Informações nutricionais (opcional MVP)  
\- Histórico de preço (para análise)

\#\#\#\# Modelo de Dados  
\`\`\`typescript  
// Prisma Schema  
model Ingredient {  
  id                String      @id @default(cuid())  
  restaurantId      String  
  restaurant        Restaurant  @relation(fields: \[restaurantId\], references: \[id\])  
    
  name              String  
  description       String?  
  unit              String      // "g", "ml", "kg", "l", "un"  
  costPrice         Float       // Preço de compra  
  supplier          String?  
    
  stock             Float       // Quantidade atual  
  minStock          Float       // Alerta quando atinge  
  expiryDate        DateTime?  
    
  nutritionalInfo   Json?       // {calories, protein, carbs, fat, fiber}  
    
  isActive          Boolean     @default(true)  
  createdAt         DateTime    @default(now())  
  updatedAt         DateTime    @updatedAt  
    
  // Relações  
  recipeItems       RecipeItem\[\]  
  priceHistory      IngredientPriceHistory\[\]  
    
  @@unique(\[restaurantId, name\])  
}

model IngredientPriceHistory {  
  id                String      @id @default(cuid())  
  ingredientId      String  
  ingredient        Ingredient  @relation(fields: \[ingredientId\], references: \[id\])  
    
  price             Float  
  changedAt         DateTime    @default(now())  
  changedBy         String      // user\_id  
}

Fluxo de Criação/Atualização  
Usuário (Gerente) acessa "Ingredientes"  
Clica "Novo Ingrediente"  
Preenche: nome, unidade, preço, fornecedor  
Sistema valida e salva  
Trigger: Se preço muda → Recalcula custo de todos os pratos que usam este ingrediente  
Notificação: Pratos afetados são marcados como "preço desatualizado"  
2\. Gestão de Produtos/Pratos  
Funcionalidades  
CRUD de produtos com categorias  
Composição por ingredientes com quantidades  
Cálculo automático de custo  
Preço de venda  
Imagens do produto  
Modificadores/Adicionais (fase 2\)  
Status (ativo/inativo)

3\. Gestão de Pedidos  
Funcionalidades  
Criar pedido (PDV interativo)  
Múltiplos tipos: Mesa, Delivery, Balcão  
Adicionar produtos com quantidade  
Modificadores (fase 2\)  
Desconto por pedido  
Notas especiais  
Status: Pendente → Preparando → Pronto → Entregue/Fechado  
Cálculo automático de total \+ impostos  
Tipos de Pedido (MVP)  
Mesa: Identificado por número (1-30), para atendimento presencial  
Delivery: Com endereço (fase 2: integração com plataformas)  
Balcão: Takeout rápido, sem identificação

Fluxo de Criação de Pedido (PDV)  
1\. Vendedor acessa "Novo Pedido"  
2\. Seleciona tipo (Mesa / Delivery / Balcão)  
3\. Se Mesa: Seleciona número  
4\. Se Delivery: Insere endereço (fase 2: integração)  
5\. Busca/seleciona produtos (search ou por categoria)  
6\. Adiciona ao carrinho  
7\. Revisa totais  
8\. Clica "Confirmar Pedido"  
9\. Sistema salva e emite evento WebSocket  
10\. KDS recebe notificação  
11\. Recibo é enviado para impressora

4\. Kitchen Display System (KDS)  
Funcionalidades  
Visualização fullscreen dos pedidos  
Filtro por status (Pendente, Preparando, Pronto)  
Mostrar apenas itens relevantes para cozinha  
Tempo de preparo (estimado vs. real)  
Botões: Iniciar Preparo, Marcar Pronto, Cancelar  
Som/Notificação para novo pedido  
Priorização por tipo (Mesa vs Delivery)

Fluxo KDS  
Code  
1\. Novo pedido chega → Evento WebSocket  
2\. KDS toca som/vibração  
3\. Card do pedido aparece em VERMELHO (novo)  
4\. Cozinheiro clica "Iniciar Preparo"  
5\. Card fica AMARELO \+ timer começa  
6\. Quando pronto, clica "Marcar Pronto"  
7\. Card fica VERDE  
8\. PDV recebe notificação (pode avisar cliente)  
9\. Vendedor entrega e clica "Completar" no PDV

5\. Dashboard e Relatórios  
Métricas MVP  
Vendas do dia (total em R$)  
Quantidade de pedidos  
Ticket médio  
Produto mais vendido  
Lucro estimado do dia  
Produtos em falta de estoque  
Gráficos MVP  
Vendas por hora (linha)  
Categorias mais vendidas (pizza)  
Top 5 produtos (barra)  
Evolução de lucro (linha)

6\. Ficha Técnica do Prato (v2 \- Fase 1.5)  
Status MVP  
✅ Gerada automaticamente quando produto é criado  
✅ Contém: ingredientes, custos, margens  
✅ Visualização em tela  
❌ PDF para impressão (fase 2\)  
❌ Histórico de versões (fase 2\)  
Conteúdo da Ficha  
Nome do prato  
Categoria  
Ingredientes com quantidades  
Custo total  
Preço de venda  
Margem de lucro  
Modo de preparo (se preenchido)  
Tempo estimado