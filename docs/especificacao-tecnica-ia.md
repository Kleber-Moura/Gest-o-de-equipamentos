# Especificação Técnica Completa — KM Controle de Equipamentos

> **Preâmbulo — como usar este documento**
>
> Este documento foi escrito para ser consumido por uma Inteligência Artificial (como o
> Claude) como material de referência completo e autocontido sobre o sistema "KM Controle
> de Equipamentos". Ele serve três propósitos: (1) permitir que uma IA entenda
> profundamente a arquitetura, as regras de negócio e as decisões de design já tomadas,
> antes de fazer qualquer alteração no sistema; (2) servir de **backup de conhecimento**
> do projeto — se o repositório de código for perdido, este documento contém informação
> suficiente para reconstruir a estrutura do banco de dados, a lógica de backend e a
> arquitetura do frontend do zero; (3) documentar o "porquê" por trás de cada decisão não
> óbvia, para que uma futura alteração não reintroduza um problema que já foi
> deliberadamente resolvido.
>
> Este documento **não contém nenhum segredo real** (senha, chave de API, service role
> key) — apenas nomes de variáveis de ambiente e onde cada uma é usada. Nenhuma dessas
> value reais deve jamais ser escrita aqui ou em qualquer outro arquivo versionado (ver
> seção 12).
>
> Onde este documento resume uma tabela em vez de colar o SQL literal, o arquivo-fonte
> exato está sempre referenciado — ele é a fonte da verdade byte-a-byte;
> este documento é a fonte da verdade sobre o *raciocínio*.

## Índice

1. Visão geral e objetivo do sistema
2. Stack tecnológico
3. Estrutura de pastas
4. Arquitetura do frontend (providers, rotas, guards)
5. Inventário completo da camada de serviços (`src/services/`)
6. Inventário completo de páginas, componentes, hooks, contexts, lib, types
7. Banco de dados — schema completo (tabelas, colunas, enums)
8. Banco de dados — funções auxiliares, RLS, triggers e RPCs (SQL literal)
9. Mapa de relacionamentos (chaves estrangeiras)
10. Edge Functions (Deno)
11. Regras de negócio consolidadas, com a função/constraint que garante cada uma
12. Variáveis de ambiente e credenciais (nomes apenas — sem valores)
13. Identidade visual / design system (tokens completos)
14. Runbook: como reconstruir o projeto do zero
15. Decisões de arquitetura e seus motivos (rationale)

---

## 1. Visão geral e objetivo do sistema

Aplicação web interna (SPA) de gestão de inventário de TI para uma empresa: controla
notebooks, acessórios (periféricos) e linhas telefônicas corporativas, seus
responsáveis (colaboradores), localização, status e histórico completo de
movimentação. Inclui gestão própria de usuários com aprovação manual e três níveis de
papel (USER/ADMIN/MASTER), auditoria completa de ações sensíveis, e um módulo de leitura
automática de faturas de telefonia via IA (Google Gemini).

Princípio arquitetural central, repetido em todo o projeto: **toda regra de negócio e de
segurança vive no banco de dados** (PostgreSQL, via Row Level Security + funções
`security definer` + triggers), nunca só no frontend. O frontend reflete essas regras
(esconde botões, mostra mensagens) apenas para dar feedback melhor ao usuário — a garantia
real está sempre no Postgres, e continuaria valendo mesmo se alguém acessasse o banco por
uma via diferente do app React.

O sistema é a evolução de um controle antes feito em planilha Excel; um ETL histórico
(`scripts/migration/`) fez a carga inicial dos dados reais da planilha para o Supabase e
não faz parte do runtime normal da aplicação.

## 2. Stack tecnológico

| Camada | Tecnologia | Versão (package.json) |
|---|---|---|
| Frontend | React | ^19.2.8 |
| Frontend | React DOM | ^19.2.8 |
| Linguagem | TypeScript | ~6.0.2 |
| Build tool | Vite | ^8.2.0 |
| Roteamento | react-router-dom | ^7.18.2 |
| Gráficos | Recharts | ^3.10.1 |
| Ícones | lucide-react | ^1.47.0 |
| Backend/DB | @supabase/supabase-js | ^2.112.3 |
| Exportação de PDF (dashboard) | jspdf + html2canvas | ^4.2.1 / ^1.4.1 |
| Linter | oxlint | ^1.75.0 |
| ETL histórico (planilha → banco) | exceljs | ^4.4.0 |
| Backend gerenciado | Supabase (PostgreSQL + Auth + Row Level Security + RPC + Edge Functions + Storage) | — |
| IA de leitura de fatura | Google Gemini (`gemini-flash-latest`, REST API) | — |

Não há Tailwind, MUI ou qualquer framework de UI — toda a estilização é CSS puro em um
único arquivo, [src/index.css](../src/index.css), usando CSS custom properties.

## 3. Estrutura de pastas

```
src/
  assets/branding/        Logo KM (imagem) e demais artes de marca
  components/             Componentes reutilizáveis (modais, cards, gráficos)
  components/branding/    KmMark.tsx (monograma SVG da marca)
  contexts/                AuthContext, ThemeContext
  hooks/                   useAuth, useTheme, useReferenceData
  layouts/                 AppLayout (shell autenticado), AuthLayout (telas públicas)
  lib/                     Cliente Supabase, exportação de PDF
  pages/                   Uma página por rota
  pages/admin/             Páginas exclusivas de administração
  routes/                  AppRoutes, ProtectedRoute, PublicOnlyRoute
  services/                Uma função por operação de banco — única camada que fala com o Supabase
  types/                   Tipos TypeScript espelhando tabelas/enums do banco
  utils/                   Utilitários puros (ex.: lifecycleText.ts)
  index.css                Design system inteiro (tokens + classes)
  App.tsx, main.tsx        Bootstrap da aplicação

supabase/
  migrations/              Uma migration por mudança de schema, ordem cronológica (fonte da verdade)
  scripts/                 Bundle de todas as migrations concatenadas + script de dados fictícios
  functions/               Edge Functions: admin-users, process-invoice

scripts/
  migration/               ETL histórico (Excel → Supabase), não roda no dia a dia
  docs/                    Scripts de geração de documentação (build-pdf.mjs, build-docx.mjs)

data/                      Entrada/saída do ETL (arquivos reais não versionados)
docs/                      Documentação (este arquivo incluso)
public/                    favicon.svg
```

## 4. Arquitetura do frontend

### 4.1 Árvore de providers (`src/main.tsx` → `src/App.tsx`)

```
main.tsx
  <StrictMode>
    <App/>                    → monta em #root
main.tsx renderiza App, que é:
  <ThemeProvider>              (tema claro/escuro — precisa envolver tudo, até o login)
    <BrowserRouter>
      <AuthProvider>           (sessão Supabase + perfil app_profiles)
        <AppRoutes/>
```

### 4.2 `AuthContext` (`src/contexts/AuthContext.tsx`)

Estado: `session` (Supabase `Session|null`), `profile` (`AppProfile|null`, lido de
`app_profiles` pelo id do usuário), `loading`. Assina
`supabase.auth.onAuthStateChange` para manter os dois em sincronia. Expõe:

- `signIn(email, password)`
- `signUp(name, email, password)` → retorna `{needsEmailConfirmation}`
- `signOut()`
- `requestPasswordReset(email)` → redireciona para `/redefinir-senha`
- `updatePassword(password)`

Mensagens de erro de autenticação são traduzidas para PT-BR internamente
(`translateAuthError`).

### 4.3 `ThemeContext` (`src/contexts/ThemeContext.tsx`)

