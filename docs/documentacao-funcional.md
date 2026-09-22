# Documentação Funcional — KM Controle de Equipamentos

*Guia completo de como o sistema funciona, escrito para qualquer pessoa da empresa
entender — sem precisar saber programação ou banco de dados.*

## 1. O que é este sistema

O "KM Controle de Equipamentos" é o sistema interno usado para controlar todo o parque
de tecnologia da empresa: **notebooks**, **acessórios** (mouses, teclados, monitores,
carregadores etc.) e **linhas telefônicas corporativas**. Para cada um desses itens, o
sistema sabe: quem é o responsável, em qual local ele está, qual o estado dele
(disponível, em uso, quebrado, em manutenção...) e todo o histórico de quem já usou
aquele item antes.

Além do controle de equipamentos, o sistema também guarda o cadastro de **colaboradores**
(as pessoas que recebem os equipamentos), organiza esses colaboradores por
**departamento** e **localidade**, e tem sua própria gestão de **usuários com login**
(quem pode entrar no sistema e o que cada um pode fazer nele).

### De onde o sistema veio

Antes deste sistema existir, todo esse controle era feito em uma planilha do Excel.
Planilhas têm um problema conhecido: qualquer pessoa pode editar qualquer célula, não
existe histórico confiável de quem mudou o quê, e é fácil um dado ficar desatualizado
sem ninguém perceber (por exemplo, uma coluna de "status da garantia" preenchida à mão
que não bate mais com a data real). O sistema nasceu exatamente para resolver isso:
todas as regras — quem pode editar, o que precisa de aprovação, o que fica registrado —
passaram a ser garantidas pelo próprio sistema, não pela boa vontade de quem preenche uma
célula.

## 2. Quem usa o sistema: os três papéis

Todo mundo que usa o sistema tem um **papel**, que define o que a pessoa pode fazer:

| Papel | O que pode fazer |
|---|---|
| **USER** (usuário comum) | Consultar o Dashboard, ver a lista de notebooks, acessórios e linhas telefônicas. Não pode cadastrar, editar nem atribuir nada. |
| **ADMIN** | Tudo que o USER pode, **mais**: cadastrar e editar notebooks/acessórios/linhas, atribuir e desvincular equipamentos de colaboradores, cadastrar colaboradores, departamentos, localidades, categorias de acessório e operadoras de telefonia. |
| **MASTER** | Tudo que o ADMIN pode, **mais**: aprovar, rejeitar ou bloquear o acesso de novos usuários; trocar o papel de qualquer usuário; criar/editar/excluir contas de usuário e resetar senha de qualquer um; ver a auditoria completa (o "histórico de tudo que aconteceu" no sistema); enviar e processar faturas de telefonia pela leitura automática por Inteligência Artificial. |

Um MASTER é, na prática, o "administrador geral" do sistema — é o único papel que mexe em
quem tem acesso e o que cada pessoa pode fazer.

## 3. Como alguém ganha acesso ao sistema

1. A pessoa acessa a tela de cadastro e cria uma conta com nome, e-mail e senha.
2. Assim que a conta é criada, ela fica automaticamente com status **"Pendente"** — ou
   seja, a pessoa já tem login e senha, mas **ainda não consegue usar o sistema**. Ao
   tentar entrar, ela vê uma tela explicando que o acesso está aguardando aprovação.
3. Um usuário **MASTER** entra na tela "Solicitações de acesso" e vê a fila de pedidos
   pendentes. Ali ele pode:
   - **Aprovar** — a pessoa passa a poder usar o sistema normalmente, com o papel padrão
     (USER).
   - **Rejeitar** — o pedido de acesso é negado.
4. Depois de aprovada, uma conta também pode ser **bloqueada** a qualquer momento (por
   exemplo, se a pessoa saiu da empresa) e **reativada** depois, se for o caso.
5. Só depois um MASTER pode promover alguém a ADMIN ou a outro MASTER, na mesma tela de
   administração de usuários.

Duas proteções importantes que o sistema garante sozinho, sem depender de ninguém lembrar
de segui-las:

- **Ninguém consegue promover a si mesmo.** Nem um MASTER consegue mudar o próprio papel
  ou aprovar/bloquear a própria conta — sempre precisa ser outro MASTER fazendo isso.
