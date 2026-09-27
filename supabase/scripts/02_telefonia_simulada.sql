-- ============================================================================
-- TELEFONIA SIMULADA — mais linhas e 21 meses de faturas fictícias
-- ============================================================================
-- Rode DEPOIS do 01_dados_ficticios.sql, no SQL Editor do Supabase
-- (New query, cola tudo, Run). Pode rodar de novo quantas vezes quiser: as
-- faturas fictícias são apagadas e recriadas, e as linhas novas usam
-- ON CONFLICT para não duplicar.
--
-- Tudo aqui é INVENTADO. Só mexe em números do padrão fictício
-- +55xx98765xxxx e em faturas sem upload (upload_id nulo) — faturas reais
-- importadas pela tela de upload não são tocadas.
-- ============================================================================

-- 1) Mais 10 linhas atribuídas, espalhadas entre as 4 operadoras
insert into public.phone_lines (number, carrier_id, assigned_employee_id, department_id, location_id, status, chip_type) values
  ('+5511987650011',(select id from public.carriers where name='Oi'),   (select id from public.employees where username='carla.rocha'),     (select id from public.departments where name='RH'),         (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'Físico'),
  ('+5511987650012',(select id from public.carriers where name='Oi'),   (select id from public.employees where username='isabela.rezende'), (select id from public.departments where name='Operações'),  (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'Físico'),
  ('+5511987650013',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='joao.almeida'),    (select id from public.departments where name='TI'),         (select id from public.locations where name='Home Office'), 'ASSIGNED', 'eSIM'),
  ('+5511987650014',(select id from public.carriers where name='TIM'),  (select id from public.employees where username='karina.ramos'),    (select id from public.departments where name='RH'),         (select id from public.locations where name='Home Office'), 'ASSIGNED', 'eSIM'),
  ('+5511987650015',(select id from public.carriers where name='Claro'),(select id from public.employees where username='lucas.teixeira'),  (select id from public.departments where name='Comercial'),  (select id from public.locations where name='Home Office'), 'ASSIGNED', 'eSIM'),
  ('+5511987650016',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='mariana.fonseca'), (select id from public.departments where name='Financeiro'), (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'Físico'),
  ('+5521987650017',(select id from public.carriers where name='Claro'),(select id from public.employees where username='nicolas.farias'),  (select id from public.departments where name='Operações'),  (select id from public.locations where name='Filial Rio de Janeiro'), 'ASSIGNED', 'Físico'),
  ('+5541987650018',(select id from public.carriers where name='TIM'),  (select id from public.employees where username='olivia.cunha'),    (select id from public.departments where name='TI'),         (select id from public.locations where name='Filial Curitiba'), 'ASSIGNED', 'Físico'),
  ('+5541987650019',(select id from public.carriers where name='Oi'),   (select id from public.employees where username='estoque.ti'),      (select id from public.departments where name='TI'),         (select id from public.locations where name='Filial Curitiba'), 'ASSIGNED', 'Físico'),
  ('+5511987650020',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='sala.reuniao'),    (select id from public.departments where name='Operações'),  (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'eSIM')
on conflict (number) do nothing;

-- 2) Limpa as faturas fictícias anteriores (inclusive as do 01_dados_ficticios)
delete from public.phone_invoices
where upload_id is null
  and raw_number like '+55__98765____';

-- 3) Uma fatura por mês, de jan/2025 a set/2026, para toda linha atribuída ou suspensa.
--    Valor = plano da operadora × perfil de uso da linha × sazonalidade × reajuste anual
--            + variação do mês + picos eventuais (roaming/ligações internacionais).
--    hashtext() deixa a "aleatoriedade" determinística: rodar de novo dá os mesmos valores.
insert into public.phone_invoices (phone_line_id, raw_number, carrier_id, amount, invoice_date)
select
  l.id,
  l.number,
  l.carrier_id,
  round(
    case
      when l.status = 'SUSPENDED' then 15.00
      else greatest(
        29.90,
        plan.base
          * (0.75 + (abs(hashtext(l.number)) % 80) / 100.0)                          -- perfil: 0,75× a 1,55×
          * (1 + 0.10 * sin(extract(month from m) * pi() / 6))                        -- sazonalidade
          * case when extract(year from m) = 2026 then 1.07 else 1 end               -- reajuste 2026
          + ((abs(hashtext(l.number || m::text)) % 30) - 10)                          -- variação do mês
          + case when abs(hashtext(m::text || l.number)) % 13 = 0
                 then 60 + abs(hashtext(l.number || 'pico' || m::text)) % 120 else 0 end -- pico eventual
      )
    end::numeric, 2),
  m::date
from public.phone_lines l
join public.carriers c on c.id = l.carrier_id
join (values ('Vivo', 92.0), ('Claro', 81.0), ('TIM', 72.0), ('Oi', 58.0)) as plan(name, base) on plan.name = c.name
cross join generate_series('2025-01-01'::date, '2026-09-01'::date, interval '1 month') as m
where l.deleted_at is null
  and l.status in ('ASSIGNED', 'SUSPENDED')
  and l.number like '+55__98765____';

-- 4) Mantém um número faturado sem linha cadastrada (caso real que o sistema trata)
insert into public.phone_invoices (phone_line_id, raw_number, carrier_id, amount, invoice_date)
select null, '+5511987659999', (select id from public.carriers where name='Vivo'), 45.00, m::date
from generate_series('2026-06-01'::date, '2026-08-01'::date, interval '1 month') as m;
