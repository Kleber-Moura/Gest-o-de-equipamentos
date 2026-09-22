-- ============================================================================
-- DADOS FICTÍCIOS — Controle de Equipamentos
-- ============================================================================
-- Rode isso DEPOIS do arquivo 00_estrutura_completa_projeto_novo.sql, no
-- mesmo SQL Editor (New query de novo, cola tudo, Run).
--
-- Tudo aqui é INVENTADO — nomes, e-mails, números de telefone, patrimônios.
-- Nada corresponde aos dados reais do projeto antigo.
-- ============================================================================

-- 1) Departamentos
insert into public.departments (name) values
  ('TI'), ('RH'), ('Financeiro'), ('Comercial'), ('Operações');

-- 2) Localidades
insert into public.locations (name, code) values
  ('Matriz São Paulo', 'SP-01'),
  ('Filial Rio de Janeiro', 'RJ-01'),
  ('Filial Curitiba', 'PR-01'),
  ('Home Office', 'HO-00');

-- 3) Categorias de acessório
insert into public.asset_categories (name) values
  ('Mouse'), ('Teclado'), ('Headset'), ('Monitor'), ('Dock Station'), ('Carregador');

-- 4) Operadoras
insert into public.carriers (name) values
  ('Vivo'), ('Claro'), ('TIM'), ('Oi');

-- 5) Colaboradores (fictícios)
insert into public.employees (name, username, email, department_id, location_id, is_shared_asset_holder) values
  ('Ana Beatriz Souza',        'ana.souza',        'ana.souza@empresa-demo.com.br',        (select id from public.departments where name='TI'),          (select id from public.locations where name='Matriz São Paulo'),   false),
  ('Bruno Carvalho Lima',      'bruno.lima',       'bruno.lima@empresa-demo.com.br',       (select id from public.departments where name='TI'),          (select id from public.locations where name='Matriz São Paulo'),   false),
  ('Carla Mendes Rocha',       'carla.rocha',      'carla.rocha@empresa-demo.com.br',      (select id from public.departments where name='RH'),          (select id from public.locations where name='Matriz São Paulo'),   false),
  ('Diego Fernandes Alves',    'diego.alves',      'diego.alves@empresa-demo.com.br',      (select id from public.departments where name='Financeiro'),  (select id from public.locations where name='Filial Rio de Janeiro'), false),
  ('Elaine Cristina Santos',   'elaine.santos',    'elaine.santos@empresa-demo.com.br',    (select id from public.departments where name='Financeiro'),  (select id from public.locations where name='Filial Rio de Janeiro'), false),
  ('Fabio Henrique Costa',     'fabio.costa',      'fabio.costa@empresa-demo.com.br',      (select id from public.departments where name='Comercial'),   (select id from public.locations where name='Filial Curitiba'),    false),
  ('Gabriela Nunes Pereira',   'gabriela.pereira', 'gabriela.pereira@empresa-demo.com.br', (select id from public.departments where name='Comercial'),   (select id from public.locations where name='Filial Curitiba'),    false),
  ('Henrique Barbosa Dias',    'henrique.dias',    'henrique.dias@empresa-demo.com.br',    (select id from public.departments where name='Operações'),   (select id from public.locations where name='Matriz São Paulo'),   false),
  ('Isabela Martins Rezende',  'isabela.rezende',  'isabela.rezende@empresa-demo.com.br',  (select id from public.departments where name='Operações'),   (select id from public.locations where name='Matriz São Paulo'),   false),
  ('João Pedro Almeida',       'joao.almeida',     'joao.almeida@empresa-demo.com.br',     (select id from public.departments where name='TI'),          (select id from public.locations where name='Home Office'),        false),
  ('Karina Oliveira Ramos',    'karina.ramos',     'karina.ramos@empresa-demo.com.br',     (select id from public.departments where name='RH'),          (select id from public.locations where name='Home Office'),        false),
  ('Lucas Gabriel Teixeira',   'lucas.teixeira',   'lucas.teixeira@empresa-demo.com.br',   (select id from public.departments where name='Comercial'),   (select id from public.locations where name='Home Office'),        false),
  ('Mariana Correia Fonseca',  'mariana.fonseca',  'mariana.fonseca@empresa-demo.com.br',  (select id from public.departments where name='Financeiro'),  (select id from public.locations where name='Matriz São Paulo'),   false),
  ('Nicolas Andrade Farias',   'nicolas.farias',   'nicolas.farias@empresa-demo.com.br',   (select id from public.departments where name='Operações'),   (select id from public.locations where name='Filial Rio de Janeiro'), false),
  ('Olivia Ribeiro Cunha',     'olivia.cunha',     'olivia.cunha@empresa-demo.com.br',     (select id from public.departments where name='TI'),          (select id from public.locations where name='Filial Curitiba'),    false),
  ('Estoque TI',               'estoque.ti',       'estoque.ti@empresa-demo.com.br',       (select id from public.departments where name='TI'),          (select id from public.locations where name='Matriz São Paulo'),   true),
  ('Sala de Reunião - Matriz', 'sala.reuniao',     'sala.reuniao@empresa-demo.com.br',     (select id from public.departments where name='Operações'),   (select id from public.locations where name='Matriz São Paulo'),   true);

