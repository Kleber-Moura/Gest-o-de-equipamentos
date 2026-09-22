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

-- UNIQUE "cheio" pelo mesmo motivo das outras tabelas: índice parcial não é
-- reconhecido como alvo de ON CONFLICT pelo upsert do PostgREST/supabase-js.
alter table public.phone_lines add constraint phone_lines_number_key unique (number);

create index idx_phone_lines_carrier on public.phone_lines (carrier_id);
create index idx_phone_lines_employee on public.phone_lines (assigned_employee_id);
create index idx_phone_lines_status on public.phone_lines (status);

create trigger trg_phone_lines_updated_at before update on public.phone_lines
  for each row execute function public.set_updated_at();