Estado `theme: 'dark' | 'light'`, persistido em `localStorage` (chave `km-theme`,
padrão `'dark'`), aplicado escrevendo o atributo `data-theme` em `document.documentElement`.
Expõe `toggleTheme()` e `setTheme(theme)`.

### 4.4 Rotas (`src/routes/AppRoutes.tsx`)

| Path | Componente | Guard |
|---|---|---|
| `/login` | `LoginPage` | `PublicOnlyRoute` |
| `/cadastro` | `SignupPage` | `PublicOnlyRoute` |
| `/esqueci-senha` | `ForgotPasswordPage` | `PublicOnlyRoute` |
| `/redefinir-senha` | `ResetPasswordPage` | nenhum (usa a sessão temporária de recuperação do Supabase) |
| `/` | `DashboardPage` | `ProtectedRoute` |
| `/notebooks` | `NotebooksPage` | `ProtectedRoute` |
| `/acessorios` | `AccessoriesPage` | `ProtectedRoute` |
| `/telefonia` | `PhoneLinesPage` | `ProtectedRoute` |
| `/administracao/solicitacoes` | `AccessRequestsPage` | `ProtectedRoute` |
| `/administracao/colaboradores` | `EmployeesPage` | `ProtectedRoute` |
| `/administracao/categorias` | `CategoriesPage` | `ProtectedRoute` |
| `/administracao/departamentos` | `DepartmentsPage` | `ProtectedRoute` |
| `/administracao/localidades` | `LocationsPage` | `ProtectedRoute` |
| `/administracao/operadoras` | `CarriersPage` | `ProtectedRoute` |
| `/auditoria` | `AuditLogPage` | `ProtectedRoute` |

**Importante**: a tabela de rotas em si não restringe por papel (USER/ADMIN/MASTER) —
isso é feito em dois lugares: (a) na UI, cada página/`AppLayout` decide o que mostrar
(`canManage`, `isMaster`); (b) de forma definitiva, pela RLS do Postgres — um USER que
force a URL de uma tela de admin não consegue gravar nada, porque as policies de
insert/update dessas tabelas exigem `is_admin_or_master()`/`is_master()`.

### 4.5 Guards

- **`ProtectedRoute.tsx`**: envolve `<Outlet/>` dentro de `AppLayout`. `loading` → tela
  "Carregando…"; sem `session` → redireciona `/login`; `session` sem `profile` ainda
  carregado → "Preparando seu perfil…"; `profile.status !== 'APPROVED'` → renderiza
  `AccountStatusPage` em vez da rota; aprovado → renderiza o shell + rota.
- **`PublicOnlyRoute.tsx`**: envolve as páginas públicas de autenticação; se já existe
  `session`, redireciona para `/`.

### 4.6 Layouts

- **`AppLayout.tsx`**: shell autenticado — sidebar com logo (depende do tema), links de
  navegação (Dashboard/Notebooks/Acessórios/Telefonia sempre visíveis; seção
  "Administração" só para ADMIN/MASTER; "Auditoria" só para MASTER), header com toggle de
  tema, nome + badge de papel do usuário, botão de logout.
- **`AuthLayout.tsx`**: card centralizado usado pelas páginas públicas.

### 4.7 Convenção da camada de serviços

Páginas e componentes **nunca** chamam `supabase.from(...)` diretamente para dados de
domínio — sempre passam por uma função em `src/services/`. Isso centraliza queries e
tratamento de erro por entidade. A única exceção conceitual é `adminUsers.ts`, que em vez
de `.from(...)` invoca a Edge Function `admin-users` via
`supabase.functions.invoke(...)`, porque as operações que ele expõe exigem a Service Role
Key (nunca disponível no browser).

## 5. Inventário completo da camada de serviços (`src/services/`)

### `accessories.ts`
- `listAccessories(filters: AccessoryFilters = {}): Promise<ListResult<Accessory>>` —
  consulta paginada/filtrável de acessórios ativos (`deleted_at IS NULL`); filtros:
  status, categoria, colaborador, localidade, departamento (resolvido via
  `employeeIdsByDepartment`), busca livre (patrimônio/serial/modelo/nome do
  responsável via `employeeIdsByNameSearch`); ordenação padrão por `modelo`, ou por
  `patrimonio` quando `sortDir` é passado.
- `createAccessory(input)` — insere um acessório.
- `updateAccessory(id, input)` — atualiza um acessório.
- `setAccessoryDeactivated(id, deactivated)` — soft delete/restauração via `deleted_at`.
- `assignAccessory(accessoryId, employeeId, notes?)` — RPC `assign_accessory`.
- `unassignAccessory(accessoryId, notes?)` — RPC `unassign_accessory`.

### `adminUsers.ts`
- `invoke<T>(body)` (interno) — chama a Edge Function `admin-users`, normaliza/relança
  erros do transporte de Functions ou do corpo `{error}`.
- `createUser({email, password, name, role, department_id?, location_id?})` — ação
  `create` na Edge Function.
- `resetUserPassword(userId, newPassword)` — ação `reset_password`.
- `updateUserProfile({user_id, name, email, department_id?, location_id?})` — ação
  `update_profile`.
- `deleteUser(userId)` — ação `delete`.

### `auditLogs.ts`
- `listAuditLogs(page = 0, pageSize = 30): Promise<ListResult<AuditLog>>` — paginado,
  mais recente primeiro.
- `listActorNames(): Promise<Map<string, string>>` — todos os `app_profiles` (id, name)
  num Map, para resolver "quem fez" na UI de auditoria.

### `dashboard.ts`
- `tally(rows, key)` (interno) — agrupa linhas por valor de uma coluna e conta.
- `loadDashboardStats(): Promise<DashboardStats>` — roda 5 queries em paralelo
  (`notebooks_with_lifecycle`, acessórios ativos, linhas ativas, categorias,
  localidades) e agrega **no cliente**: `notebooksByStatus`, `notebooksByLifecycle`,
  `notebooksByLocation` (por nome), `accessoriesByStatus`, `accessoriesByCategory` (por
  nome), `phoneLinesByStatus`.

### `employeeAssets.ts`
- `getEmployeeAssets(employeeId): Promise<EmployeeAssets>` — busca em paralelo todos os
  notebooks/acessórios/linhas ativos vinculados a um colaborador.

### `employees.ts`
- `listEmployees(): Promise<Employee[]>` — todos os colaboradores, ordenados por nome.
- `createEmployee(input)` / `updateEmployee(id, input)` — CRUD básico.
- `setEmployeeActive(id, active)` — alterna a flag `active` diretamente.
- `deactivateEmployee(id)` — RPC `deactivate_employee` (desativa E libera os
  equipamentos, atomicamente — ver migration `20260812130000`).

### `invoiceUploads.ts`
- `listInvoiceUploads(): Promise<InvoiceUpload[]>` — mais recentes primeiro.
- `uploadInvoice(file, carrierId): Promise<InvoiceUpload>` — sobe o PDF para o bucket
  `phone-invoices` em `{carrierId}/{timestamp}-{filename}`, depois invoca a Edge Function
  `process-invoice` com `{storage_path, file_name, carrier_id}`.

### `listUtils.ts`
- `ListResult<T>` — `{data: T[], count: number}`, formato compartilhado de paginação.
- `employeeIdsByDepartment(departmentId): Promise<string[]>` — resolve um filtro de
  departamento em ids de colaborador.
- `employeeIdsByNameSearch(term): Promise<string[]>` — resolve uma busca por nome em ids
  de colaborador (`ilike`), usado pelas buscas de notebooks/acessórios/linhas.

