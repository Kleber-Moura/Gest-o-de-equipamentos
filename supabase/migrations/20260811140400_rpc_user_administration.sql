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
