// Gera uma versão .docx (Word) de cada documento em docs/, a partir do Markdown.
// Usa o lexer do `marked` (árvore de tokens, sem renderizar HTML) + a biblioteca `docx`
// (gera .docx nativo, sem depender do Word/LibreOffice instalado na máquina).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ExternalHyperlink, AlignmentType,
} from 'docx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'docx');

const DOCS = [
  { src: 'docs/documentacao-funcional.md', title: 'Documentação Funcional — KM Controle de Equipamentos' },
  { src: 'docs/especificacao-tecnica-ia.md', title: 'Especificação Técnica Completa — KM Controle de Equipamentos' },
];

const COLOR = {
  heading: '0B2540',
  accent: '006BB7',
  text: '1A1F2B',
  muted: '5A6B7D',
  codeBg: 'F0F3F7',
  codeBlockBg: '0B2540',
  codeBlockText: 'E8F0FA',
  tableHeaderBg: 'EAF2F9',
  border: 'D7DEE6',
};

const FONT = 'Calibri';
const MONO = 'Consolas';

// ---- Inline tokens (dentro de parágrafo/heading/célula) -> TextRun[] ----
function inlineRuns(tokens, base = {}) {
  const runs = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'text':
        if (t.tokens) runs.push(...inlineRuns(t.tokens, base));
        else runs.push(new TextRun({ text: t.text, font: FONT, color: COLOR.text, ...base }));
        break;
      case 'strong':
        runs.push(...inlineRuns(t.tokens, { ...base, bold: true }));
        break;
      case 'em':
        runs.push(...inlineRuns(t.tokens, { ...base, italics: true }));
        break;
      case 'codespan':
        runs.push(new TextRun({
          text: t.text, font: MONO, size: 20, color: COLOR.accent,
          shading: { type: ShadingType.CLEAR, fill: COLOR.codeBg }, ...base,
        }));
        break;
      case 'link':
        runs.push(new ExternalHyperlink({
          link: t.href,
          children: [new TextRun({
            text: (t.tokens ?? []).map(tt => tt.text ?? '').join('') || t.text || t.href,
            font: FONT, color: COLOR.accent, underline: {}, ...base,
          })],
        }));
        break;
      case 'br':
        runs.push(new TextRun({ text: '', break: 1 }));
        break;
      default:
        if (t.text) runs.push(new TextRun({ text: t.text, font: FONT, color: COLOR.text, ...base }));
    }
  }
  return runs;
}

function heading(token) {
  const levels = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  return new Paragraph({
    heading: levels[Math.min(token.depth, levels.length - 1)],
    spacing: { before: 320, after: 160 },
    children: inlineRuns(token.tokens, { bold: true, color: COLOR.heading }),
  });
}

function paragraph(token) {
  return new Paragraph({ spacing: { after: 160 }, children: inlineRuns(token.tokens) });
}

function blockquote(token) {
  return (token.tokens ?? [])
    .filter(t => t.type === 'paragraph' || t.type === 'text')
    .map(t => new Paragraph({
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: COLOR.accent, space: 8 } },
      shading: { type: ShadingType.CLEAR, fill: 'EEF5FB' },
      spacing: { after: 120 },
      children: inlineRuns(t.tokens ?? [{ type: 'text', text: t.text }], { color: COLOR.muted, italics: true }),
    }));
}

function codeBlock(token) {
  const lines = token.text.split('\n');
  return new Paragraph({
    spacing: { after: 200 },
    shading: { type: ShadingType.CLEAR, fill: COLOR.codeBlockBg },
    border: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.codeBlockBg },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.codeBlockBg },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLOR.codeBlockBg },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLOR.codeBlockBg },
    },
    children: lines.flatMap((line, i) => [
      new TextRun({ text: line || ' ', font: MONO, size: 18, color: COLOR.codeBlockText }),
      ...(i < lines.length - 1 ? [new TextRun({ text: '', break: 1 })] : []),
    ]),
  });
}

function listBlock(token, depth = 0) {
  const out = [];
  token.items.forEach((item, i) => {
    const bullet = token.ordered ? `${(token.start || 1) + i}. ` : '• ';
    const itemTokens = item.tokens.filter(t => t.type !== 'list');
    const nested = item.tokens.filter(t => t.type === 'list');
    const runs = [];
    for (const t of itemTokens) {
      if (t.type === 'text') runs.push(...inlineRuns(t.tokens ?? [{ type: 'text', text: t.text }]));
      else if (t.type === 'paragraph') runs.push(...inlineRuns(t.tokens));
    }
    out.push(new Paragraph({
      indent: { left: 360 + depth * 360, hanging: 220 },
      spacing: { after: 80 },
      children: [new TextRun({ text: bullet, font: FONT, color: COLOR.text }), ...runs],
    }));
    for (const n of nested) out.push(...listBlock(n, depth + 1));
  });
  return out;
}

function tableBlock(token) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
    left: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
    right: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border },
  };
  const makeCell = (cell, isHeader) => new TableCell({
    borders,
    shading: isHeader ? { type: ShadingType.CLEAR, fill: COLOR.tableHeaderBg } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: inlineRuns(cell.tokens, isHeader ? { bold: true, color: COLOR.heading } : {}),
    })],
  });
  const headerRow = new TableRow({ tableHeader: true, children: token.header.map(c => makeCell(c, true)) });
  const rows = token.rows.map(r => new TableRow({ children: r.map(c => makeCell(c, false)) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] });
}

function tokensToDocxElements(tokens) {
  const out = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': out.push(heading(token)); break;
      case 'paragraph': out.push(paragraph(token)); break;
      case 'blockquote': out.push(...blockquote(token)); break;
      case 'code': out.push(codeBlock(token)); break;
      case 'list': out.push(...listBlock(token)); break;
      case 'table': out.push(tableBlock(token)); out.push(new Paragraph({ text: '' })); break;
      case 'hr': out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.border } }, spacing: { after: 200 } })); break;
      case 'space': break;
      default:
        if (token.tokens) out.push(...tokensToDocxElements(token.tokens));
    }
  }
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const doc of DOCS) {
    const md = readFileSync(path.join(ROOT, doc.src), 'utf8');
    const tokens = marked.lexer(md, { gfm: true });
    const body = tokensToDocxElements(tokens);

    const document = new Document({
      creator: 'KM Controle de Equipamentos',
      title: doc.title,
      styles: {
        default: {
          document: { run: { font: FONT, size: 23, color: COLOR.text } },
        },
      },
      sections: [{
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 300 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR.accent, space: 8 } },
            children: [new TextRun({ text: doc.title, bold: true, size: 40, font: FONT, color: COLOR.heading })],
          }),
          ...body,
        ],
      }],
    });

    const base = path.basename(doc.src, '.md');
    const outPath = path.join(OUT_DIR, `${base}.docx`);
    const buffer = await Packer.toBuffer(document);
    writeFileSync(outPath, buffer);
    console.log(`OK  ${doc.src} -> docs/docx/${base}.docx`);
  }
}

main();