### `notebooks.ts`
- `listNotebooks(filters = {}): Promise<ListResult<NotebookWithLifecycle>>` — consulta a
  view `notebooks_with_lifecycle`; filtros: status, colaborador, localidade, status do
  ciclo de vida, departamento (via ids de colaborador), busca livre; ordenado por
  `patrimonio`.
- `getNotebook(id)` — um notebook (com campos de ciclo de vida) por id.
- `createNotebook(input)` / `updateNotebook(id, input)` — CRUD básico.
- `setNotebookDeactivated(id, deactivated)` — soft delete via `deleted_at`.
- `assignNotebook(notebookId, employeeId, notes?)` — RPC `assign_notebook`.
- `unassignNotebook(notebookId, notes?)` — RPC `unassign_notebook`.

### `phoneLines.ts`
- `listPhoneLines(filters = {}): Promise<ListResult<PhoneLine>>` — filtros: status,
  operadora, colaborador (`assigned_employee_id`), localidade, departamento, busca livre;
  ordenado por `number`.
- `createPhoneLine(input)` / `updatePhoneLine(id, input)` — CRUD básico.
- `setPhoneLineDeactivated(id, deactivated)` — soft delete via `deleted_at`.
- `assignPhoneLine(phoneLineId, employeeId, notes?)` — RPC `assign_phone_line`.
- `unassignPhoneLine(phoneLineId, notes?)` — RPC `unassign_phone_line`.

### `profiles.ts`
- `listAllProfiles(): Promise<AppProfile[]>` — todos os `app_profiles`, mais recentes
  primeiro (tela de Solicitações de acesso).
- `approveUser(userId)` — RPC `approve_user` (também serve para "reativar").
- `rejectUser(userId)` — RPC `reject_user`.
- `blockUser(userId)` — RPC `block_user`.
- `changeUserRole(userId, role)` — RPC `change_user_role`.

### `referenceData.ts`
- `listDepartments/listLocations/listCategories/listCarriers()` — listas simples.
- `createNamed(table, name)` / `setActive(table, id, active)` (internos) — helpers
  genéricos reaproveitados pelas 4 tabelas de referência "nome + active".
- `createDepartment/createLocation/createCategory/createCarrier(name)` — inserção.
- `setDepartmentActive/setLocationActive/setCategoryActive/setCarrierActive(id, active)`.

### `telephony.ts`
- `listAllPhoneLines(): Promise<PhoneLine[]>` — todas as linhas ativas, sem paginação
  (para agregação no cliente no painel de telefonia do Dashboard).
- `listPhoneInvoices(): Promise<PhoneInvoice[]>` — todas as linhas de `phone_invoices`,
  ordenadas por `invoice_date`.

## 6. Páginas, componentes, hooks, contexts, lib, types

### 6.1 Páginas (`src/pages/`)

| Página | Rota | Resumo |
|---|---|---|
| `DashboardPage.tsx` | `/` | KPIs da frota, 3 donuts de saúde, 2 gráficos de barra, painel de telefonia, exportação de PDF |
| `NotebooksPage.tsx` | `/notebooks` | Lista paginada (15/página) com filtros, coluna de ciclo de vida, CRUD/atribuição (ADMIN/MASTER) |
| `AccessoriesPage.tsx` | `/acessorios` | Mesmo padrão de Notebooks, para acessórios |
| `PhoneLinesPage.tsx` | `/telefonia` | Mesmo padrão + aba "Faturas" (MASTER) com `InvoiceUploadsPanel` |
| `AccountStatusPage.tsx` | (via guard) | Tela para perfil não aprovado (PENDING/REJECTED/BLOCKED) |
| `LoginPage.tsx` | `/login` | Formulário de login |
| `SignupPage.tsx` | `/cadastro` | Formulário de cadastro/solicitação de acesso |
| `ForgotPasswordPage.tsx` | `/esqueci-senha` | Formulário de "esqueci minha senha" |
| `ResetPasswordPage.tsx` | `/redefinir-senha` | Formulário de nova senha (sessão de recuperação) |
| `admin/AccessRequestsPage.tsx` | `/administracao/solicitacoes` | Aprovar/rejeitar/bloquear/reativar, trocar papel, criar/editar/resetar senha/excluir usuário |
| `admin/EmployeesPage.tsx` | `/administracao/colaboradores` | CRUD de colaboradores + "Ver vínculos" |
| `admin/CategoriesPage.tsx`, `DepartmentsPage.tsx`, `LocationsPage.tsx`, `CarriersPage.tsx` | rotas correspondentes | Wrappers finos de `ReferenceListAdminPage` |
| `admin/ReferenceListAdminPage.tsx` | (reutilizável) | CRUD genérico de "nome + active" |
| `admin/AuditLogPage.tsx` | `/auditoria` | Trilha de auditoria paginada (30/página), somente leitura |

### 6.2 Componentes (`src/components/`)

`AccessoryFormModal`, `AssignEmployeeModal` (genérico, reusado por notebooks/acessórios/
linhas), `CreateUserModal`, `EditUserModal`, `ResetPasswordModal`, `EmployeeFormModal`,
`EmployeeAssetsModal` (com subcomponentes `AssetSection`/`AssetCardShell`/`NotebookCard`/
`AccessoryCard`/`PhoneLineCard`), `NotebookFormModal`, `PhoneLineFormModal`,
`SimpleNameFormModal` (genérico "criar só por nome"), `UploadInvoiceModal`,
`InvoiceUploadsPanel`, `TelephonyDashboardPanel`, `HealthDonut` (donut reutilizável,
exporta `DonutSegment`), `StatCard`, `StatusPill`, `PasswordInput` (com toggle
mostrar/ocultar), `branding/KmMark` (monograma SVG, variantes `glow`/`solid`).

### 6.3 Hooks (`src/hooks/`)

- `useAuth()` — wrapper de `useContext(AuthContext)`.
- `useTheme()` — wrapper de `useContext(ThemeContext)`.
- `useReferenceData()` — carrega departamentos/localidades/categorias/operadoras/
  colaboradores em paralelo (uma vez, e de novo via `reload()`); retorna as listas mais
  helpers de nome (`employeeName`, `departmentName`, `locationName`, `categoryName`,
  `carrierName`, todos `(id) => string`, default `'—'`), `loading` e `reload()`. Evita
  recarregar esses dados de apoio em cada tela.

### 6.4 Contexts — ver seção 4.2/4.3.

### 6.5 `src/lib/`

- `supabaseClient.ts` — cria/exporta o client singleton (`createClient`) usando
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; lança erro no import se faltar alguma.
- `exportElementToPdf.ts` — `exportElementToPdf(element, fileName)`: importa
  dinamicamente `html2canvas`+`jspdf`, rasteriza o elemento (escala 2x, fundo
  `#0b1220`) em um PDF A4 multi-página, salva via `showSaveFilePicker` (Chrome/Edge) ou
  download simples (Firefox/Safari).

### 6.6 `src/types/`

- `auth.ts` — `AppRole`, `ProfileStatus`, `AppProfile`.
- `domain.ts` — enums + mapas de rótulo PT-BR para `NotebookStatus`, `AccessoryStatus`,
  `PhoneLineStatus`, `LifecycleStatus`, `InvoiceUploadStatus`; interfaces `Department`,
  `Location`, `AssetCategory`, `Carrier`, `Employee`, `Notebook`,
  `NotebookWithLifecycle`, `Accessory`, `PhoneLine`, `PhoneInvoice`, `InvoiceUpload`,
  `AssetMovement`, `AuditLog`.

### 6.7 `src/utils/lifecycleText.ts`

`lifecycleFriendlyText(dataPrevistaTroca: string): string` — gera a string amigável
("Troca vencida há 2 meses e 3 dias" / "Troca em 1 ano e 3 meses") comparando a data
prevista de troca com hoje.

