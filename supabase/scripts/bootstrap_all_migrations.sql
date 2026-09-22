-- ============================================================================
-- BUNDLE DE BOOTSTRAP — todas as migrations concatenadas, na ordem correta.
-- Gerado a partir dos arquivos individuais em supabase/migrations/.
-- Rode isso UMA VEZ no SQL Editor do Supabase para criar toda a estrutura.
-- Depois desta primeira vez, mudanças futuras usam os arquivos individuais.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130000_extensions_and_helpers.sql
-- ---------------------------------------------------------------------------
-- Extensões necessárias para toda a base
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- comparação case-insensitive nativa (nomes, e-mails, usernames)

-- Trigger reutilizável para manter updated_at consistente em todas as tabelas.
-- Centralizado aqui para não duplicar a mesma lógica em cada tabela (regra do briefing: centralizar regras de negócio).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130100_reference_tables.sql
-- ---------------------------------------------------------------------------
-- Tabelas de referência: departamentos, localidades, categorias de acessório e operadoras.
-- "name" usa citext para impedir duplicidade por diferença de capitalização
-- (ex.: "São Paulo" vs "são Paulo", encontrado na planilha de origem).

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_departments_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
create trigger trg_locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
create trigger trg_asset_categories_updated_at before update on public.asset_categories
  for each row execute function public.set_updated_at();
create trigger trg_carriers_updated_at before update on public.carriers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130200_employees.sql
-- ---------------------------------------------------------------------------
-- Colaboradores responsáveis por ativos.
-- IMPORTANTE: employees != usuários da aplicação (app_profiles, criado na Fase 13-17).
-- Um colaborador pode nunca ter acesso à aplicação; um usuário da aplicação pode não ser
-- responsável por nenhum ativo. As duas entidades são propositalmente separadas.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username citext unique,
  email citext unique,
  department_id uuid references public.departments(id),
  location_id uuid references public.locations(id),
  -- true para responsáveis não-humanos (ex.: "Escritório", "Bloomberg", contas de automação)
  -- encontrados na planilha de origem, para não misturá-los com pessoas físicas sem
  -- descartar o vínculo histórico do ativo.
  is_shared_asset_holder boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_employees_department on public.employees (department_id);
create index idx_employees_location on public.employees (location_id);
create index idx_employees_name on public.employees (name);

create trigger trg_employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130300_notebooks.sql
-- ---------------------------------------------------------------------------
create type public.notebook_status as enum (
  'ASSIGNED', 'AVAILABLE', 'BROKEN', 'MAINTENANCE', 'RESERVE', 'DECOMMISSIONED'
);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  patrimonio text not null,
  serial_number text not null,
  modelo text not null,
  categoria text not null default 'Notebook',
  data_aquisicao date not null,
  garantia_fim date,
  status public.notebook_status not null default 'AVAILABLE',
  employee_id uuid references public.employees(id),
  location_id uuid not null references public.locations(id),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unicidade só entre ativos não desativados: permite corrigir/reaproveitar um patrimônio
-- ou serial de um notebook baixado sem violar a constraint (soft delete).
create unique index uq_notebooks_patrimonio on public.notebooks (patrimonio) where deleted_at is null;
create unique index uq_notebooks_serial on public.notebooks (serial_number) where deleted_at is null;

create index idx_notebooks_employee on public.notebooks (employee_id);
create index idx_notebooks_status on public.notebooks (status);
create index idx_notebooks_location on public.notebooks (location_id);

create trigger trg_notebooks_updated_at before update on public.notebooks
  for each row execute function public.set_updated_at();

-- Ciclo de vida (vida útil = 4 anos) calculado dinamicamente a partir de data_aquisicao.
-- Não persistimos "Tempo de troca"/"Status de troca" como na planilha original: são textos
-- derivados que ficam stale (foi encontrado na planilha "Status de Garantia" incoerente com
-- a data real por motivo análogo). Regra de negócio centralizada aqui, não duplicada no frontend.
create type public.notebook_lifecycle_status as enum ('TROCAR', 'ATENCAO', 'DENTRO_DA_VIDA_UTIL');

