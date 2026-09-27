# Histórico de atualizações

## 27/09/2026

### Dashboard — Telefonia
- **Meses de janeiro a dezembro.** O gráfico de custo e o filtro de meses passaram do
  ano comercial (outubro→setembro) para o ano civil. O seletor agora mostra "Ano 2026",
  "Ano 2025"… e o título do gráfico virou "Custo por operadora — {ano}".
- **Cores novas e bem distintas por operadora:** Claro vermelho, Oi verde, TIM azul,
  Vivo roxo. Valem para o gráfico de custo, a rosca de contagem e os tiles de custo.
  Antes, Claro, Oi e TIM tinham tons de azul/verde-água parecidos.
- **Linhas do gráfico mais legíveis:** traço mais grosso, um ponto por mês e
  preenchimento mais leve para as áreas não se embolarem quando se cruzam.

### Filtros (todas as telas)
- **Corrigido:** a lista aberta dos filtros (`<select>`) aparecia com fundo branco e texto
  branco no tema escuro, e não dava para ler as opções. A regra global nova usa uma cor
  sólida do tema (`--option-bg`) e vale para os 36 selects do sistema, nos dois temas.

### Logo
- **Tema claro:** a sidebar usa a nova arte metálica `km-logo-light.png` (PNG com
  transparência real). No tema escuro continua a arte neon.
- **Login:** arte neon nos dois temas, com um contorno sutil no tema claro para o brilho
  não sumir no fundo branco.
- Removido o componente `KmMark.tsx` (monograma SVG antigo do tema claro), que ficou
  sem uso.

### Dados de demonstração
- Novo script `supabase/scripts/02_telefonia_simulada.sql`, para rodar no SQL Editor do
  Supabase depois do `01_dados_ficticios.sql`:
  - mais 10 linhas atribuídas, espalhadas entre as 4 operadoras (20 no total);
  - uma fatura por mês, de jan/2025 a set/2026, para cada linha atribuída ou suspensa,
    com variação por perfil de uso, sazonalidade, reajuste em 2026 e picos eventuais;
  - só mexe em números fictícios (`+55xx98765xxxx`) e em faturas sem upload; faturas
    reais enviadas pela tela de upload não são tocadas;
  - pode ser rodado de novo sem duplicar dados.

### Configuração em máquina nova
- Lembrete (sem mudança de código): depois de clonar o repositório, crie o
  `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (modelo em
  `.env.example`). Sem ele, a tela fica só com o fundo e o login não aparece.