## 7. Banco de dados — schema completo

> Ver também [banco-de-dados.md](banco-de-dados.md) (mesma informação, documento
> independente) e [mapeamento-banco-de-dados.md](mapeamento-banco-de-dados.md) (diagrama
> ER + toda chave estrangeira com nulidade e `ON DELETE`). As três fontes descrevem o
> mesmo schema; esta seção existe para que este documento sozinho já seja suficiente.

### 7.1 Extensões

`pgcrypto` (gen_random_uuid), `citext` (comparação case-insensitive nativa).

### 7.2 Enums

| Enum | Valores |
|---|---|
| `notebook_status` | `ASSIGNED`, `AVAILABLE`, `BROKEN`, `MAINTENANCE`, `RESERVE`, `DECOMMISSIONED` |
| `notebook_lifecycle_status` | `TROCAR`, `ATENCAO`, `DENTRO_DA_VIDA_UTIL` |
| `accessory_status` | `ASSIGNED`, `AVAILABLE`, `BROKEN`, `DECOMMISSIONED`, `MAINTENANCE` |
| `phone_line_status` | `ASSIGNED`, `AVAILABLE`, `SUSPENDED`, `CANCELLED` |
| `app_role` | `USER`, `ADMIN`, `MASTER` |
| `profile_status` | `PENDING`, `APPROVED`, `REJECTED`, `BLOCKED` |
| `invoice_upload_status` | `PROCESSING`, `DONE`, `ERROR` |

### 7.3 Tabelas

**`departments`** — `id uuid PK`, `name citext unique not null`, `active boolean default true`, `created_at`, `updated_at`.

**`locations`** — `id uuid PK`, `name citext unique not null`, `code text`, `active`, `created_at`, `updated_at`.

**`asset_categories`** — `id uuid PK`, `name citext unique not null`, `active`, `created_at`, `updated_at`.

**`carriers`** — `id uuid PK`, `name citext unique not null`, `active`, `created_at`, `updated_at`.

**`employees`** — `id uuid PK`, `name text not null`, `username citext unique`, `email citext unique`, `department_id → departments`, `location_id → locations`, `is_shared_asset_holder boolean default false` (responsáveis não-humanos: "Estoque TI", salas etc.), `active`, `created_at`, `updated_at`. Índices em `department_id`, `location_id`, `name`.

**`notebooks`** — `id uuid PK`, `patrimonio text not null unique`, `serial_number text not null unique`, `modelo text not null`, `categoria text not null default 'Notebook'`, `data_aquisicao date not null`, `garantia_fim date`, `status notebook_status default 'AVAILABLE'`, `employee_id → employees` (nullable), `location_id → locations not null`, `notes text`, `deleted_at timestamptz`, `created_at`, `updated_at`. Índices: employee, status, location.

**`accessories`** — `id uuid PK`, `patrimonio text` (nullable), `serial_number text unique` (nullable — UNIQUE do Postgres permite múltiplos NULL), `modelo text not null`, `category_id → asset_categories not null`, `garantia_fim date`, `status accessory_status default 'AVAILABLE'`, `employee_id → employees` (nullable), `location_id → locations not null`, `notes text`, `deleted_at`, `created_at`, `updated_at`. Índices: category, employee, status, location.

**`phone_lines`** — `id uuid PK`, `number text not null unique` (CHECK regex E.164: `^\+[1-9][0-9]{7,14}$`), `carrier_id → carriers not null`, `assigned_employee_id → employees` (nullable), `department_id → departments` (nullable), `location_id → locations` (nullable), `status phone_line_status default 'AVAILABLE'`, `chip_type text`, `iccid text`, `imei text`, `eid text`, `notes text`, `deleted_at`, `created_at`, `updated_at`. Índices: carrier, employee, status.

**`app_profiles`** — `id uuid PK references auth.users(id) on delete cascade`, `name text not null`, `email citext not null`, `department_id → departments` (nullable), `location_id → locations` (nullable), `role app_role default 'USER'`, `status profile_status default 'PENDING'`, `reviewed_by → app_profiles` (nullable, self-FK, `on delete set null`), `reviewed_at timestamptz`, `created_at`, `updated_at`.

**`audit_logs`** — `id uuid PK`, `actor_user_id → app_profiles` (nullable, `on delete set null`), `entity_type text not null`, `entity_id uuid` (sem FK — ver seção 9), `action text not null`, `old_value jsonb`, `new_value jsonb`, `created_at`. Índices: `(entity_type, entity_id)`, `actor_user_id`, `created_at desc`.

**`asset_movements`** — `id uuid PK`, `asset_type text not null check in ('notebook','accessory','phone_line')`, `asset_id uuid not null` (sem FK), `from_employee_id → employees` (nullable), `to_employee_id → employees` (nullable), `movement_type text not null`, `notes text`, `changed_by → app_profiles` (nullable, `on delete set null`), `created_at`. Índice: `(asset_type, asset_id)`.

**`phone_invoices`** — `id uuid PK`, `phone_line_id → phone_lines` (nullable — número da fatura sem linha cadastrada correspondente), `raw_number text not null`, `carrier_id → carriers not null`, `amount numeric(10,2) not null check (amount >= 0)`, `invoice_date date not null`, `upload_id → invoice_uploads` (nullable), `created_at`. Unique de dedupe: `(raw_number, carrier_id, invoice_date)`. Índices: phone_line, invoice_date, carrier.

**`invoice_uploads`** — `id uuid PK`, `carrier_id → carriers not null`, `file_name text not null`, `storage_path text not null`, `status invoice_upload_status default 'PROCESSING'`, `lines_extracted integer`, `lines_matched integer`, `error_message text`, `uploaded_by → app_profiles` (nullable, `on delete set null`), `created_at`, `completed_at`. Índice: `created_at desc`.

**View `notebooks_with_lifecycle`** (`security_invoker = true`, respeita a RLS da tabela base) — `select n.*, (data_aquisicao + 4 years) as data_prevista_troca, notebook_lifecycle(data_aquisicao) as lifecycle_status from notebooks n where deleted_at is null`.

**Storage bucket**: `phone-invoices` (privado) — PDFs de fatura; insert/select restritos a MASTER via policy em `storage.objects`.

## 8. Funções auxiliares, RLS, triggers e RPCs — SQL literal

Esta seção reproduz o SQL exato das migrations que implementam a lógica de negócio —
não apenas um resumo. É a parte deste documento mais crítica para uma reconstrução fiel.

### 8.1 Extensão e trigger utilitário (`20260811130000_extensions_and_helpers.sql`)

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Aplicado via `before update` em toda tabela com `updated_at` (departments, locations,
asset_categories, carriers, employees, notebooks, accessories, phone_lines,
app_profiles).

### 8.2 Funções auxiliares de papel/permissão (`20260811140050_role_helper_functions.sql`)

```sql
create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.app_profiles where id = auth.uid(); $$;

create or replace function public.current_user_status()
returns public.profile_status
language sql stable security definer set search_path = public
as $$ select status from public.app_profiles where id = auth.uid(); $$;

create or replace function public.is_approved()
returns boolean language sql stable
as $$ select public.current_user_status() = 'APPROVED'; $$;

create or replace function public.is_admin_or_master()
returns boolean language sql stable
as $$ select public.is_approved() and public.current_user_role() in ('ADMIN', 'MASTER'); $$;

create or replace function public.is_master()
returns boolean language sql stable
as $$ select public.is_approved() and public.current_user_role() = 'MASTER'; $$;
```