-- Nome da função diferente do nome do tipo enum para evitar colisão com o
-- mecanismo de cast implícito do PostgreSQL (funções homônimas a tipos são reservadas para isso).
create or replace function public.notebook_lifecycle(data_aquisicao date)
returns public.notebook_lifecycle_status
language sql
immutable
as $$
  select case
    when (data_aquisicao + interval '4 years')::date < current_date
      then 'TROCAR'::public.notebook_lifecycle_status
    when (data_aquisicao + interval '4 years')::date <= (current_date + interval '2 months')::date
      then 'ATENCAO'::public.notebook_lifecycle_status
    else 'DENTRO_DA_VIDA_UTIL'::public.notebook_lifecycle_status
  end
$$;

-- security_invoker garante que a view respeite a RLS da tabela base (aplicada na Fase 13-17),
-- em vez de herdar os privilégios de quem criou a view.
create view public.notebooks_with_lifecycle
with (security_invoker = true) as
select
  n.*,
  (n.data_aquisicao + interval '4 years')::date as data_prevista_troca,
  public.notebook_lifecycle(n.data_aquisicao) as lifecycle_status
from public.notebooks n
where n.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130400_accessories.sql
-- ---------------------------------------------------------------------------
create type public.accessory_status as enum (
  'ASSIGNED', 'AVAILABLE', 'BROKEN', 'DECOMMISSIONED', 'MAINTENANCE'
);

