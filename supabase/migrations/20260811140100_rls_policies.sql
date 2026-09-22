-- ============================================================================
-- app_profiles: cada usuário só vê o próprio perfil; MASTER vê todos (fila de
-- aprovação). Não há policy de INSERT/UPDATE/DELETE aqui de propósito: toda
-- mudança de status/role passa pelas RPCs security definer (approve_user/
-- reject_user/block_user/change_user_role) — inclusive para o próprio MASTER.
-- Isso é o que garante, no banco, que "um usuário nunca poderá promover o
-- próprio perfil" (item 31 do briefing), e não apenas por ausência de botão na UI.
-- ============================================================================
alter table public.app_profiles enable row level security;

create policy app_profiles_select_self on public.app_profiles for select
  using (id = auth.uid());

create policy app_profiles_select_master on public.app_profiles for select
  using (public.is_master());

-- ============================================================================
-- Tabelas de referência: leitura para qualquer usuário aprovado; escrita para
-- ADMIN/MASTER. Sem policy de DELETE — exclusão física fica indisponível via
-- API (soft delete via coluna "active", conforme item 37 do briefing).
-- ============================================================================
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.asset_categories enable row level security;
alter table public.carriers enable row level security;

create policy departments_select on public.departments for select using (public.is_approved());
create policy departments_insert on public.departments for insert with check (public.is_admin_or_master());
create policy departments_update on public.departments for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy locations_select on public.locations for select using (public.is_approved());
create policy locations_insert on public.locations for insert with check (public.is_admin_or_master());
create policy locations_update on public.locations for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy asset_categories_select on public.asset_categories for select using (public.is_approved());
create policy asset_categories_insert on public.asset_categories for insert with check (public.is_admin_or_master());
create policy asset_categories_update on public.asset_categories for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy carriers_select on public.carriers for select using (public.is_approved());
create policy carriers_insert on public.carriers for insert with check (public.is_admin_or_master());
create policy carriers_update on public.carriers for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- ============================================================================
-- employees: leitura para qualquer usuário aprovado; escrita para ADMIN/MASTER.
-- Sem DELETE — desativação via "active" (soft delete).
-- ============================================================================
alter table public.employees enable row level security;

create policy employees_select on public.employees for select using (public.is_approved());
create policy employees_insert on public.employees for insert with check (public.is_admin_or_master());
create policy employees_update on public.employees for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

-- ============================================================================
-- notebooks / accessories / phone_lines: mesma matriz — leitura para aprovados,
-- escrita para ADMIN/MASTER, sem DELETE físico (soft delete via deleted_at).
-- Atribuição/desvinculação usam RPCs dedicadas (assign_*/unassign_*) para
-- garantir atomicidade com asset_movements — ver migration de RPCs.
-- ============================================================================
alter table public.notebooks enable row level security;
alter table public.accessories enable row level security;
alter table public.phone_lines enable row level security;

create policy notebooks_select on public.notebooks for select using (public.is_approved());
create policy notebooks_insert on public.notebooks for insert with check (public.is_admin_or_master());
create policy notebooks_update on public.notebooks for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy accessories_select on public.accessories for select using (public.is_approved());
create policy accessories_insert on public.accessories for insert with check (public.is_admin_or_master());
create policy accessories_update on public.accessories for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());

create policy phone_lines_select on public.phone_lines for select using (public.is_approved());
create policy phone_lines_insert on public.phone_lines for insert with check (public.is_admin_or_master());
create policy phone_lines_update on public.phone_lines for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());