`security definer` + `search_path` fixo em `current_user_role`/`current_user_status`
evita que a leitura de `app_profiles` dependa da própria RLS de `app_profiles` (o que
causaria recursão infinita) e evita sequestro de `search_path`.

### 8.3 RLS — matriz completa (`20260811140100_rls_policies.sql`, mais as extensões nas migrations de `phone_invoices`/`invoice_uploads`)

```sql
-- app_profiles: cada usuário só vê o próprio perfil; MASTER vê todos.
-- SEM policy de INSERT/UPDATE/DELETE — toda mudança de status/role passa
-- pelas RPCs security definer (seção 8.5), inclusive para o próprio MASTER.
alter table public.app_profiles enable row level security;
create policy app_profiles_select_self on public.app_profiles for select using (id = auth.uid());
create policy app_profiles_select_master on public.app_profiles for select using (public.is_master());

-- Tabelas de referência: leitura para aprovados, escrita para ADMIN/MASTER, sem DELETE.
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.asset_categories enable row level security;
alter table public.carriers enable row level security;

create policy departments_select on public.departments for select using (public.is_approved());
create policy departments_insert on public.departments for insert with check (public.is_admin_or_master());
create policy departments_update on public.departments for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());
-- (mesma tríade select/insert/update repetida para locations, asset_categories, carriers)

-- employees: leitura para aprovados, escrita para ADMIN/MASTER, sem DELETE.
alter table public.employees enable row level security;
create policy employees_select on public.employees for select using (public.is_approved());
create policy employees_insert on public.employees for insert with check (public.is_admin_or_master());
create policy employees_update on public.employees for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- notebooks / accessories / phone_lines: mesma matriz. Atribuir/desvincular usa RPCs
-- dedicadas (seção 8.4), nunca update direto do cliente para esses campos.
alter table public.notebooks enable row level security;
alter table public.accessories enable row level security;
alter table public.phone_lines enable row level security;
-- (mesma tríade select/insert/update das três tabelas acima)

-- audit_logs / asset_movements (20260811140200): sem INSERT/UPDATE/DELETE para o
-- cliente — só as funções security definer gravam.
alter table public.audit_logs enable row level security;
alter table public.asset_movements enable row level security;
create policy audit_logs_select_master on public.audit_logs for select using (public.is_master());
create policy asset_movements_select on public.asset_movements for select using (public.is_approved());

-- phone_invoices (20260812140000): leitura para aprovados, escrita para ADMIN/MASTER
-- (a carga é feita pela Edge Function process-invoice, que usa a service role e
-- portanto ignora RLS de qualquer forma).
alter table public.phone_invoices enable row level security;
create policy phone_invoices_select on public.phone_invoices for select using (public.is_approved());
create policy phone_invoices_insert on public.phone_invoices for insert with check (public.is_admin_or_master());
create policy phone_invoices_update on public.phone_invoices for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- invoice_uploads (20260813120000): select só MASTER; sem insert/update para o
-- cliente — só a Edge Function (service role) escreve.
alter table public.invoice_uploads enable row level security;
create policy invoice_uploads_select on public.invoice_uploads for select using (public.is_master());

-- Storage: bucket phone-invoices, insert/select só MASTER.
create policy phone_invoices_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'phone-invoices' and public.is_master());
create policy phone_invoices_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'phone-invoices' and public.is_master());
```

Regra geral que se repete: **nenhuma tabela de domínio tem policy de DELETE** — exclusão
física é impossível via API PostgREST; tudo é soft delete (`active`/`deleted_at`).

### 8.4 Trigger de bootstrap de usuário (`20260811140000_app_profiles.sql`)

```sql
create type public.app_role as enum ('USER', 'ADMIN', 'MASTER');
create type public.profile_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');

create table public.app_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email citext not null,
  department_id uuid references public.departments (id),
  location_id uuid references public.locations (id),
  role public.app_role not null default 'USER',
  status public.profile_status not null default 'PENDING',
  reviewed_by uuid references public.app_profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_bootstrap_master boolean;
begin
  v_is_bootstrap_master := lower(new.email) = '<e-mail configurado como MASTER inicial>';

  insert into public.app_profiles (id, name, email, role, status, reviewed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case when v_is_bootstrap_master then 'MASTER'::public.app_role else 'USER'::public.app_role end,
    case when v_is_bootstrap_master then 'APPROVED'::public.profile_status else 'PENDING'::public.profile_status end,
    case when v_is_bootstrap_master then now() else null end
  );

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> O e-mail real configurado como bootstrap MASTER **não é reproduzido aqui** — ver
> [credenciais-e-seguranca.md](credenciais-e-seguranca.md) para onde encontrá-lo/trocá-lo.
> Qualquer troca de MASTER depois do bootstrap passa exclusivamente pela RPC
> `change_user_role` (seção 8.6) — nunca editando essa função de novo.

### 8.5 Triggers de auditoria automática (`20260811140200_audit_and_movements.sql`)

```sql
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_profiles (id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('notebook', 'accessory', 'phone_line')),
  asset_id uuid not null,
  from_employee_id uuid references public.employees (id),
  to_employee_id uuid references public.employees (id),
  movement_type text not null,
  notes text,
  changed_by uuid references public.app_profiles (id),
  created_at timestamptz not null default now()
);

create or replace function public.audit_asset_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_action text; v_old jsonb; v_new jsonb; v_employee_col text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
    values (auth.uid(), tg_table_name, new.id, 'CREATE', null, to_jsonb(new));
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  v_employee_col := case when tg_table_name = 'phone_lines' then 'assigned_employee_id' else 'employee_id' end;

  if (v_new ->> 'deleted_at') is distinct from (v_old ->> 'deleted_at') and v_new ->> 'deleted_at' is not null then
    v_action := 'DEACTIVATE';
  elsif (v_new ->> 'deleted_at') is distinct from (v_old ->> 'deleted_at') and v_new ->> 'deleted_at' is null then
    v_action := 'REACTIVATE';
  elsif (v_old ->> v_employee_col) is null and (v_new ->> v_employee_col) is not null then
    v_action := 'ASSIGN';
  elsif (v_old ->> v_employee_col) is not null and (v_new ->> v_employee_col) is null then
    v_action := 'UNASSIGN';
  else
    v_action := 'UPDATE';
  end if;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), tg_table_name, new.id, v_action, v_old, v_new);
  return new;
end;
$$;

create or replace function public.audit_employee_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
    values (auth.uid(), 'employees', new.id, 'CREATE', null, to_jsonb(new));
    return new;
  end if;

  if new.active is distinct from old.active then
    v_action := case when new.active then 'REACTIVATE' else 'DEACTIVATE' end;
  else
    v_action := 'UPDATE';
  end if;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'employees', new.id, v_action, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

-- Triggers aplicados: audit_asset_trigger em notebooks/accessories/phone_lines
-- (after insert or update); audit_employee_trigger em employees (idem).
```

Dois triggers genéricos em vez de um só porque `employees` usa `active` (boolean) para
desativação, enquanto notebooks/accessories/phone_lines usam `deleted_at` e têm uma
coluna de responsável cuja transição null↔preenchido vira ASSIGN/UNASSIGN — unificar via
acesso direto a campo quebraria em `employees`, que não tem `deleted_at`.

### 8.6 RPCs de atribuição de ativos (`20260811140300_rpc_asset_assignment.sql`)

Seis funções com a mesma forma — uma para cada combinação
atribuir/desvincular × notebook/acessório/linha. Exemplo completo (`assign_notebook`;
as outras cinco seguem o padrão idêntico, trocando a tabela-alvo):

```sql
create or replace function public.assign_notebook(p_notebook_id uuid, p_employee_id uuid, p_notes text default null)
returns public.notebooks
language plpgsql security definer set search_path = public
as $$
declare
  v_notebook public.notebooks;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para atribuir notebooks';
  end if;

  select employee_id into v_from_employee
    from public.notebooks where id = p_notebook_id and deleted_at is null;
  if not found then
    raise exception 'Notebook não encontrado ou desativado';
  end if;

  update public.notebooks
     set employee_id = p_employee_id, status = 'ASSIGNED'
   where id = p_notebook_id
   returning * into v_notebook;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('notebook', p_notebook_id, v_from_employee, p_employee_id, 'ASSIGN', p_notes, auth.uid());

  return v_notebook;
