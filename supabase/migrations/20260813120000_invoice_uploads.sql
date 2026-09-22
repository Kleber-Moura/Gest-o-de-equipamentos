-- Controle de upload/leitura automática de faturas (Vivo/Claro) via IA (Gemini),
-- restrito a MASTER. O upload do PDF vai direto pro Storage pelo browser (RLS
-- abaixo); toda a leitura/gravação em invoice_uploads e phone_invoices é feita
-- pela Edge Function "process-invoice" com a service role — por isso não existe
-- policy de insert/update aqui: a tabela só é preenchida pelo servidor, igual
-- audit_logs.
create type public.invoice_upload_status as enum ('PROCESSING', 'DONE', 'ERROR');

create table public.invoice_uploads (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id),
  file_name text not null,
  storage_path text not null,
  status public.invoice_upload_status not null default 'PROCESSING',
  lines_extracted integer,
  lines_matched integer,
  error_message text,
  uploaded_by uuid references public.app_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_invoice_uploads_created on public.invoice_uploads (created_at desc);

alter table public.invoice_uploads enable row level security;

create policy invoice_uploads_select on public.invoice_uploads for select using (public.is_master());

-- Liga cada fatura importada ao upload que a gerou, e permite reenviar a mesma
-- fatura sem duplicar linhas (upsert por linha/operadora/data — a mesma chave
-- natural usada na importação inicial da planilha).
alter table public.phone_invoices add column upload_id uuid references public.invoice_uploads (id);
alter table public.phone_invoices add constraint phone_invoices_dedupe_key
  unique (raw_number, carrier_id, invoice_date);

-- Bucket privado para os PDFs das faturas — só MASTER envia/lê.
insert into storage.buckets (id, name, public) values ('phone-invoices', 'phone-invoices', false);

create policy phone_invoices_bucket_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'phone-invoices' and public.is_master());

create policy phone_invoices_bucket_select on storage.objects
  for select to authenticated
  using (bucket_id = 'phone-invoices' and public.is_master());
