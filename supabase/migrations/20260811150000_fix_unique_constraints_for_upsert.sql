-- Corrige os índices únicos parciais criados nas migrations 20260811130300/130400/130500:
-- eles não podem ser usados como alvo de ON CONFLICT pelo upsert do PostgREST/supabase-js
-- (que só reconhece constraints de unicidade sem predicado). Trocamos por UNIQUE "cheio",
-- o que também é mais correto: serial/patrimônio/número de um ativo baixado não deve
-- reaparecer em outro. Para acessórios, UNIQUE já permite múltiplos NULLs nativamente,
-- então nenhum ativo sem serial é afetado.
--
-- Escrito para ser seguro de rodar mais de uma vez (idempotente): se a constraint já
-- existir de uma tentativa anterior, o bloco simplesmente ignora e segue em frente.
-- (uma constraint UNIQUE cria um índice de apoio com o mesmo nome, então o Postgres
-- reporta "já existe" como duplicate_table — 42P07 — e não duplicate_object.)

drop index if exists public.uq_notebooks_patrimonio;
drop index if exists public.uq_notebooks_serial;
drop index if exists public.uq_accessories_serial;
drop index if exists public.uq_phone_lines_number;

do $$
begin
  alter table public.notebooks add constraint notebooks_patrimonio_key unique (patrimonio);
exception
  when duplicate_table or duplicate_object then null;
end $$;

do $$
begin
  alter table public.notebooks add constraint notebooks_serial_number_key unique (serial_number);
exception
  when duplicate_table or duplicate_object then null;
end $$;

do $$
begin
  alter table public.accessories add constraint accessories_serial_number_key unique (serial_number);
exception
  when duplicate_table or duplicate_object then null;
end $$;

do $$
begin
  alter table public.phone_lines add constraint phone_lines_number_key unique (number);
exception
  when duplicate_table or duplicate_object then null;
end $$;
