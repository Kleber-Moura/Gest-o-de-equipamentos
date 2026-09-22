-- Funções auxiliares usadas por praticamente todas as RLS policies do projeto.
-- Centralizadas aqui para não repetir a mesma subquery em cada policy (regra do
-- briefing: centralizar regras de negócio, especialmente as de segurança).
--
-- security definer + search_path fixo: evita que a leitura de app_profiles dependa da
-- RLS de app_profiles (o que causaria recursão) e evita sequestro de search_path.

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_profiles where id = auth.uid();
$$;

create or replace function public.current_user_status()
returns public.profile_status
language sql
stable
security definer
set search_path = public
as $$
  select status from public.app_profiles where id = auth.uid();
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
as $$
  select public.current_user_status() = 'APPROVED';
$$;

create or replace function public.is_admin_or_master()
returns boolean
language sql
stable
as $$
  select public.is_approved() and public.current_user_role() in ('ADMIN', 'MASTER');
$$;

create or replace function public.is_master()
returns boolean
language sql
stable
as $$
  select public.is_approved() and public.current_user_role() = 'MASTER';
$$;