-- 6) Notebooks (14 — variando status e vida útil)
insert into public.notebooks (patrimonio, serial_number, modelo, data_aquisicao, garantia_fim, status, employee_id, location_id, notes) values
  ('NB-0001','SN-NB-0001','Dell Latitude 5440','2023-03-10','2026-03-10','ASSIGNED',(select id from public.employees where username='ana.souza'),(select id from public.locations where name='Matriz São Paulo'),null),
  ('NB-0002','SN-NB-0002','Dell Latitude 5440','2023-03-10','2026-03-10','ASSIGNED',(select id from public.employees where username='bruno.lima'),(select id from public.locations where name='Matriz São Paulo'),null),
  ('NB-0003','SN-NB-0003','Lenovo ThinkPad E14','2022-06-01','2025-06-01','ASSIGNED',(select id from public.employees where username='carla.rocha'),(select id from public.locations where name='Matriz São Paulo'),null),
  ('NB-0004','SN-NB-0004','Lenovo ThinkPad E14','2022-06-01','2025-06-01','ASSIGNED',(select id from public.employees where username='diego.alves'),(select id from public.locations where name='Filial Rio de Janeiro'),null),
  ('NB-0005','SN-NB-0005','Dell Latitude 5440','2024-01-15','2027-01-15','ASSIGNED',(select id from public.employees where username='elaine.santos'),(select id from public.locations where name='Filial Rio de Janeiro'),null),
  ('NB-0006','SN-NB-0006','MacBook Air M2','2024-05-20','2026-05-20','ASSIGNED',(select id from public.employees where username='fabio.costa'),(select id from public.locations where name='Filial Curitiba'),null),
  ('NB-0007','SN-NB-0007','MacBook Air M2','2024-05-20','2026-05-20','ASSIGNED',(select id from public.employees where username='gabriela.pereira'),(select id from public.locations where name='Filial Curitiba'),null),
  ('NB-0008','SN-NB-0008','Dell Latitude 3440','2021-02-10','2024-02-10','ASSIGNED',(select id from public.employees where username='henrique.dias'),(select id from public.locations where name='Matriz São Paulo'),'Fora da vida útil recomendada — priorizar troca'),
  ('NB-0009','SN-NB-0009','Dell Latitude 3440','2021-02-10','2024-02-10','BROKEN',null,(select id from public.locations where name='Matriz São Paulo'),'Tela quebrada, aguardando avaliação técnica'),
  ('NB-0010','SN-NB-0010','Lenovo ThinkPad E14','2023-08-01','2026-08-01','AVAILABLE',null,(select id from public.locations where name='Matriz São Paulo'),null),
  ('NB-0011','SN-NB-0011','Lenovo ThinkPad E14','2023-08-01','2026-08-01','AVAILABLE',null,(select id from public.locations where name='Filial Rio de Janeiro'),null),
  ('NB-0012','SN-NB-0012','Dell Latitude 5440','2024-01-15','2027-01-15','ASSIGNED',(select id from public.employees where username='joao.almeida'),(select id from public.locations where name='Home Office'),null),
  ('NB-0013','SN-NB-0013','MacBook Air M2','2024-05-20','2026-05-20','MAINTENANCE',(select id from public.employees where username='karina.ramos'),(select id from public.locations where name='Home Office'),'Em manutenção — troca de bateria'),
  ('NB-0014','SN-NB-0014','Dell Latitude 3440','2020-11-05','2023-11-05','DECOMMISSIONED',null,(select id from public.locations where name='Matriz São Paulo'),'Baixado por fim de vida útil');

