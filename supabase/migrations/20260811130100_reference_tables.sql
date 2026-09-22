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
