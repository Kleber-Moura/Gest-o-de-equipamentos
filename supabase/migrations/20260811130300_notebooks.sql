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

-- UNIQUE "cheio" (não parcial): um índice único parcial (WHERE deleted_at IS NULL)
-- não pode ser usado como alvo de ON CONFLICT pelo upsert do PostgREST/supabase-js,
-- que só reconhece constraints de unicidade sem predicado. Na prática isso também é
-- mais correto: o serial de um notebook baixado nunca deveria reaparecer em outro.
alter table public.notebooks add constraint notebooks_patrimonio_key unique (patrimonio);
alter table public.notebooks add constraint notebooks_serial_number_key unique (serial_number);

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
