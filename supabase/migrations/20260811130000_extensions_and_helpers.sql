-- Extensões necessárias para toda a base
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- comparação case-insensitive nativa (nomes, e-mails, usernames)

-- Trigger reutilizável para manter updated_at consistente em todas as tabelas.
-- Centralizado aqui para não duplicar a mesma lógica em cada tabela (regra do briefing: centralizar regras de negócio).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