create table public.accessories (
  id uuid primary key default gen_random_uuid(),
  -- patrimonio e serial_number são nullable: a maioria dos acessórios da base de origem
  -- (mouses, headsets, fones) não possui nenhum identificador físico impresso.
  patrimonio text,
  serial_number text,
  modelo text not null,
  category_id uuid not null references public.asset_categories(id),
  garantia_fim date,
  status public.accessory_status not null default 'AVAILABLE',
  employee_id uuid references public.employees(id),
  location_id uuid not null references public.locations(id),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique parcial: só aplica quando o serial existe e o ativo está ativo.
create unique index uq_accessories_serial on public.accessories (serial_number)
  where serial_number is not null and deleted_at is null;

create index idx_accessories_category on public.accessories (category_id);
create index idx_accessories_employee on public.accessories (employee_id);
create index idx_accessories_status on public.accessories (status);
create index idx_accessories_location on public.accessories (location_id);

create trigger trg_accessories_updated_at before update on public.accessories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811130500_phone_lines.sql
-- ---------------------------------------------------------------------------
create type public.phone_line_status as enum (
  'ASSIGNED', 'AVAILABLE', 'SUSPENDED', 'CANCELLED'
);

create table public.phone_lines (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  carrier_id uuid not null references public.carriers(id),
  assigned_employee_id uuid references public.employees(id),
  department_id uuid references public.departments(id),
  location_id uuid references public.locations(id),
  status public.phone_line_status not null default 'AVAILABLE',
  -- Campos ainda não existentes na planilha de origem, mas mantidos abertos para
  -- preenchimento futuro (item 16 do briefing).
  chip_type text,
  iccid text,
  imei text,
  eid text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Defesa em profundidade: valida formato E.164 no banco, não só no frontend.
  -- Impede que valores como o "O" (letra) encontrado na planilha de origem sejam
  -- persistidos como número de linha.
  constraint chk_phone_lines_number_e164 check (number ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index uq_phone_lines_number on public.phone_lines (number) where deleted_at is null;

create index idx_phone_lines_carrier on public.phone_lines (carrier_id);
create index idx_phone_lines_employee on public.phone_lines (assigned_employee_id);
create index idx_phone_lines_status on public.phone_lines (status);

create trigger trg_phone_lines_updated_at before update on public.phone_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140000_app_profiles.sql
-- ---------------------------------------------------------------------------
-- app_profiles = usuários autenticados da aplicação. Propositalmente separado de
-- "employees" (colaboradores responsáveis por ativos) — ver item 20 do briefing.

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

create trigger trg_app_profiles_updated_at before update on public.app_profiles
  for each row execute function public.set_updated_at();

-- Cria automaticamente um app_profile PENDING para cada novo usuário do Supabase Auth.
-- Excepcionalmente, o e-mail MASTER inicial (item 27 do briefing) é aprovado e promovido
-- na própria criação — decisão tomada aqui no banco (server-side), nunca no frontend.
-- Qualquer troca de MASTER a partir daqui passa exclusivamente por change_user_role(),
-- restrita a quem já é MASTER (ver migration de RPCs de administração).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_bootstrap_master boolean;
begin
  v_is_bootstrap_master := lower(new.email) = 'kmoura@biondagro.com';

  insert into public.app_profiles (id, name, email, role, status, reviewed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case when v_is_bootstrap_master then 'MASTER' else 'USER' end,
    case when v_is_bootstrap_master then 'APPROVED' else 'PENDING' end,
    case when v_is_bootstrap_master then now() else null end
  );

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS e policies de app_profiles ficam na migration seguinte (20260811140100), depois das
-- funções auxiliares de role (is_master/is_admin_or_master) de que as policies dependem.

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140050_role_helper_functions.sql
-- ---------------------------------------------------------------------------
-- Funções auxiliares usadas por praticamente todas as RLS policies do projeto.
-- Centralizadas aqui para não repetir a mesma subquery em cada policy (regra do
-- briefing: centralizar regras de negócio, especialmente as de segurança).
--
-- security definer + search_path fixo: evita que a leitura de app_profiles dependa da
-- RLS de app_profiles (o que causaria recursão) e evita sequestro de search_path.

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_profiles where id = auth.uid();
$$;

create or replace function public.current_user_status()
returns public.profile_status
language sql
stable
security definer
set search_path = public
as $$
  select status from public.app_profiles where id = auth.uid();
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
as $$
  select public.current_user_status() = 'APPROVED';
$$;

create or replace function public.is_admin_or_master()
returns boolean
language sql
stable
as $$
  select public.is_approved() and public.current_user_role() in ('ADMIN', 'MASTER');
$$;

create or replace function public.is_master()
returns boolean
language sql
stable
as $$
  select public.is_approved() and public.current_user_role() = 'MASTER';
$$;

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140100_rls_policies.sql
-- ---------------------------------------------------------------------------
-- ============================================================================
-- app_profiles: cada usuário só vê o próprio perfil; MASTER vê todos (fila de
-- aprovação). Não há policy de INSERT/UPDATE/DELETE aqui de propósito: toda
-- mudança de status/role passa pelas RPCs security definer (approve_user/
-- reject_user/block_user/change_user_role) — inclusive para o próprio MASTER.
-- Isso é o que garante, no banco, que "um usuário nunca poderá promover o
-- próprio perfil" (item 31 do briefing), e não apenas por ausência de botão na UI.
-- ============================================================================
alter table public.app_profiles enable row level security;

create policy app_profiles_select_self on public.app_profiles for select
  using (id = auth.uid());

create policy app_profiles_select_master on public.app_profiles for select
  using (public.is_master());

-- ============================================================================
-- Tabelas de referência: leitura para qualquer usuário aprovado; escrita para
-- ADMIN/MASTER. Sem policy de DELETE — exclusão física fica indisponível via
-- API (soft delete via coluna "active", conforme item 37 do briefing).
-- ============================================================================
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.asset_categories enable row level security;
alter table public.carriers enable row level security;

create policy departments_select on public.departments for select using (public.is_approved());
create policy departments_insert on public.departments for insert with check (public.is_admin_or_master());
create policy departments_update on public.departments for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy locations_select on public.locations for select using (public.is_approved());
create policy locations_insert on public.locations for insert with check (public.is_admin_or_master());
create policy locations_update on public.locations for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy asset_categories_select on public.asset_categories for select using (public.is_approved());
create policy asset_categories_insert on public.asset_categories for insert with check (public.is_admin_or_master());
create policy asset_categories_update on public.asset_categories for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy carriers_select on public.carriers for select using (public.is_approved());
create policy carriers_insert on public.carriers for insert with check (public.is_admin_or_master());
create policy carriers_update on public.carriers for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- ============================================================================
-- employees: leitura para qualquer usuário aprovado; escrita para ADMIN/MASTER.
-- Sem DELETE — desativação via "active" (soft delete).
-- ============================================================================
alter table public.employees enable row level security;

create policy employees_select on public.employees for select using (public.is_approved());
create policy employees_insert on public.employees for insert with check (public.is_admin_or_master());
create policy employees_update on public.employees for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- ============================================================================
-- notebooks / accessories / phone_lines: mesma matriz — leitura para aprovados,
-- escrita para ADMIN/MASTER, sem DELETE físico (soft delete via deleted_at).
-- Atribuição/desvinculação usam RPCs dedicadas (assign_*/unassign_*) para
-- garantir atomicidade com asset_movements — ver migration de RPCs.
-- ============================================================================
alter table public.notebooks enable row level security;
alter table public.accessories enable row level security;
alter table public.phone_lines enable row level security;

create policy notebooks_select on public.notebooks for select using (public.is_approved());
create policy notebooks_insert on public.notebooks for insert with check (public.is_admin_or_master());
create policy notebooks_update on public.notebooks for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy accessories_select on public.accessories for select using (public.is_approved());
create policy accessories_insert on public.accessories for insert with check (public.is_admin_or_master());
create policy accessories_update on public.accessories for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy phone_lines_select on public.phone_lines for select using (public.is_approved());
create policy phone_lines_insert on public.phone_lines for insert with check (public.is_admin_or_master());
create policy phone_lines_update on public.phone_lines for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140200_audit_and_movements.sql
-- ---------------------------------------------------------------------------
-- audit_logs = auditoria técnica automática (quem alterou o quê, com diff old/new).
-- asset_movements = histórico operacional de atribuição dos ativos (item 44 do briefing:
-- as duas coisas ficam propositalmente em tabelas distintas).

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

create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor on public.audit_logs (actor_user_id);
create index idx_audit_logs_created_at on public.audit_logs (created_at desc);

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

create index idx_asset_movements_asset on public.asset_movements (asset_type, asset_id);

-- RLS: audit_logs é auditoria sensível — só MASTER visualiza (item 30 do briefing lista
-- "Visualizar auditoria" exclusivamente nas capacidades do MASTER). asset_movements é o
-- histórico de um ativo mostrado na própria tela do ativo — qualquer usuário aprovado lê.
-- Nenhuma das duas tem policy de INSERT/UPDATE/DELETE: as linhas só são gravadas pelas
-- funções/triggers security definer abaixo, nunca diretamente pelo cliente.
alter table public.audit_logs enable row level security;
alter table public.asset_movements enable row level security;

create policy audit_logs_select_master on public.audit_logs for select
  using (public.is_master());

create policy asset_movements_select on public.asset_movements for select
  using (public.is_approved());

-- ============================================================================
-- Triggers genéricos de auditoria. Dois, não um só, porque "employees" usa
-- "active" (boolean) para desativação enquanto notebooks/accessories/phone_lines
-- usam "deleted_at" e têm uma coluna de responsável (employee_id ou
-- assigned_employee_id) cuja transição null↔preenchido é rotulada como
-- ASSIGN/UNASSIGN. Tentar unificar os dois em uma função só via acesso direto a
-- campo (NEW.deleted_at) quebraria em "employees", que não tem essa coluna.
-- ============================================================================

create or replace function public.audit_asset_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_old jsonb;
  v_new jsonb;
  v_employee_col text;
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
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
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

create trigger trg_audit_notebooks after insert or update on public.notebooks
  for each row execute function public.audit_asset_trigger();
create trigger trg_audit_accessories after insert or update on public.accessories
  for each row execute function public.audit_asset_trigger();
create trigger trg_audit_phone_lines after insert or update on public.phone_lines
  for each row execute function public.audit_asset_trigger();
create trigger trg_audit_employees after insert or update on public.employees
  for each row execute function public.audit_employee_trigger();

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140300_rpc_asset_assignment.sql
-- ---------------------------------------------------------------------------
-- RPCs de atribuição/desvinculação. Cada chamada é uma única transação (função
-- plpgsql = 1 statement do ponto de vista do cliente): atualiza o ativo E grava o
-- movimento numa única operação atômica (item 62 do briefing) — nunca as duas coisas
-- separadas a partir do frontend, o que poderia deixar o histórico inconsistente se a
-- segunda chamada falhasse.
--
-- security definer: necessário para poder gravar em asset_movements, que não tem
-- policy de INSERT para o cliente. A checagem de permissão é refeita manualmente
-- dentro de cada função (is_admin_or_master()), já que security definer não passa
-- pela RLS da tabela alvo.

create or replace function public.assign_notebook(p_notebook_id uuid, p_employee_id uuid, p_notes text default null)
returns public.notebooks
language plpgsql
security definer
set search_path = public
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

create or replace function public.unassign_notebook(p_notebook_id uuid, p_notes text default null)
returns public.notebooks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notebook public.notebooks;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para desvincular notebooks';
  end if;

  select employee_id into v_from_employee
    from public.notebooks where id = p_notebook_id and deleted_at is null;
  if not found then
    raise exception 'Notebook não encontrado ou desativado';
  end if;

  update public.notebooks
     set employee_id = null, status = 'AVAILABLE'
   where id = p_notebook_id
   returning * into v_notebook;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('notebook', p_notebook_id, v_from_employee, null, 'UNASSIGN', p_notes, auth.uid());

  return v_notebook;
end;
$$;

create or replace function public.assign_accessory(p_accessory_id uuid, p_employee_id uuid, p_notes text default null)
returns public.accessories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accessory public.accessories;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para atribuir acessórios';
  end if;

  select employee_id into v_from_employee
    from public.accessories where id = p_accessory_id and deleted_at is null;
  if not found then
    raise exception 'Acessório não encontrado ou desativado';
  end if;

  update public.accessories
     set employee_id = p_employee_id, status = 'ASSIGNED'
   where id = p_accessory_id
   returning * into v_accessory;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('accessory', p_accessory_id, v_from_employee, p_employee_id, 'ASSIGN', p_notes, auth.uid());

  return v_accessory;
end;
$$;

create or replace function public.unassign_accessory(p_accessory_id uuid, p_notes text default null)
returns public.accessories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accessory public.accessories;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para desvincular acessórios';
  end if;

  select employee_id into v_from_employee
    from public.accessories where id = p_accessory_id and deleted_at is null;
  if not found then
    raise exception 'Acessório não encontrado ou desativado';
  end if;

  update public.accessories
     set employee_id = null, status = 'AVAILABLE'
   where id = p_accessory_id
   returning * into v_accessory;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('accessory', p_accessory_id, v_from_employee, null, 'UNASSIGN', p_notes, auth.uid());

  return v_accessory;
end;
$$;

create or replace function public.assign_phone_line(p_phone_line_id uuid, p_employee_id uuid, p_notes text default null)
returns public.phone_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.phone_lines;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para atribuir linhas telefônicas';
  end if;

  select assigned_employee_id into v_from_employee
    from public.phone_lines where id = p_phone_line_id and deleted_at is null;
  if not found then
    raise exception 'Linha telefônica não encontrada ou desativada';
  end if;

  update public.phone_lines
     set assigned_employee_id = p_employee_id, status = 'ASSIGNED'
   where id = p_phone_line_id
   returning * into v_line;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('phone_line', p_phone_line_id, v_from_employee, p_employee_id, 'ASSIGN', p_notes, auth.uid());

  return v_line;
end;
$$;

-- Desvincular uma linha zera o responsável e volta o status para AVAILABLE, de forma
-- atômica (item 19 do briefing).
create or replace function public.unassign_phone_line(p_phone_line_id uuid, p_notes text default null)
returns public.phone_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.phone_lines;
  v_from_employee uuid;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para desvincular linhas telefônicas';
  end if;

  select assigned_employee_id into v_from_employee
    from public.phone_lines where id = p_phone_line_id and deleted_at is null;
  if not found then
    raise exception 'Linha telefônica não encontrada ou desativada';
  end if;

  update public.phone_lines
     set assigned_employee_id = null, status = 'AVAILABLE'
   where id = p_phone_line_id
   returning * into v_line;

  insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, changed_by)
  values ('phone_line', p_phone_line_id, v_from_employee, null, 'UNASSIGN', p_notes, auth.uid());

  return v_line;
end;
$$;

revoke execute on function
  public.assign_notebook(uuid, uuid, text),
  public.unassign_notebook(uuid, text),
  public.assign_accessory(uuid, uuid, text),
  public.unassign_accessory(uuid, text),
  public.assign_phone_line(uuid, uuid, text),
  public.unassign_phone_line(uuid, text)
from public;

grant execute on function
  public.assign_notebook(uuid, uuid, text),
  public.unassign_notebook(uuid, text),
  public.assign_accessory(uuid, uuid, text),
  public.unassign_accessory(uuid, text),
  public.assign_phone_line(uuid, uuid, text),
  public.unassign_phone_line(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Arquivo: 20260811140400_rpc_user_administration.sql
-- ---------------------------------------------------------------------------
-- RPCs de administração de usuários. Todas exigem is_master() — ADMIN não tem acesso
-- a nenhuma delas (item 30: ADMIN não pode aprovar/rejeitar/bloquear/alterar role).
-- Como app_profiles não tem policy de UPDATE para ninguém (ver 20260811140100), estas
-- funções security definer são o ÚNICO caminho possível para mudar status/role —
-- inclusive para o próprio MASTER, o que centraliza e audita 100% dessas operações.

-- Aprova (PENDING/REJECTED → APPROVED) ou reativa (BLOCKED → APPROVED). Uma função só,
-- com o rótulo de auditoria variando conforme o status anterior, para não duplicar
-- lógica entre "aprovar" e "reativar" (que são, no fundo, a mesma transição de destino).
create or replace function public.approve_user(p_user_id uuid)
returns public.app_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.app_profiles;
  v_old_status public.profile_status;
  v_action text;
begin
  if not public.is_master() then
    raise exception 'Apenas MASTER pode aprovar ou reativar usuários';
  end if;

  select status into v_old_status from public.app_profiles where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  v_action := case when v_old_status = 'BLOCKED' then 'REACTIVATE_USER' else 'APPROVE_USER' end;

  update public.app_profiles
     set status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_user_id
   returning * into v_profile;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, v_action,
          jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'APPROVED'));

  return v_profile;
end;
$$;

create or replace function public.reject_user(p_user_id uuid)
returns public.app_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.app_profiles;
  v_old_status public.profile_status;
begin
  if not public.is_master() then
    raise exception 'Apenas MASTER pode rejeitar usuários';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não é possível rejeitar a própria conta';
  end if;

  select status into v_old_status from public.app_profiles where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  update public.app_profiles
     set status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_user_id
   returning * into v_profile;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, 'REJECT_USER',
          jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'REJECTED'));

  return v_profile;
