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
