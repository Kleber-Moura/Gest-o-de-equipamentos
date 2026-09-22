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