- **Nunca é possível ficar sem nenhum MASTER no sistema.** Se só existe um MASTER
  aprovado, o sistema recusa qualquer tentativa de rebaixar essa última conta — isso
  evitaria uma situação em que ninguém mais consegue administrar o sistema.

## 4. Os módulos do sistema

### 4.1 Dashboard (tela inicial)

É a primeira tela que aparece ao entrar no sistema. Mostra uma visão geral e rápida de
toda a frota de equipamentos:

- Quantos notebooks, acessórios e linhas telefônicas existem no total.
- A "saúde da frota": quanto por cento dos notebooks e acessórios está efetivamente em
  uso, quanto está disponível, quanto está quebrado/em manutenção.
- **Ciclo de vida dos notebooks**: quantos já passaram do prazo recomendado de troca,
  quantos estão perto de vencer e quantos ainda estão dentro da vida útil esperada (ver
  seção 5.3 para a regra completa).
- Gráficos de distribuição: notebooks por localidade, acessórios por categoria.
- Um painel completo de **telefonia**: quantidade de linhas por operadora, quantas estão
  atribuídas ou disponíveis, e um gráfico de custo mensal por operadora ao longo do ano
  (com filtro por departamento, operadora, mês e ano).
- Um botão **"Exportar PDF"**, que gera um arquivo PDF com uma "foto" de tudo que está
  sendo mostrado na tela naquele momento — útil para apresentar em uma reunião ou guardar
  um retrato de um mês específico.

### 4.2 Notebooks, Acessórios e Linhas Telefônicas

As três telas seguem o mesmo padrão de uso:

- Uma lista paginada de todos os itens ativos, com filtros (por status, categoria/
  operadora, localidade, departamento) e uma busca por texto (patrimônio, número de
  série, modelo, número da linha, ou até pelo nome do responsável).
- Quem é ADMIN ou MASTER vê um botão para **cadastrar um novo item** e, em cada linha da
  lista, opções para **editar**, **atribuir a um colaborador**, **desvincular** (tirar de
  quem está usando, voltando pra "disponível") e **desativar** (ver seção 5.2 — desativar
  não é a mesma coisa que apagar).
- Um usuário comum (USER) só consegue visualizar essas listas, sem nenhum desses botões.

Na tela de **Notebooks**, uma coluna especial mostra o "ciclo de vida" do equipamento —
uma mensagem tipo "troca vencida há 2 meses" ou "troca em 1 ano e 3 meses", calculada
automaticamente a partir da data de compra.

Na tela de **Linhas Telefônicas**, usuários MASTER têm uma aba extra chamada
**"Faturas"**, onde é possível enviar o PDF da fatura mensal da operadora e o sistema lê
automaticamente os valores cobrados por linha usando Inteligência Artificial (ver seção
4.5).

### 4.3 Administração

Um conjunto de telas, visível só para ADMIN e MASTER, para manter os cadastros de apoio:

- **Solicitações de acesso** (só MASTER pode agir): aprovar/rejeitar/bloquear/reativar
  contas e trocar o papel de qualquer usuário (ver seção 3).
- **Colaboradores**: cadastro das pessoas que recebem equipamentos — nome, usuário,
  e-mail, departamento, localidade. Tem uma opção **"Ver vínculos"** que mostra, de uma
  vez só, todos os notebooks, acessórios e linhas telefônicas daquela pessoa.
- **Categorias**, **Departamentos**, **Localidades** e **Operadoras**: quatro cadastros
  simples (só um nome cada), usados para organizar e filtrar os outros cadastros.

### 4.4 Auditoria (só MASTER)

Uma tela somente-leitura que mostra, em ordem cronológica, **tudo que já aconteceu** no
sistema: quem criou o quê, quem editou, quem atribuiu ou desvinculou um equipamento, quem
aprovou ou bloqueou um usuário, quem trocou o papel de alguém, quem processou uma fatura.
Cada linha mostra quem fez a ação e exatamente o que mudou (o valor antes e depois). É a
"caixa-preta" do sistema — não pode ser editada nem apagada por ninguém, nem pelo próprio
MASTER.

### 4.5 Leitura automática de faturas por Inteligência Artificial

Quando um MASTER envia o PDF de uma fatura de telefonia, o sistema:

1. Guarda o arquivo PDF de forma segura (só MASTER consegue acessar esse arquivo depois).
2. Envia o conteúdo do PDF para um serviço de Inteligência Artificial (Google Gemini), que
   lê e extrai automaticamente, de cada linha da fatura: o número de telefone, o valor
   cobrado e a data.