-- Soft-delete do notebook baixado (DECOMMISSIONED), igual o sistema faz de verdade
update public.notebooks set deleted_at = now() - interval '30 days' where patrimonio = 'NB-0014';

-- 7) Acessórios (18)
insert into public.accessories (patrimonio, serial_number, modelo, category_id, status, employee_id, location_id, notes) values
  ('AC-0001','SN-AC-0001','Logitech MX Master 3', (select id from public.asset_categories where name='Mouse'),     'ASSIGNED', (select id from public.employees where username='ana.souza'),       (select id from public.locations where name='Matriz São Paulo'), null),
  ('AC-0002','SN-AC-0002','Logitech MX Master 3', (select id from public.asset_categories where name='Mouse'),     'ASSIGNED', (select id from public.employees where username='bruno.lima'),      (select id from public.locations where name='Matriz São Paulo'), null),
  (null,      null,        'Mouse Multilaser sem fio', (select id from public.asset_categories where name='Mouse'), 'AVAILABLE', null, (select id from public.locations where name='Matriz São Paulo'), null),
  (null,      null,        'Mouse Multilaser sem fio', (select id from public.asset_categories where name='Mouse'), 'AVAILABLE', null, (select id from public.locations where name='Filial Rio de Janeiro'), null),
  ('AC-0003','SN-AC-0003','Logitech K380',        (select id from public.asset_categories where name='Teclado'),   'ASSIGNED', (select id from public.employees where username='carla.rocha'),     (select id from public.locations where name='Matriz São Paulo'), null),
  ('AC-0004','SN-AC-0004','Logitech K380',        (select id from public.asset_categories where name='Teclado'),   'ASSIGNED', (select id from public.employees where username='diego.alves'),     (select id from public.locations where name='Filial Rio de Janeiro'), null),
  (null,      null,        'Teclado ABNT2 padrão', (select id from public.asset_categories where name='Teclado'),  'AVAILABLE', null, (select id from public.locations where name='Filial Curitiba'), null),
  ('AC-0005','SN-AC-0005','JBL Quantum 100',      (select id from public.asset_categories where name='Headset'),   'ASSIGNED', (select id from public.employees where username='elaine.santos'),   (select id from public.locations where name='Filial Rio de Janeiro'), null),
  ('AC-0006','SN-AC-0006','JBL Quantum 100',      (select id from public.asset_categories where name='Headset'),   'ASSIGNED', (select id from public.employees where username='fabio.costa'),     (select id from public.locations where name='Filial Curitiba'), null),
  ('AC-0007','SN-AC-0007','JBL Quantum 100',      (select id from public.asset_categories where name='Headset'),   'BROKEN',   null, (select id from public.locations where name='Matriz São Paulo'), 'Microfone com defeito'),
  (null,      null,        'Headset genérico P2',(select id from public.asset_categories where name='Headset'),   'AVAILABLE', null, (select id from public.locations where name='Home Office'), null),
  ('AC-0008','SN-AC-0008','LG 24" Full HD',       (select id from public.asset_categories where name='Monitor'),   'ASSIGNED', (select id from public.employees where username='gabriela.pereira'), (select id from public.locations where name='Filial Curitiba'), null),
  ('AC-0009','SN-AC-0009','LG 24" Full HD',       (select id from public.asset_categories where name='Monitor'),   'ASSIGNED', (select id from public.employees where username='henrique.dias'),    (select id from public.locations where name='Matriz São Paulo'), null),
  (null,      null,        'LG 24" Full HD',      (select id from public.asset_categories where name='Monitor'),   'AVAILABLE', null, (select id from public.locations where name='Matriz São Paulo'), null),
  ('AC-0010','SN-AC-0010','Dell Dock WD19',       (select id from public.asset_categories where name='Dock Station'),'ASSIGNED', (select id from public.employees where username='joao.almeida'),   (select id from public.locations where name='Home Office'), null),
  (null,      null,        'Dell Dock WD19',      (select id from public.asset_categories where name='Dock Station'),'AVAILABLE', null, (select id from public.locations where name='Matriz São Paulo'), null),
  ('AC-0011','SN-AC-0011','Carregador Dell 65W',  (select id from public.asset_categories where name='Carregador'),'ASSIGNED', (select id from public.employees where username='karina.ramos'),   (select id from public.locations where name='Home Office'), null),
  (null,      null,        'Carregador Dell 65W', (select id from public.asset_categories where name='Carregador'),'AVAILABLE', null, (select id from public.locations where name='Filial Rio de Janeiro'), null);

