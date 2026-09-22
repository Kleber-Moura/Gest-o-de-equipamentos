function countByType(reviewLog, sheetName) {
  const forSheet = reviewLog.filter((r) => r.sheet === sheetName)
  return {
    warning: forSheet.filter((r) => r.type === 'WARNING').length,
    reviewRequired: forSheet.filter((r) => r.type === 'REVIEW_REQUIRED').length,
    duplicate: forSheet.filter((r) => r.type === 'DUPLICATE').length,
    importError: forSheet.filter((r) => r.type === 'IMPORT_ERROR').length,
  }
}

function sheetSummaryRow(label, sheetName, totalRead, ready, review, reviewLog) {
  const counts = countByType(reviewLog, sheetName)
  return [
    label,
    totalRead,
    ready.length,
    counts.warning,
    counts.reviewRequired,
    counts.duplicate,
    counts.importError,
    ready.length,
    totalRead - ready.length,
  ]
}

export function buildReportMarkdown(extracted, result, generatedAtLabel) {
  const lines = []
  lines.push('# Relatório de migração — Infraestrutura BIOND')
  lines.push('')
  lines.push(`Gerado em: ${generatedAtLabel}`)
  lines.push('')
  lines.push('Fonte: `Infraestrutura de BIOND (2).xlsx` — abas Laptop, Acessórios, Linhas de telefone (únicas autorizadas).')
  lines.push('')

  lines.push('## Resumo por aba')
  lines.push('')
  lines.push('| Aba | Lido | Válido p/ carga | Warning | Review Required | Duplicado | Erro de importação | Importado | Não importado |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  lines.push(
    '| ' +
      sheetSummaryRow('Laptop', 'Laptop', extracted.Laptop.rows.length, result.notebooks.ready, result.notebooks.review, result.reviewLog).join(' | ') +
      ' |',
  )
  lines.push(
    '| ' +
      sheetSummaryRow('Acessórios', 'Acessórios', extracted.Acessorios.rows.length, result.accessories.ready, result.accessories.review, result.reviewLog).join(' | ') +
      ' |',
  )
  lines.push(
    '| ' +
      sheetSummaryRow('Linhas de telefone', 'Linhas de telefone', extracted.LinhasTelefone.rows.length, result.phoneLines.ready, result.phoneLines.review, result.reviewLog).join(' | ') +
      ' |',
  )
  lines.push('')
  // "Baixa confiança" é reavaliado pelo estado FINAL do registro (sem username/e-mail),
  // não pelo método usado na primeira vez que ele foi criado — um colaborador criado só
  // por nome pode ter sido enriquecido depois por outra aba (ex.: "Marco Antonio Ciriaco"
  // ganhou username ao ser visto em Acessórios após já existir a partir do Laptop).
  const lowConfidenceEmployees = result.employees.filter(
    (e) => !e.isSharedAssetHolder && !e.username && !e.email,
  )
  lines.push(
    `Total de colaboradores/detentores reconciliados: **${result.employees.length}** ` +
      `(${result.employees.filter((e) => e.isSharedAssetHolder).length} não-humanos, ` +
      `${lowConfidenceEmployees.length} de baixa confiança — sem username/e-mail: ${lowConfidenceEmployees
        .map((e) => e.name)
        .join(', ') || '—'}).`,
  )
  lines.push('')
  lines.push(`Departamentos distintos: ${result.departments.length} · Localidades: ${result.locations.length} · Categorias de acessório: ${result.categories.length} · Operadoras: ${result.carriers.length}`)
  lines.push('')

  lines.push('## Registros que exigem revisão')
  lines.push('')
  lines.push('| Aba | Linha origem | Campo | Valor | Tipo | Descrição | Sugestão |')
  lines.push('|---|---|---|---|---|---|---|')
  const severityOrder = { DUPLICATE: 0, IMPORT_ERROR: 1, REVIEW_REQUIRED: 2, WARNING: 3 }
  const sortedLog = [...result.reviewLog].sort((a, b) => severityOrder[a.type] - severityOrder[b.type])
  for (const entry of sortedLog) {
    lines.push(
      `| ${entry.sheet} | ${entry.row} | ${entry.field} | ${String(entry.value ?? '').replace(/\|/g, '\\|')} | ${entry.type} | ${entry.description.replace(/\|/g, '\\|')} | ${entry.suggestion ?? '—'} |`,
    )
  }
  lines.push('')

  lines.push('## Legenda dos tipos')
  lines.push('')
  lines.push('- **DUPLICATE** — bloqueante: chave (patrimônio/serial/número) repetida em mais de um registro; nenhum dos registros do grupo é carregado até revisão humana.')
  lines.push('- **IMPORT_ERROR** — bloqueante: valor estruturalmente inválido (ex.: telefone "O"); registro não carregado.')
  lines.push('- **REVIEW_REQUIRED** — não bloqueante: ambiguidade identificada (ex.: localidade desconhecida, colaborador sem username); registro é carregado, mas fica marcado para confirmação humana.')
  lines.push('- **WARNING** — não bloqueante: inconsistência documentada (ex.: incoerência Garantia/Status de Garantia, DDD×UF); registro carregado normalmente.')
  lines.push('')

  lines.push('## Estratégia de idempotência aplicada')
  lines.push('')
  lines.push('- `notebooks`: upsert por `serial_number`.')
  lines.push('- `accessories`: upsert por `serial_number` quando presente; sem serial, cada execução gera um novo candidato — reexecutar a importação para acessórios sem serial exige comparação manual antes do load real.')
  lines.push('- `phone_lines`: upsert por `number` (E.164).')
  lines.push('- `employees`: upsert por `username`, senão por `email`, senão por nome exato (baixa confiança, sinalizado no relatório).')
  lines.push('')

  return lines.join('\n')
}