3. O sistema tenta casar cada número extraído com uma linha telefônica já cadastrada. Se
   um número da fatura não corresponder a nenhuma linha cadastrada, o valor não é
   descartado — ele fica registrado mesmo assim, marcado para revisão manual depois.
4. O resultado (quantas linhas foram lidas, quantas foram reconhecidas, se deu erro) fica
   visível na aba "Faturas", e os valores entram automaticamente no gráfico de custo do
   Dashboard.

## 5. Regras de negócio explicadas em linguagem simples

Estas são as regras "de verdade" do sistema — coisas que ele garante sozinho, mesmo que
alguém tente ir por fora da tela normal (por exemplo, mexendo direto no banco de dados).
Isso é proposital: a segurança e a integridade dos dados não dependem de ninguém lembrar
de seguir um procedimento — o próprio sistema recusa a ação incorreta.

### 5.1 Nada é apagado de verdade ("exclusão suave")

Quando você "desativa" um notebook, um acessório, uma linha telefônica ou um colaborador,
o registro **não desaparece** do banco de dados — ele só fica marcado como inativo e some
das listas do dia a dia. Isso existe por dois motivos: primeiro, pra nunca perder
histórico (se um notebook foi usado por 5 pessoas ao longo de 3 anos, você continua
conseguindo consultar isso mesmo depois de o notebook sair de uso); segundo, porque um
erro de "desativar" é sempre reversível — dá pra reativar. Uma exclusão de verdade
(apagar sem volta) simplesmente não é uma opção disponível para nenhum desses cadastros.

A única exceção é a exclusão de uma **conta de usuário com login** (não confundir com
"colaborador" — ver seção 5.5), que é uma ação real e sem volta, disponível só para
MASTER, com confirmação explícita na tela.

### 5.2 Atribuir e desvincular sempre gera histórico

Toda vez que um equipamento é atribuído a alguém ou devolvido, o sistema registra
automaticamente essa movimentação (quem estava com o equipamento antes, para quem foi, em
que data). Essas duas coisas — mudar o responsável do equipamento e gravar o histórico —
acontecem sempre juntas, como uma coisa só: nunca é possível o sistema mudar o
responsável sem deixar rastro, nem gravar um rastro sem realmente mudar o responsável.

### 5.3 Ciclo de vida do notebook (vida útil de 4 anos)

O sistema considera que um notebook tem 4 anos de vida útil recomendada, contados a
partir da data de aquisição. Com base só nessa data, ele calcula automaticamente um destes
três status:

- **Dentro da vida útil** — ainda falta bastante tempo para o prazo de troca.
- **Atenção para troca** — o prazo de troca vence dentro dos próximos 2 meses.
- **Troca vencida** — o prazo de troca já passou.

Esse status nunca é digitado manualmente por ninguém — é sempre recalculado na hora,
comparando a data de compra com a data de hoje. Isso evita o problema que existia na
planilha antiga, em que esse tipo de informação era preenchida à mão e ficava
desatualizada.

### 5.4 Desativar um colaborador libera os equipamentos dele — mas não apaga o histórico

Quando um colaborador é desativado (por exemplo, porque saiu da empresa), todos os
notebooks e acessórios que estavam com ele voltam automaticamente para "disponível", para
que outra pessoa possa recebê-los. Só que o sistema **não apaga** a informação de que
aquele colaborador foi o último responsável — essa informação continua disponível para
consulta futura. Só o status do equipamento muda (de "em uso" para "disponível"); o
vínculo histórico permanece.

### 5.5 Colaborador e usuário do sistema são coisas diferentes

Um **colaborador** é qualquer pessoa (ou até um recurso compartilhado, como uma sala de
reunião ou um estoque) que pode ser responsável por um equipamento. Um **usuário do
sistema** é uma conta com login e senha que pode entrar e usar o sistema. As duas coisas
são propositalmente separadas: um colaborador pode nunca precisar logar no sistema, e uma
pessoa que loga no sistema (por exemplo, alguém do time de TI) pode nunca ser responsável
por nenhum notebook. Por isso existem dois cadastros diferentes ("Colaboradores" e a
gestão de usuários em "Solicitações de acesso"), e eles não precisam estar sincronizados
um com o outro.

### 5.6 Todo mundo aprovado consegue ver; só ADMIN/MASTER conseguem mudar

