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

-- UNIQUE "cheio": no PostgreSQL, uma constraint UNIQUE já permite múltiplos NULLs
-- (NULL nunca é considerado igual a outro NULL), então não precisa de índice parcial
-- para acomodar os acessórios sem serial — e assim o upsert do PostgREST/supabase-js
-- consegue usar essa constraint como alvo de ON CONFLICT.
alter table public.accessories add constraint accessories_serial_number_key unique (serial_number);

create index idx_accessories_category on public.accessories (category_id);
create index idx_accessories_employee on public.accessories (employee_id);
create index idx_accessories_status on public.accessories (status);
create index idx_accessories_location on public.accessories (location_id);

create trigger trg_accessories_updated_at before update on public.accessories
  for each row execute function public.set_updated_at();
