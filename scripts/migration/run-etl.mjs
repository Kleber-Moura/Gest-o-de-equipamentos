#!/usr/bin/env node
// Orquestra EXTRACT -> TRANSFORM -> VALIDATE -> REPORT.
// Não toca no Supabase — só lê a planilha local e escreve em data/processed e
// data/reports. O LOAD real (load.mjs) é um passo separado e deliberadamente manual.
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extractSheets } from './lib/extract.mjs'
import { transform } from './lib/transform.mjs'
import { buildReportMarkdown } from './lib/report.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const sourceDir = path.join(projectRoot, 'data', 'source')
const processedDir = path.join(projectRoot, 'data', 'processed')
const reportsDir = path.join(projectRoot, 'data', 'reports')

async function findSourceFile() {
  const files = await fs.readdir(sourceDir)
  const xlsx = files.find((f) => f.toLowerCase().endsWith('.xlsx'))
  if (!xlsx) throw new Error(`Nenhum .xlsx encontrado em ${sourceDir}`)
  return path.join(sourceDir, xlsx)
}

async function main() {
  const sourceFile = await findSourceFile()
  console.log(`Lendo planilha: ${sourceFile}`)

  const extracted = await extractSheets(sourceFile)
  console.log(
    `Extraído: Laptop=${extracted.Laptop.rows.length}, Acessórios=${extracted.Acessorios.rows.length}, ` +
      `Linhas de telefone=${extracted.LinhasTelefone.rows.length}`,
  )

  const result = transform(extracted)

  await fs.mkdir(processedDir, { recursive: true })
  await fs.mkdir(reportsDir, { recursive: true })

  await fs.writeFile(
    path.join(processedDir, 'employees.json'),
    JSON.stringify(result.employees, null, 2),
    'utf-8',
  )
  await fs.writeFile(
    path.join(processedDir, 'reference-data.json'),
    JSON.stringify(
      {
        departments: result.departments,
        locations: result.locations,
        categories: result.categories,
        carriers: result.carriers,
      },
      null,
      2,
    ),
    'utf-8',
  )
  await fs.writeFile(
    path.join(processedDir, 'notebooks.json'),
    JSON.stringify(result.notebooks, null, 2),
    'utf-8',
  )
  await fs.writeFile(
    path.join(processedDir, 'accessories.json'),
    JSON.stringify(result.accessories, null, 2),
    'utf-8',
  )
  await fs.writeFile(
    path.join(processedDir, 'phone-lines.json'),
    JSON.stringify(result.phoneLines, null, 2),
    'utf-8',
  )
  await fs.writeFile(
    path.join(processedDir, 'review-log.json'),
    JSON.stringify(result.reviewLog, null, 2),
    'utf-8',
  )

  const generatedAtLabel = new Date().toISOString()
  const markdown = buildReportMarkdown(extracted, result, generatedAtLabel)
  await fs.writeFile(path.join(reportsDir, 'migration_report.md'), markdown, 'utf-8')

  console.log('')
  console.log(`Notebooks:    ${result.notebooks.ready.length} prontos / ${result.notebooks.review.length} para revisão`)
  console.log(`Acessórios:   ${result.accessories.ready.length} prontos / ${result.accessories.review.length} para revisão`)
  console.log(`Linhas:       ${result.phoneLines.ready.length} prontas / ${result.phoneLines.review.length} para revisão`)
  console.log(`Colaboradores reconciliados: ${result.employees.length}`)
  console.log(`Entradas no log de revisão: ${result.reviewLog.length}`)
  console.log('')
  console.log(`Relatório: ${path.join(reportsDir, 'migration_report.md')}`)
  console.log(`Dados processados: ${processedDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