Qualquer pessoa com conta aprovada (mesmo um USER comum) consegue **ver** todas as listas
de notebooks, acessórios, linhas telefônicas e colaboradores — essa parte é sempre aberta
para todo mundo, para que qualquer pessoa da empresa consiga consultar rapidamente quem
está com qual equipamento. Só ADMIN e MASTER conseguem **alterar** algo. Essa separação
entre "quem pode ver" e "quem pode editar" é uma regra fixa, igual em todas as telas de
equipamento.

## 6. Identidade visual

O sistema usa a identidade "KM": um símbolo em estilo circuito nas cores ciano/azul, com
duas variações — uma para fundo escuro (mais brilhante, usada no tema escuro) e uma para
fundo claro (mais sólida, usada no tema claro). É possível alternar entre **tema escuro**
(padrão) e **tema claro** a qualquer momento, pelo botão no cabeçalho — essa escolha fica
salva no navegador da pessoa, então da próxima vez que ela abrir o sistema, o tema
preferido já vem selecionado.

## 7. Segurança, em termos simples

- As regras de quem pode ver e quem pode editar cada informação estão garantidas dentro
  do próprio banco de dados, não só nas telas — ou seja, mesmo que alguém tentasse acessar
  os dados por fora do sistema (por exemplo, direto por uma ferramenta técnica), essas
  mesmas regras de permissão continuariam valendo.
- Senhas nunca ficam visíveis para ninguém, nem para o time que mantém o sistema — nem
  no cadastro, nem na auditoria, nem em nenhum relatório.
- Ações sensíveis (aprovar usuário, mudar papel, excluir conta, resetar senha, ler uma
  fatura por IA) ficam registradas na Auditoria, incluindo quem fez e quando.
- O arquivo PDF de cada fatura de telefonia enviada fica guardado num espaço restrito,
  acessível só para usuários MASTER.

Detalhes técnicos de como as credenciais do sistema são guardadas e trocadas estão no
documento técnico [credenciais-e-seguranca.md](credenciais-e-seguranca.md) — esse nível de
detalhe não é necessário para o uso do dia a dia do sistema.

## 8. Pequeno glossário (termos técnicos traduzidos)

| Termo que você pode ouvir | O que significa, na prática |
|---|---|
| Soft delete / exclusão suave | "Desativar" em vez de apagar de verdade — ver seção 5.1. |
| RLS (Row Level Security) | O mecanismo, dentro do banco de dados, que garante quem pode ver/editar cada informação — a "trava de segurança" que funciona mesmo por fora das telas do sistema. |
| RPC / função | Uma "ação pronta" dentro do banco de dados que executa uma tarefa completa de uma vez só (por exemplo, "atribuir notebook" sempre muda o responsável E grava o histórico juntos, nunca um sem o outro). |
| Trigger (gatilho) | Uma ação automática que o banco de dados dispara sozinho quando algo acontece (por exemplo: toda vez que um usuário se cadastra, o sistema cria automaticamente o perfil dele). |
| Edge Function | Um "servidor" que executa uma tarefa específica que precisa de mais privilégio ou de se comunicar com outro serviço (como criar uma conta de usuário, ou mandar uma fatura para a Inteligência Artificial ler). |
| Auditoria | O histórico completo e definitivo de tudo que já aconteceu no sistema (ver seção 4.4). |
| MASTER / ADMIN / USER | Os três níveis de permissão de quem usa o sistema — ver seção 2. |

## 9. Para saber mais

Este documento explica **o que** o sistema faz e **por quê**, em linguagem simples. Para
quem precisa dos detalhes técnicos exatos (nomes de tabelas e colunas, código, regras
escritas em SQL, arquitetura do software), a documentação técnica completa está na pasta
`docs/` do projeto, com destaque para:

- `banco-de-dados.md` e `mapeamento-banco-de-dados.md` — estrutura técnica do banco de
  dados.
- `arquitetura.md` — como o programa (frontend) é organizado.
- `design-system.md` — identidade visual em detalhe técnico (cores, tipografia).
- `credenciais-e-seguranca.md` — onde ficam guardadas as credenciais do sistema.
- `especificacao-tecnica-ia.md` — uma especificação técnica completa e consolidada,
  escrita especificamente para ser usada como material de referência por uma
  Inteligência Artificial em caso de manutenção futura ou necessidade de recriar o
  sistema do zero.
