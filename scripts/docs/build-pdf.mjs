// Gera uma versão em PDF de cada documento em docs/ + README.md, saída em docs/pdf/.
// Usa marked para markdown -> HTML e o Microsoft Edge (já instalado no Windows) em modo
// headless para HTML -> PDF, sem precisar de nenhum serviço externo ou dependência pesada
// (puppeteer/chromium) só para esta tarefa pontual.
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'pdf');
const TMP_DIR = path.join(ROOT, 'scripts', 'docs', '.tmp-html');

const DOCS = [
  { src: 'README.md', title: 'KM · Controle de Equipamentos — Visão geral' },
  { src: 'docs/arquitetura.md', title: 'Arquitetura do frontend' },
  { src: 'docs/banco-de-dados.md', title: 'Banco de dados' },
  { src: 'docs/mapeamento-banco-de-dados.md', title: 'Mapeamento do banco de dados e relacionamentos' },
  { src: 'docs/design-system.md', title: 'Identidade visual e design system' },
  { src: 'docs/credenciais-e-seguranca.md', title: 'Credenciais e segurança' },
];

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

function findEdge() {
  for (const p of EDGE_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('Microsoft Edge não encontrado nos caminhos padrão do Windows.');
}

// Se já existe uma janela do Edge aberta, uma nova chamada de linha de comando é
// repassada pra essa instância (mecanismo de instância única do Chromium) e o processo
// novo encerra na hora, sem gerar PDF nenhum — mesmo passando --user-data-dir próprio.
// Falha melhor aqui do que deixar cada arquivo sair vazio silenciosamente.
function assertEdgeIsClosed() {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq msedge.exe'], { encoding: 'utf8' });
  if (/msedge\.exe/i.test(out)) {
    throw new Error(
      'O Microsoft Edge está aberto. Feche todas as janelas do Edge e rode este script de novo\n' +
      '(o modo headless usado aqui não funciona de forma confiável com o Edge já em execução).'
    );
  }
}

// Links entre documentos apontam para .md (bom no GitHub); nos PDFs, reescrevemos pra
// apontar para o .pdf irmão gerado nesta mesma pasta, assim a navegação clicável continua
// funcionando dentro do conjunto de PDFs.
function rewriteCrossDocLinks(html) {
  return html.replace(/href="((?:\.\.\/)?(?:docs\/)?[\w-]+)\.md(#[\w-]+)?"/g, 'href="$1.pdf$2"');
}

const CSS = `
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Calibri, Arial, sans-serif;
    color: #1a1f2b;
    line-height: 1.55;
    font-size: 11.5pt;
  }
  h1, h2, h3, h4 { color: #0b2540; font-weight: 700; page-break-after: avoid; }
  h1 { font-size: 22pt; border-bottom: 3px solid #006bb7; padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 16pt; border-bottom: 1px solid #d7dee6; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 13pt; margin-top: 20px; }
  h4 { font-size: 11.5pt; margin-top: 16px; }
  a { color: #006bb7; text-decoration: none; }
  p, li { orphans: 3; widows: 3; }
  code {
    font-family: 'Cascadia Code', Consolas, 'Courier New', monospace;
    background: #f0f3f7;
    border: 1px solid #dfe6ee;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 0.92em;
  }
  pre {
    background: #0b2540;
    color: #e8f0fa;
    border-radius: 8px;
    padding: 14px 16px;
    overflow-x: auto;
    page-break-inside: avoid;
  }
  pre code { background: none; border: none; color: inherit; padding: 0; font-size: 9.5pt; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; page-break-inside: avoid; }
  th, td { border: 1px solid #d7dee6; padding: 6px 9px; text-align: left; vertical-align: top; font-size: 9.8pt; }
  th { background: #eaf2f9; color: #0b2540; }
  tr:nth-child(even) td { background: #f7f9fb; }
  blockquote {
    margin: 14px 0; padding: 8px 16px; border-left: 4px solid #006bb7;
    background: #eef5fb; color: #33465c;
  }
  hr { border: none; border-top: 1px solid #d7dee6; margin: 24px 0; }
  .km-cover { color: #5a6b7d; font-size: 10pt; margin: -6px 0 6px; }
`;

function buildHtml(title, bodyHtml) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${title}</title><style>${CSS}</style></head>
<body>${bodyHtml}</body></html>`;
}

// A pasta do projeto vive dentro do OneDrive: o agente de sincronização às vezes segura
// o handle do arquivo por uma fração de segundo depois que o Edge encerra, então o
// arquivo pode não estar visível no primeiro existsSync mesmo já tendo sido escrito.
async function waitForFile(filePath, { attempts = 60, delayMs = 250 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (existsSync(filePath) && statSync(filePath).size > 0) return true;
    await sleep(delayMs);
  }
  return false;
}

async function main() {
  const edge = findEdge();
  assertEdgeIsClosed();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  for (const doc of DOCS) {
    const srcPath = path.join(ROOT, doc.src);
    const md = readFileSync(srcPath, 'utf8');
    let html = marked.parse(md, { gfm: true });
    html = rewriteCrossDocLinks(html);
    const fullHtml = buildHtml(doc.title, html);

    const base = path.basename(doc.src, '.md');
    const htmlPath = path.join(TMP_DIR, `${base}.html`);
    const pdfPath = path.join(OUT_DIR, `${base}.pdf`);
    // Cada perfil de usuário fica numa pasta isolada e descartável: execuções
    // sequenciais do Edge headless competindo pelo mesmo user-data-dir faziam a
    // instância seguinte só repassar a requisição pra uma instância já aberta e
    // encerrar sem esperar o PDF terminar de ser escrito.
    const profileDir = path.join(TMP_DIR, `profile-${base}`);
    if (existsSync(pdfPath)) rmSync(pdfPath, { force: true });
    writeFileSync(htmlPath, fullHtml, 'utf8');

    execFileSync(edge, [
      '--headless=new',
      '--disable-gpu',
      `--user-data-dir=${profileDir}`,
      '--no-pdf-header-footer',
      `--print-to-pdf=${pdfPath}`,
      // Caminhos com espaços (ex.: pastas do OneDrive) precisam de percent-encoding
      // numa URL file:// de verdade — uma concatenação manual de string faz o Edge
      // truncar a URL no primeiro espaço e sair sem erro nem PDF nenhum.
      pathToFileURL(htmlPath).href,
    ], { stdio: 'inherit' });

    if (!(await waitForFile(pdfPath))) {
      throw new Error(`Falha ao gerar ${pdfPath} (arquivo ausente ou vazio).`);
    }

    console.log(`OK  ${doc.src} -> docs/pdf/${base}.pdf`);
  }

  rmSync(TMP_DIR, { recursive: true, force: true });
}

main();
