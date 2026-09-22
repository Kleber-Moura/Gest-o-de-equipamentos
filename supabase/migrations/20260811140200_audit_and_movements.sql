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
