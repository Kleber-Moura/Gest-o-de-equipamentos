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
    case when v_is_bootstrap_master then 'MASTER'::public.app_role else 'USER'::public.app_role end,
    case when v_is_bootstrap_master then 'APPROVED'::public.profile_status else 'PENDING'::public.profile_status end,
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