end;
$$;
```

`unassign_notebook` é o mesmo padrão, mas seta `employee_id = null, status = 'AVAILABLE'`
e grava `movement_type = 'UNASSIGN'` com `to_employee_id = null`.
`assign_accessory`/`unassign_accessory` idêntico, tabela `accessories`.
`assign_phone_line`/`unassign_phone_line` idêntico, tabela `phone_lines`, coluna
`assigned_employee_id` no lugar de `employee_id`. Todas as seis: `revoke ... from public`
+ `grant execute ... to authenticated` (exigem estar logado; a checagem de papel real é
feita dentro da função via `is_admin_or_master()`).

O ponto central de design aqui: **update do ativo + insert em `asset_movements` sempre
na mesma função** (= uma única transação do ponto de vista do Postgres) — nunca duas
chamadas separadas do frontend, o que poderia deixar o histórico inconsistente se a
segunda falhasse.

### 8.7 RPC de desativação de colaborador (`20260812130000`)

```sql
create or replace function public.deactivate_employee(p_employee_id uuid)
returns public.employees
language plpgsql security definer set search_path = public
as $$
declare v_employee public.employees;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para desativar colaboradores';
  end if;

  update public.employees set active = false where id = p_employee_id
  returning * into v_employee;
  if not found then
    raise exception 'Colaborador não encontrado';
  end if;

  update public.notebooks set status = 'AVAILABLE'
   where employee_id = p_employee_id and deleted_at is null and status <> 'AVAILABLE';
  update public.accessories set status = 'AVAILABLE'
   where employee_id = p_employee_id and deleted_at is null and status <> 'AVAILABLE';

  return v_employee;
end;
$$;
```

Decisão explícita: `employee_id` **não é zerado** nos ativos liberados — o último
responsável fica registrado para consulta histórica; só o `status` volta a `AVAILABLE`.

### 8.8 RPCs de administração de usuários (`20260811140400_rpc_user_administration.sql`)

Todas exigem `is_master()` (ADMIN não tem acesso). Como `app_profiles` não tem policy de
UPDATE para ninguém, estas funções são o **único** caminho para mudar status/role.

```sql
create or replace function public.approve_user(p_user_id uuid)
returns public.app_profiles
language plpgsql security definer set search_path = public
as $$
declare v_profile public.app_profiles; v_old_status public.profile_status; v_action text;
begin
  if not public.is_master() then raise exception 'Apenas MASTER pode aprovar ou reativar usuários'; end if;
  select status into v_old_status from public.app_profiles where id = p_user_id;
  if not found then raise exception 'Usuário não encontrado'; end if;
  v_action := case when v_old_status = 'BLOCKED' then 'REACTIVATE_USER' else 'APPROVE_USER' end;
  update public.app_profiles set status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_user_id returning * into v_profile;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, v_action,
          jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'APPROVED'));
  return v_profile;
end;
$$;

-- reject_user(p_user_id): igual, mas seta status='REJECTED', bloqueia auto-rejeição
-- (p_user_id = auth.uid() → exception), action='REJECT_USER'.

-- block_user(p_user_id): igual, status='BLOCKED', bloqueia auto-bloqueio, action='BLOCK_USER'.

create or replace function public.change_user_role(p_user_id uuid, p_new_role public.app_role)
returns public.app_profiles
language plpgsql security definer set search_path = public
as $$
declare v_profile public.app_profiles; v_old_role public.app_role; v_master_count integer;
begin
  if not public.is_master() then raise exception 'Apenas MASTER pode alterar roles'; end if;
  if p_user_id = auth.uid() then raise exception 'Não é possível alterar a própria role'; end if;
  select role into v_old_role from public.app_profiles where id = p_user_id;
  if not found then raise exception 'Usuário não encontrado'; end if;

  if v_old_role = 'MASTER' and p_new_role <> 'MASTER' then
    select count(*) into v_master_count from public.app_profiles where role = 'MASTER' and status = 'APPROVED';
    if v_master_count <= 1 then raise exception 'Não é possível remover o último MASTER do sistema'; end if;
  end if;

  update public.app_profiles set role = p_new_role where id = p_user_id returning * into v_profile;
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, 'CHANGE_ROLE',
          jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_new_role));
  return v_profile;
end;
$$;
```

Duas guardas de segurança centrais em `change_user_role`: ninguém altera a própria role,
e o último MASTER `APPROVED` do sistema nunca pode ser removido (evitaria lock-out
completo — nenhum usuário restante conseguiria administrar o sistema).

### 8.9 `ON DELETE SET NULL` retroativo (`20260812150000_fk_set_null_on_user_delete.sql`)

```sql
alter table public.audit_logs drop constraint audit_logs_actor_user_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_user_id_fkey
  foreign key (actor_user_id) references public.app_profiles (id) on delete set null;

alter table public.asset_movements drop constraint asset_movements_changed_by_fkey;
alter table public.asset_movements add constraint asset_movements_changed_by_fkey
  foreign key (changed_by) references public.app_profiles (id) on delete set null;

alter table public.app_profiles drop constraint app_profiles_reviewed_by_fkey;
alter table public.app_profiles add constraint app_profiles_reviewed_by_fkey
  foreign key (reviewed_by) references public.app_profiles (id) on delete set null;
```

Motivo: como o projeto ganhou uma tela de exclusão de usuário, sem `SET NULL` a exclusão
de qualquer ADMIN/MASTER que já tivesse agido no sistema ficaria bloqueada pelo
`NO ACTION` padrão do Postgres. Com `SET NULL`, a linha de auditoria/movimentação
continua existindo — só o vínculo com o autor específico se perde.

### 8.10 Ciclo de vida do notebook (`20260811130300_notebooks.sql`)

```sql
create type public.notebook_lifecycle_status as enum ('TROCAR', 'ATENCAO', 'DENTRO_DA_VIDA_UTIL');

create or replace function public.notebook_lifecycle(data_aquisicao date)
returns public.notebook_lifecycle_status
language sql immutable
as $$
  select case
    when (data_aquisicao + interval '4 years')::date < current_date
      then 'TROCAR'::public.notebook_lifecycle_status
    when (data_aquisicao + interval '4 years')::date <= (current_date + interval '2 months')::date
      then 'ATENCAO'::public.notebook_lifecycle_status
    else 'DENTRO_DA_VIDA_UTIL'::public.notebook_lifecycle_status
  end
$$;

create view public.notebooks_with_lifecycle
with (security_invoker = true) as
select n.*,
  (n.data_aquisicao + interval '4 years')::date as data_prevista_troca,
  public.notebook_lifecycle(n.data_aquisicao) as lifecycle_status