-- 8) Linhas telefônicas (10)
insert into public.phone_lines (number, carrier_id, assigned_employee_id, department_id, location_id, status, chip_type) values
  ('+5511987650001',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='ana.souza'),      (select id from public.departments where name='TI'),         (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'eSIM'),
  ('+5511987650002',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='bruno.lima'),     (select id from public.departments where name='TI'),         (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'eSIM'),
  ('+5521987650003',(select id from public.carriers where name='Claro'),(select id from public.employees where username='diego.alves'),    (select id from public.departments where name='Financeiro'), (select id from public.locations where name='Filial Rio de Janeiro'), 'ASSIGNED', 'Físico'),
  ('+5521987650004',(select id from public.carriers where name='Claro'),(select id from public.employees where username='elaine.santos'),  (select id from public.departments where name='Financeiro'), (select id from public.locations where name='Filial Rio de Janeiro'), 'ASSIGNED', 'Físico'),
  ('+5541987650005',(select id from public.carriers where name='TIM'),  (select id from public.employees where username='fabio.costa'),    (select id from public.departments where name='Comercial'),  (select id from public.locations where name='Filial Curitiba'), 'ASSIGNED', 'Físico'),
  ('+5541987650006',(select id from public.carriers where name='TIM'),  (select id from public.employees where username='gabriela.pereira'),(select id from public.departments where name='Comercial'), (select id from public.locations where name='Filial Curitiba'), 'ASSIGNED', 'Físico'),
  ('+5511987650007',(select id from public.carriers where name='Vivo'), (select id from public.employees where username='henrique.dias'),  (select id from public.departments where name='Operações'),  (select id from public.locations where name='Matriz São Paulo'), 'ASSIGNED', 'eSIM'),
  ('+5511987650008',(select id from public.carriers where name='Oi'),   null,                                                              null,                                                          (select id from public.locations where name='Matriz São Paulo'), 'AVAILABLE', 'Físico'),
  ('+5521987650009',(select id from public.carriers where name='Claro'),null,                                                              null,                                                          (select id from public.locations where name='Filial Rio de Janeiro'), 'AVAILABLE', 'Físico'),
  ('+5511987650010',(select id from public.carriers where name='Vivo'), null,                                                              (select id from public.departments where name='TI'),         (select id from public.locations where name='Matriz São Paulo'), 'SUSPENDED', 'eSIM');

