-- Faturas telefônicas (aba "Fatura" da planilha original) — histórico de valor
-- cobrado por linha/mês, usado no gráfico de custo da seção de telefonia do
-- Dashboard. phone_line_id fica nulo quando o número faturado não bate com
-- nenhuma linha cadastrada em phone_lines (dado real da operadora sem
-- contrapartida no cadastro — não é inventado, fica registrado para revisão).
create table public.phone_invoices (
  id uuid primary key default gen_random_uuid(),
  phone_line_id uuid references public.phone_lines(id),
  raw_number text not null,
  carrier_id uuid not null references public.carriers(id),
  amount numeric(10,2) not null check (amount >= 0),
  invoice_date date not null,
  created_at timestamptz not null default now()
);

create index idx_phone_invoices_line on public.phone_invoices (phone_line_id);
create index idx_phone_invoices_date on public.phone_invoices (invoice_date);
create index idx_phone_invoices_carrier on public.phone_invoices (carrier_id);

-- Mesma matriz de RLS de phone_lines: leitura para aprovados, escrita para
-- ADMIN/MASTER (carga feita via migration/ETL, não há tela de cadastro manual).
alter table public.phone_invoices enable row level security;

create policy phone_invoices_select on public.phone_invoices for select using (public.is_approved());
create policy phone_invoices_insert on public.phone_invoices for insert with check (public.is_admin_or_master());
create policy phone_invoices_update on public.phone_invoices for update using (public.is_admin_or_master()) with check (public.is_admin_or_master());