from public.notebooks n
where n.deleted_at is null;
```

`security_invoker = true` garante que a view respeite a RLS da tabela base
(`notebooks`), em vez de herdar os privilégios de quem criou a view — sem isso, a view
vazaria dados por baixo da RLS que a tabela normalmente aplicaria.

## 9. Mapa de relacionamentos

Ver [mapeamento-banco-de-dados.md](mapeamento-banco-de-dados.md) para o diagrama
entidade-relacionamento completo (Mermaid) e a tabela linha-a-linha de toda FK do banco
(coluna, tabela referenciada, nulidade, comportamento de `ON DELETE`, migration de
origem). Resumo essencial:

- Única relação `ON DELETE CASCADE`: `app_profiles.id → auth.users.id` (apagar o usuário
  no Auth apaga o perfil).
- Quatro relações `ON DELETE SET NULL`, todas apontando para `app_profiles`
  (`audit_logs.actor_user_id`, `asset_movements.changed_by`, `app_profiles.reviewed_by`,
  `invoice_uploads.uploaded_by`) — preservam o histórico mesmo depois de o usuário-autor
  ser excluído.
- Todas as demais FKs usam o padrão (`NO ACTION`) — o Postgres recusa apagar uma linha
  pai (departamento, localidade, categoria, operadora, colaborador) enquanto existir
  algum filho apontando para ela; na prática nunca é exercitado porque não existe DELETE
  físico exposto por API em nenhuma dessas tabelas.
- `asset_movements.asset_id`/`audit_logs.entity_id` são `uuid` **sem constraint de FK**
  (o tipo do ativo é indicado pela coluna irmã `asset_type`/`entity_type`) — proposital,
  ver a explicação completa no documento de mapeamento.

## 10. Edge Functions (Deno)

Ambas seguem o mesmo padrão de autenticação: extraem o header `Authorization: Bearer
<jwt>`, validam via `auth.getUser(jwt)` com um client anon-key, depois criam um client
com a **service role key** para consultar `app_profiles.role`/`status` do chamador e
decidir se a requisição prossegue. CORS liberado (`Access-Control-Allow-Origin: *`).

### 10.1 `admin-users`

Exige `role === 'MASTER' && status === 'APPROVED'` (403 caso contrário). Ações
dispatchadas por `body.action`:

- **`create`** — valida `email, password (≥8 chars), name`; `admin.auth.admin.createUser`
  (e-mail pré-confirmado, metadata `{name}`); o trigger `handle_new_user` já cria o
  `app_profiles` PENDING/USER automaticamente — esta ação então **atualiza** esse
  registro para o `role` desejado (default USER), `status: 'APPROVED'`,
  `department_id`/`location_id`, `reviewed_by`/`reviewed_at`; grava `audit_logs`
  (`CREATE_USER`); retorna `{id}`.
- **`reset_password`** — `user_id, new_password (≥8)`; `admin.auth.admin.updateUserById`;
  log `RESET_PASSWORD`.
- **`update_profile`** — `user_id, name, email` (+ department/location opcionais); se o
  e-mail mudou, atualiza também no Auth (`email_confirm: true`); atualiza `app_profiles`;
  log `UPDATE_PROFILE` com old/new.
- **`delete`** — `user_id`; recusa excluir a própria conta; recusa excluir o último
  MASTER `APPROVED` (mesma checagem de `change_user_role`); grava `audit_logs`
  (`DELETE_USER`, snapshot do alvo) **antes** de excluir; `admin.auth.admin.deleteUser`
  (cascateia para `app_profiles` via `on delete cascade`).
- Ação desconhecida → 400. Qualquer exceção não tratada → 500.

Nenhum serviço externo além da própria API Admin do Supabase Auth.

### 10.2 `process-invoice`

Exige `role === 'MASTER' && status === 'APPROVED'`; exige também o secret
`GEMINI_API_KEY` configurado (500 se ausente). Corpo esperado:
`{storage_path, file_name, carrier_id}`.

Fluxo:
1. Insere `invoice_uploads` com `status: 'PROCESSING'`.
2. Baixa o PDF do bucket `phone-invoices` (client service-role).
3. Codifica o PDF em base64 e chama a API do Gemini
   (`generativelanguage.googleapis.com`, modelo `gemini-flash-latest`,
   `generateContent`) com a parte inline do PDF + um prompt em português, restringindo a
   resposta a um `responseSchema` JSON estrito: array de `{number, amount, date}`.
4. Faz o parse do array retornado.
5. Confere que o `carrier_id` existe.
6. Para cada item extraído: normaliza o número para dígitos, tenta casar com uma linha
   cadastrada por `+55{digits}` (contando quantos casaram), e faz `upsert` em
   `phone_invoices` (conflito em `raw_number, carrier_id, invoice_date`) com
   `phone_line_id` (nullable quando não casou), `raw_number`, `carrier_id`, `amount`,
   `invoice_date`, `upload_id`.
7. Atualiza `invoice_uploads` para `status: 'DONE'` com `lines_extracted`/
   `lines_matched`/`completed_at`.
8. Grava `audit_logs` (`PROCESS_INVOICE`, `{file_name, lines_extracted, lines_matched}`).
9. Retorna a linha final de `invoice_uploads`.

Qualquer falha entre os passos 2–8 marca `invoice_uploads.status = 'ERROR'` com
`error_message`/`completed_at` e responde 400; falhas antes de existir a linha de upload
(ex.: auth) respondem 500. Único serviço externo chamado: **Google Gemini API**.

## 11. Regras de negócio consolidadas

| Regra | Onde é garantida |
|---|---|
| Nenhuma tabela de domínio permite exclusão física — só soft delete | Ausência de policy de DELETE em toda tabela de domínio (RLS, seção 8.3) |
| Atribuir/desvincular um ativo sempre grava histórico, atomicamente | RPCs `assign_*`/`unassign_*` (seção 8.6), transação única |
| Ciclo de vida do notebook (4 anos) é sempre recalculado, nunca digitado | Função `notebook_lifecycle()` + view `notebooks_with_lifecycle` (seção 8.10) |
| Desativar colaborador libera os ativos dele sem apagar o vínculo histórico | RPC `deactivate_employee` (seção 8.7) |
| Ninguém promove o próprio perfil (aprovar/rejeitar/bloquear/trocar role) | `app_profiles` sem policy de UPDATE + checagem `p_user_id = auth.uid()` dentro das RPCs (seção 8.8) |
| Nunca fica sem MASTER no sistema | Checagem `v_master_count <= 1` em `change_user_role` (seção 8.8) e checagem equivalente em `admin-users`/`delete` (seção 10.1) |
| Todo cadastro novo nasce PENDING/USER, exceto o e-mail bootstrap MASTER | Trigger `handle_new_user` (seção 8.4) |
| Leitura liberada para qualquer aprovado; escrita só ADMIN/MASTER | Padrão repetido em toda policy de RLS de domínio (seção 8.3) |
| Toda ação sensível fica auditada, imutável, só MASTER lê | Triggers `audit_asset_trigger`/`audit_employee_trigger` (seção 8.5) + inserts manuais nas RPCs de administração + policy `audit_logs_select_master` |
| Excluir um usuário-autor não apaga o histórico que ele gerou | FKs `ON DELETE SET NULL` para `app_profiles` (seção 8.9) |
| Fatura de operadora sem linha cadastrada correspondente não é descartada | `phone_invoices.phone_line_id` nullable (seção 7.3), preenchido `null` pela Edge Function quando não casa |

## 12. Variáveis de ambiente e credenciais (nomes apenas)

| Variável | Onde | Usada por |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Frontend (browser) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Frontend (browser) |
| `SUPABASE_URL` | `.env.migration.local` | Scripts de migração/ETL |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.migration.local` + secrets das Edge Functions (painel Supabase) | Scripts de migração, Edge Functions `admin-users`/`process-invoice` |
| `GEMINI_API_KEY` | Secret da Edge Function `process-invoice` (painel Supabase) | Leitura de fatura por IA |