end;
$$;

create or replace function public.block_user(p_user_id uuid)
returns public.app_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.app_profiles;
  v_old_status public.profile_status;
begin
  if not public.is_master() then
    raise exception 'Apenas MASTER pode bloquear usuários';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não é possível bloquear a própria conta';
  end if;

  select status into v_old_status from public.app_profiles where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  update public.app_profiles
     set status = 'BLOCKED', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_user_id
   returning * into v_profile;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, 'BLOCK_USER',
          jsonb_build_object('status', v_old_status), jsonb_build_object('status', 'BLOCKED'));

  return v_profile;
end;
$$;

-- Guarda dupla contra bloqueio: impede alterar a própria role (item 66.12 do briefing)
-- E impede remover o último MASTER do sistema (evitaria lock-out completo).
create or replace function public.change_user_role(p_user_id uuid, p_new_role public.app_role)
returns public.app_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.app_profiles;
  v_old_role public.app_role;
  v_master_count integer;
begin
  if not public.is_master() then
    raise exception 'Apenas MASTER pode alterar roles';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Não é possível alterar a própria role';
  end if;

  select role into v_old_role from public.app_profiles where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;

  if v_old_role = 'MASTER' and p_new_role <> 'MASTER' then
    select count(*) into v_master_count
      from public.app_profiles where role = 'MASTER' and status = 'APPROVED';
    if v_master_count <= 1 then
      raise exception 'Não é possível remover o último MASTER do sistema';
    end if;
  end if;

  update public.app_profiles set role = p_new_role where id = p_user_id
  returning * into v_profile;

  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_value, new_value)
  values (auth.uid(), 'app_profiles', p_user_id, 'CHANGE_ROLE',
          jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_new_role));

  return v_profile;
end;
$$;

revoke execute on function
  public.approve_user(uuid),
  public.reject_user(uuid),
  public.block_user(uuid),
  public.change_user_role(uuid, public.app_role)
from public;

grant execute on function
  public.approve_user(uuid),
  public.reject_user(uuid),
  public.block_user(uuid),
  public.change_user_role(uuid, public.app_role)
to authenticated;

