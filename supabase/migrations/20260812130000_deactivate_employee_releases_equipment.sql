-- Ao desativar um colaborador, os notebooks e acessórios dele passam para
-- AVAILABLE (liberados para uso por outra pessoa), mas o employee_id NÃO é
-- zerado — o último responsável fica registrado para consulta histórica.
-- Decisão explícita do usuário: "não precisa desvincular o responsável".
create or replace function public.deactivate_employee(p_employee_id uuid)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
begin
  if not public.is_admin_or_master() then
    raise exception 'Sem permissão para desativar colaboradores';
  end if;

  update public.employees set active = false where id = p_employee_id
  returning * into v_employee;

  if not found then
    raise exception 'Colaborador não encontrado';
  end if;

  update public.notebooks
     set status = 'AVAILABLE'
   where employee_id = p_employee_id and deleted_at is null and status <> 'AVAILABLE';

  update public.accessories
     set status = 'AVAILABLE'
   where employee_id = p_employee_id and deleted_at is null and status <> 'AVAILABLE';

  return v_employee;
end;
$$;

revoke execute on function public.deactivate_employee(uuid) from public;
grant execute on function public.deactivate_employee(uuid) to authenticated;