Detalhe completo (como configurar, como rotacionar, por que cada Edge Function precisa
da service role) em [credenciais-e-seguranca.md](credenciais-e-seguranca.md). **Nenhuma
dessas variáveis tem seu valor real reproduzido em nenhum documento do projeto.**

## 13. Identidade visual / design system — tokens completos

Definidos em [src/index.css](../src/index.css), tema escuro em `:root`, tema claro em
`:root[data-theme='light']` (só overrides). Ver
[design-system.md](design-system.md) para a explicação de cada grupo de token; valores
literais atuais:

### Tema escuro (`:root`)

```css
--km-cyan: #0bebf8;              --km-teal: #16b3c1;
--km-blue-strong: #006bb7;       --km-periwinkle: #5880b1;
--km-gray-blue: #3c5f85;         --km-lavender: #b1b4c4;
--km-navy-deep: #0e2240;         --km-critical: #d03b3b;

--accent-primary: linear-gradient(135deg, #3461ff 0%, #8b5cf6 100%);
--accent-primary-solid: #5b7cfa; --accent-secondary: #6366f1;
--accent-cyan: var(--km-cyan);   --accent-purple: #8b5cf6;

--radius-sm: 9px; --radius-md: 16px; --radius-lg: 20px; --radius-pill: 999px;

--bg: linear-gradient(160deg, #071626 0%, #04101c 55%, #020810 100%);
--surface: linear-gradient(160deg, #0f2740 0%, #0a1a2c 100%);
--surface-elevated: linear-gradient(160deg, #16345c 0%, #0e2338 100%);
--surface-3: linear-gradient(160deg, #1c3f68 0%, #142d4d 100%);
--text: #8fa3bf; --text-h: #ffffff; --border: #1c3a5c;

--canvas-glow-center: #0c3a63; --canvas-glow-mid: #071e35; --canvas-glow-edge: #030a14;
--hero-grad-top: #163358; --hero-grad-base: #081426;
--shell-bg: linear-gradient(180deg, #0a1c30 0%, #040d18 100%);

--accent: var(--km-cyan); --accent-hover: var(--km-teal);
--danger: #f87171; --success: #4ade80; --warning: #fbbf24;

font: 15px/150% system-ui, 'Segoe UI', Roboto, sans-serif;
color-scheme: dark;
```

### Tema claro (`:root[data-theme='light']`) — status: placeholder funcional, ainda sem especificação de design própria

```css
--bg: #f4f6fb; --surface: #ffffff; --surface-elevated: #ffffff;
--text: #5b6b85; --text-h: #0b1220; --border: rgba(15, 23, 42, 0.1);
--canvas-glow-center/mid/edge: #eef1f8;
--hero-grad-top: #ffffff; --hero-grad-base: #eef3fb;
--shell-bg: #eef1f8;
color-scheme: light;
```

Ícones: [lucide-react](https://lucide.dev). Gráficos: [Recharts](https://recharts.org).
Logo: `src/assets/branding/km-logo.png` (arte com fundo transparente, só tema escuro) +
`KmMark.tsx` (SVG, variantes `glow`/`solid`, tema claro).

## 14. Runbook: como reconstruir o projeto do zero

1. **Frontend**: `npm install`; copiar `.env.example` para `.env.local`; preencher
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` do projeto Supabase de destino.
2. **Banco de dados**: criar um projeto Supabase vazio; no SQL Editor, rodar, em ordem
   cronológica, cada arquivo de `supabase/migrations/` — ou, mais rápido, rodar o bundle
   já concatenado `supabase/scripts/00_estrutura_completa_projeto_novo.sql`, que aplica
   tudo de uma vez na ordem correta.
3. **Bootstrap do MASTER**: antes ou logo depois de rodar as migrations, decidir qual
   e-mail será o MASTER inicial e garantir que a condição dentro de `handle_new_user()`
   (seção 8.4) usa esse e-mail; criar a conta desse e-mail via Supabase Auth (painel ou
   `supabase.auth.signUp`) — o trigger já vai promovê-la automaticamente a MASTER/
   APPROVED.
4. **Edge Functions**: fazer deploy de `supabase/functions/admin-users` e
   `supabase/functions/process-invoice`; configurar o secret `GEMINI_API_KEY` no painel
   (Project Settings → Edge Functions → Secrets) — `SUPABASE_SERVICE_ROLE_KEY` já é
   injetada automaticamente pelo runtime do Supabase, não precisa ser configurada
   manualmente.
5. **Storage**: o bucket `phone-invoices` e suas policies já são criados pela migration
   `20260813120000` — nada manual necessário aqui além de rodar as migrations.
6. **Dados fictícios (opcional, para ambiente de teste/demo)**: rodar
   `supabase/scripts/01_dados_ficticios.sql` no SQL Editor.
7. **Rodar localmente**: `npm run dev`.
8. **Verificar**: logar com o e-mail bootstrap MASTER, confirmar acesso completo a todas
   as telas de administração e auditoria.

## 15. Decisões de arquitetura e seus motivos (rationale)

- **Soft delete em vez de DELETE físico** — nunca perder histórico de um ativo/
  colaborador, e tornar qualquer "exclusão" reversível.
- **`security definer` + `search_path` fixo nas funções auxiliares de papel** — evita
  recursão de RLS (a função lê `app_profiles`, que tem RLS) e evita sequestro de
  `search_path`.
- **Atribuição de ativos sempre via RPC, nunca via dois updates separados do frontend** —
  garante atomicidade entre "mudar o responsável" e "gravar o histórico".
- **`app_profiles` sem nenhuma policy de UPDATE** — força que toda mudança de
  status/role passe por uma RPC auditada, o que é o mecanismo real (não apenas uma
  convenção de UI) que impede autopromoção.
- **Checagem do "último MASTER"** em `change_user_role` e na exclusão de usuário — evita
  lock-out completo do sistema.
- **`ON DELETE SET NULL` (não `CASCADE`, não `NO ACTION`) nas FKs para `app_profiles`
  usadas como "autor"** — permite excluir um usuário sem apagar o log/movimentação que
  ele gerou, e sem bloquear a exclusão por causa desse histórico.
- **UNIQUE "cheio" (não índice parcial) em `patrimonio`/`serial_number`/`number`** — um
  índice único parcial (`where deleted_at is null`) não é reconhecido como alvo de
  `ON CONFLICT` pelo upsert do PostgREST/supabase-js; a troca também é mais correta
  semanticamente (um serial baixado não deveria reaparecer em outro ativo).
  Ver migration `20260811150000_fix_unique_constraints_for_upsert.sql`.
- **`security_invoker = true` na view `notebooks_with_lifecycle`** — a view respeita a
  RLS da tabela base em vez de herdar os privilégios de quem a criou.
- **`entity_id`/`asset_id` sem FK real em `audit_logs`/`asset_movements`** — uma FK de
  verdade exigiria uma constraint por tipo de ativo (ou uma tabela `assets` genérica que
  não existe); essas tabelas de histórico precisam registrar o id mesmo que o ativo deixe
  de existir de forma consultável.
- **`employees` (colaborador) separado de `app_profiles` (usuário do sistema)** — um
  colaborador pode nunca logar no sistema; um usuário do sistema pode não ser responsável
  por nenhum ativo.
- **Camada de serviços obrigatória (`src/services/`)** — nenhuma página/componente chama
  `supabase.from(...)` diretamente, centralizando queries e tratamento de erro por
  entidade.
- **Sem framework de UI (Tailwind/MUI)** — CSS próprio em token único
  (`src/index.css`) para controle total do design system "premium dark" pedido.
