-- Exclusão de usuário (item pedido: "opção de exclusão de usuário") cascateia de
-- auth.users para app_profiles (on delete cascade, já existente). Mas 3 FKs
-- apontavam para app_profiles(id) sem cláusula ON DELETE (= NO ACTION por padrão),
-- o que bloquearia a exclusão de qualquer usuário que já tivesse atuado como ator
-- em algum log de auditoria/movimentação ou revisado alguma solicitação — ou seja,
-- praticamente todo ADMIN/MASTER ativo. Trocado para SET NULL: o histórico
-- permanece intacto (item do briefing de auditoria completa), só a referência ao
-- ator vira nula quando a conta dele é removida.

alter table public.audit_logs drop constraint audit_logs_actor_user_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_user_id_fkey
  foreign key (actor_user_id) references public.app_profiles (id) on delete set null;

alter table public.asset_movements drop constraint asset_movements_changed_by_fkey;
alter table public.asset_movements add constraint asset_movements_changed_by_fkey
  foreign key (changed_by) references public.app_profiles (id) on delete set null;

alter table public.app_profiles drop constraint app_profiles_reviewed_by_fkey;
alter table public.app_profiles add constraint app_profiles_reviewed_by_fkey
  foreign key (reviewed_by) references public.app_profiles (id) on delete set null;