-- 9) Faturas telefônicas (histórico dos últimos 3 meses, para o gráfico de custos)
insert into public.phone_invoices (phone_line_id, raw_number, carrier_id, amount, invoice_date) values
  ((select id from public.phone_lines where number='+5511987650001'), '+5511987650001', (select id from public.carriers where name='Vivo'),  89.90, '2026-06-01'),
  ((select id from public.phone_lines where number='+5511987650001'), '+5511987650001', (select id from public.carriers where name='Vivo'),  89.90, '2026-07-01'),
  ((select id from public.phone_lines where number='+5511987650001'), '+5511987650001', (select id from public.carriers where name='Vivo'),  94.50, '2026-08-01'),
  ((select id from public.phone_lines where number='+5511987650002'), '+5511987650002', (select id from public.carriers where name='Vivo'),  89.90, '2026-06-01'),
  ((select id from public.phone_lines where number='+5511987650002'), '+5511987650002', (select id from public.carriers where name='Vivo'),  89.90, '2026-07-01'),
  ((select id from public.phone_lines where number='+5511987650002'), '+5511987650002', (select id from public.carriers where name='Vivo'), 102.30, '2026-08-01'),
  ((select id from public.phone_lines where number='+5521987650003'), '+5521987650003', (select id from public.carriers where name='Claro'), 75.00, '2026-06-01'),
  ((select id from public.phone_lines where number='+5521987650003'), '+5521987650003', (select id from public.carriers where name='Claro'), 75.00, '2026-07-01'),
  ((select id from public.phone_lines where number='+5521987650003'), '+5521987650003', (select id from public.carriers where name='Claro'), 79.90, '2026-08-01'),
  ((select id from public.phone_lines where number='+5541987650005'), '+5541987650005', (select id from public.carriers where name='TIM'),   68.00, '2026-06-01'),
  ((select id from public.phone_lines where number='+5541987650005'), '+5541987650005', (select id from public.carriers where name='TIM'),   68.00, '2026-07-01'),
  ((select id from public.phone_lines where number='+5541987650005'), '+5541987650005', (select id from public.carriers where name='TIM'),   71.20, '2026-08-01'),
  -- fatura de um número que veio na conta da operadora mas ainda não tem linha cadastrada (caso real, não é erro)
  (null, '+5511987659999', (select id from public.carriers where name='Vivo'), 45.00, '2026-08-01');

-- 10) Histórico de movimentações (para a tela de histórico de cada ativo)
insert into public.asset_movements (asset_type, asset_id, from_employee_id, to_employee_id, movement_type, notes, created_at) values
  ('notebook',  (select id from public.notebooks where patrimonio='NB-0001'), null, (select id from public.employees where username='ana.souza'),  'ASSIGN', 'Atribuição inicial (carga fictícia)', '2023-03-12'),
  ('notebook',  (select id from public.notebooks where patrimonio='NB-0003'), null, (select id from public.employees where username='carla.rocha'), 'ASSIGN', 'Atribuição inicial (carga fictícia)', '2022-06-03'),
  ('notebook',  (select id from public.notebooks where patrimonio='NB-0012'), null, (select id from public.employees where username='joao.almeida'),'ASSIGN', 'Atribuição inicial (carga fictícia)', '2024-01-18'),
  ('accessory', (select id from public.accessories where patrimonio='AC-0001'), null, (select id from public.employees where username='ana.souza'), 'ASSIGN', 'Atribuição inicial (carga fictícia)', '2023-03-12'),
  ('phone_line',(select id from public.phone_lines where number='+5511987650001'), null, (select id from public.employees where username='ana.souza'), 'ASSIGN', 'Atribuição inicial (carga fictícia)', '2023-03-12');

-- ============================================================================
-- PRONTO! O banco novo agora tem estrutura + dados de exemplo.
-- Próximo passo: criar o usuário MASTER (klebermoura.b@gmail.com) — ver as
-- instruções no chat sobre como fazer isso pela tela de Authentication.
-- ============================================================================
