import { EmployeeRegistry } from './employee-registry.mjs'
import {
  normalizeLocation,
  normalizeDepartment,
  normalizeCategoryOrCarrier,
  parsePersonField,
  normalizePhoneNumber,
  trimOrNull,
  excelDateToISO,
} from './normalize.mjs'

const NOTEBOOK_STATUS_MAP = { Atribuido: 'ASSIGNED', Disponivel: 'AVAILABLE', Quebrado: 'BROKEN' }
const ACCESSORY_STATUS_MAP = {
  Atribuido: 'ASSIGNED',
  Atribuidos: 'ASSIGNED',
  Disponivel: 'AVAILABLE',
  Quebrado: 'BROKEN',
  Baixa: 'DECOMMISSIONED',
}
const PHONE_STATUS_MAP = { Atribuido: 'ASSIGNED', Disponivel: 'AVAILABLE', Suspensa: 'SUSPENDED', Cancelada: 'CANCELLED' }

// A aba Linhas de telefone usa "Estado" para UF, não para condição do ativo — mapeamos
// a sigla para o nome completo antes de normalizar como localidade.
const UF_TO_LOCATION_NAME = { SP: 'São Paulo', RS: 'Rio Grande do Sul', MG: 'Minas Gerais', MT: 'Mato Grosso' }
function mapUfToLocationName(uf) {
  const trimmed = String(uf ?? '').trim().toUpperCase()
  return UF_TO_LOCATION_NAME[trimmed] ?? trimmed
}

function resolvePersonOrHolder(registry, raw, department, location, sourceSheet, sourceRow) {
  const parsed = parsePersonField(raw)
  if (parsed.kind === 'empty') return { employeeTempId: null, notes: null, review: null }
  if (parsed.kind === 'shared_holder') {
    const { employee } = registry.resolveSharedHolder(parsed.label, sourceSheet, sourceRow)
    return { employeeTempId: employee.tempId, notes: null, review: null }
  }
  const resolution = registry.resolvePerson(parsed, department, location, sourceSheet, sourceRow)
  return {
    employeeTempId: resolution.employee?.tempId ?? null,
    notes: resolution.notes ?? null,
    review: resolution.reviewRequired
      ? { field: 'Asignado a / Usuário', value: raw, type: 'REVIEW_REQUIRED', description: resolution.reason }
      : null,
  }
}

/**
 * Marca duplicidades de uma chave (patrimônio, serial, número de linha) como bloqueantes:
 * TODOS os registros do grupo duplicado vão para review, nenhum é carregado — não
 * escolhemos arbitrariamente qual dos dois é "o correto" (item 7/12 do briefing).
 */
function partitionByUniqueKey(records, keyFn, fieldLabel, reviewLog) {
  const groups = new Map()
  for (const record of records) {
    const key = keyFn(record)
    if (key == null) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }

  const duplicateRecordIds = new Set()
  for (const [key, group] of groups) {
    if (group.length > 1) {
      for (const record of group) {
        duplicateRecordIds.add(record)
        reviewLog.push({
          sheet: record.sourceSheet,
          row: record.sourceRow,
          field: fieldLabel,
          value: key,
          type: 'DUPLICATE',
          description: `${fieldLabel} "${key}" duplicado em ${group.length} registros (linhas: ${group
            .map((r) => r.sourceRow)
            .join(', ')})`,
          suggestion: 'Revisar manualmente qual registro está correto antes de carregar qualquer um dos dois',
        })
      }
    }
  }

  return {
    ready: records.filter((r) => !duplicateRecordIds.has(r) && !r.blockingReview),
    review: records.filter((r) => duplicateRecordIds.has(r) || r.blockingReview),
  }
}

export function transform(extracted) {
  const registry = new EmployeeRegistry()
  const reviewLog = []
  const departments = new Set()
  const locations = new Set()
  const categories = new Set()
  const carriers = new Set()

  // ==========================================================================
  // 1) Linhas de telefone primeiro — fonte mais rica de identidade (nome+username+e-mail),
  //    usada para semear o registro de colaboradores antes de processar as outras abas.
  // ==========================================================================
  const phoneCandidates = []
  for (const row of extracted.LinhasTelefone.rows) {
    const sourceSheet = row.__sourceSheet
    const sourceRow = row.__sourceRow

    const carrier = normalizeCategoryOrCarrier(row['Operadora'])
    if (carrier) carriers.add(carrier)

    const department = normalizeDepartment(row['Departamento'])
    if (department) departments.add(department)

    const locResult = normalizeLocation(mapUfToLocationName(row['Estado']))
    if (locResult.value) locations.add(locResult.value)
    if (locResult.reviewRequired) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Estado', value: row['Estado'],
        type: 'REVIEW_REQUIRED', description: locResult.reason, suggestion: 'Confirmar UF/localidade',
      })
    }

    const parsedPerson = parsePersonField(row['Usuário'])
    const email = trimOrNull(row['E-mail'])
    let employeeTempId = null
    let personNotes = null
    if (parsedPerson.kind === 'shared_holder') {
      employeeTempId = registry.resolveSharedHolder(parsedPerson.label, sourceSheet, sourceRow).employee.tempId
    } else {
      const name = parsedPerson.name ?? String(row['Usuário']).trim()
      const { employee } = registry.resolveWithEmail(
        { name, username: parsedPerson.username ?? null, email, department, location: locResult.value },
        sourceSheet, sourceRow,
      )
      employeeTempId = employee.tempId
      personNotes = parsedPerson.notes ?? null
    }

    if (email && !email.toLowerCase().endsWith('@biondagro.com')) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'E-mail', value: email,
        type: 'REVIEW_REQUIRED', description: 'Domínio de e-mail fora de @biondagro.com',
        suggestion: 'Confirmar se é colaborador legítimo antes de tratar como employee padrão',
      })
    }

    const status = PHONE_STATUS_MAP[String(row['Status']).trim()] ?? null
    if (!status) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Status', value: row['Status'],
        type: 'REVIEW_REQUIRED', description: `Status de linha não reconhecido: "${row['Status']}"`,
        suggestion: 'Confirmar valor de status',
      })
    }

    const phoneResult = normalizePhoneNumber(row['Linha'], String(row['Estado'] ?? '').trim() || null)
    let blockingReview = false
    if (phoneResult.reviewRequired) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Linha', value: row['Linha'],
        type: 'IMPORT_ERROR', description: phoneResult.reason,
        suggestion: 'Solicitar o número real ao responsável; não converter arbitrariamente',
      })
      blockingReview = true
    } else if (phoneResult.dddMismatch) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Linha/Estado', value: `${row['Linha']} / ${row['Estado']}`,
        type: 'WARNING', description: phoneResult.dddMismatchNote,
        suggestion: 'Não corrigir automaticamente — apenas documentar',
      })
    }

    phoneCandidates.push({
      sourceSheet, sourceRow, blockingReview,
      number: phoneResult.e164,
      carrier,
      employeeTempId,
      department,
      location: locResult.value,
      status: status ?? 'ASSIGNED',
      notes: personNotes,
    })
  }

  const phonePartition = partitionByUniqueKey(
    phoneCandidates.filter((c) => c.number != null || c.blockingReview),
    (r) => r.number,
    'Linha (número)',
    reviewLog,
  )

  // ==========================================================================
  // 2) Laptop
  // ==========================================================================
  const notebookCandidates = []
  for (const row of extracted.Laptop.rows) {
    const sourceSheet = row.__sourceSheet
    const sourceRow = row.__sourceRow

    const department = normalizeDepartment(row['Departamento'])
    if (department) departments.add(department)

    const locResult = normalizeLocation(row['Localización'])
    if (locResult.value) locations.add(locResult.value)
    if (locResult.reviewRequired) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Localización', value: row['Localización'],
        type: 'REVIEW_REQUIRED', description: locResult.reason, suggestion: 'Confirmar localidade',
      })
    }

    const rawStatus = String(row['Estado']).trim()
    const status = NOTEBOOK_STATUS_MAP[rawStatus] ?? null
    if (!status) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Estado', value: rawStatus,
        type: 'REVIEW_REQUIRED', description: `Status de notebook não reconhecido: "${rawStatus}"`,
        suggestion: 'Confirmar valor de status',
      })
    }

    const assignedRaw = row['Asignado a']
    const { employeeTempId, notes: personNotes, review: personReview } = resolvePersonOrHolder(
      registry, assignedRaw, department, locResult.value, sourceSheet, sourceRow,
    )
    if (personReview) reviewLog.push({ sheet: sourceSheet, row: sourceRow, ...personReview })

    // Regra de negócio: só existe responsável ativo quando o status é ASSIGNED. Se o
    // Excel diz "Disponivel" mas ainda tem um nome no campo, é atribuição histórica não
    // limpa (achado do diagnóstico) — carregamos o notebook sem employee_id e preservamos
    // o texto original em notes, sinalizando para revisão em vez de bloquear a carga.
    let finalEmployeeTempId = employeeTempId
    let notesParts = []
    if (personNotes) notesParts.push(personNotes)
    if (status !== 'ASSIGNED' && employeeTempId) {
      finalEmployeeTempId = null
      notesParts.push(`Responsável anterior na planilha (status=${rawStatus}): ${assignedRaw}`)
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Estado/Asignado a',
        value: `${rawStatus} / ${assignedRaw}`, type: 'WARNING',
        description: 'Notebook com status não-ASSIGNED mas com responsável preenchido na planilha',
        suggestion: 'Confirmar se o vínculo deve ser removido (mantido como histórico em notes) ou se o status está desatualizado',
      })
    }
    if (row['Destino da máquina']) notesParts.push(String(row['Destino da máquina']).trim())

    const garantiaFim = excelDateToISO(row['Garantia'])
    const statusGarantiaRaw = String(row['Status de Garantia']).trim()
    if (garantiaFim) {
      const expired = new Date(garantiaFim) < new Date()
      const coherent = (expired && statusGarantiaRaw === 'Não') || (!expired && statusGarantiaRaw === 'Sim')
      if (!coherent) {
        reviewLog.push({
          sheet: sourceSheet, row: sourceRow, field: 'Garantia / Status de Garantia',
          value: `${garantiaFim} / ${statusGarantiaRaw}`, type: 'WARNING',
          description: 'Status de Garantia (Sim/Não) incoerente com a data de fim de garantia',
          suggestion: 'garantia_fim (data) é a fonte de verdade adotada; o campo Sim/Não original não foi migrado',
        })
      }
    } else if (statusGarantiaRaw === 'Sim') {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Status de Garantia', value: statusGarantiaRaw,
        type: 'WARNING', description: 'Status de Garantia = Sim sem nenhuma data de garantia para sustentar',
        suggestion: 'garantia_fim ficará NULL para este registro',
      })
    }

    const patrimonio = trimOrNull(row['Etiqueta']) ?? trimOrNull(row['Equipo'])
    const serial = trimOrNull(row['N. Serie'])

    notebookCandidates.push({
      sourceSheet, sourceRow, blockingReview: false,
      patrimonio,
      serialNumber: serial,
      modelo: trimOrNull(row['Modelo']),
      categoria: trimOrNull(row['Categoría']) ?? 'Notebook',
      dataAquisicao: excelDateToISO(row['Data de aquisição']),
      garantiaFim,
      status: status ?? 'AVAILABLE',
      employeeTempId: finalEmployeeTempId,
      location: locResult.value,
      notes: notesParts.length ? notesParts.join(' | ') : null,
    })
  }

  const notebooksByPatrimonio = partitionByUniqueKey(notebookCandidates, (r) => r.patrimonio, 'Patrimônio', reviewLog)
  // Uma segunda passada por serial, só dentro do conjunto que já passou pelo patrimônio,
  // para não reportar a mesma linha duas vezes quando o patrimônio já a bloqueou.
  const notebookPartition = partitionByUniqueKey(notebooksByPatrimonio.ready, (r) => r.serialNumber, 'N. Série', reviewLog)
  notebookPartition.review.push(...notebooksByPatrimonio.review)

  // ==========================================================================
  // 3) Acessórios
  // ==========================================================================
  const accessoryCandidates = []
  for (const row of extracted.Acessorios.rows) {
    const sourceSheet = row.__sourceSheet
    const sourceRow = row.__sourceRow

    const category = normalizeCategoryOrCarrier(row['Categoría'])
    if (category) categories.add(category)

    const locResult = normalizeLocation(row['Localización'])
    if (locResult.value) locations.add(locResult.value)
    if (locResult.reviewRequired) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Localización', value: row['Localización'],
        type: 'REVIEW_REQUIRED', description: locResult.reason, suggestion: 'Confirmar localidade',
      })
    }

    const rawStatus = String(row['Estado']).trim()
    const status = ACCESSORY_STATUS_MAP[rawStatus] ?? null
    if (!status) {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Estado', value: rawStatus,
        type: 'REVIEW_REQUIRED', description: `Status de acessório não reconhecido: "${rawStatus}"`,
        suggestion: 'Confirmar valor de status',
      })
    }

    const assignedRaw = row['Asignado a']
    const { employeeTempId, notes: personNotes, review: personReview } = resolvePersonOrHolder(
      registry, assignedRaw, null, locResult.value, sourceSheet, sourceRow,
    )
    if (personReview) reviewLog.push({ sheet: sourceSheet, row: sourceRow, ...personReview })

    let finalEmployeeTempId = employeeTempId
    let notesParts = []
    if (personNotes) notesParts.push(personNotes)
    if (status !== 'ASSIGNED' && employeeTempId) {
      finalEmployeeTempId = null
      notesParts.push(`Responsável anterior na planilha (status=${rawStatus}): ${assignedRaw}`)
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'Estado/Asignado a',
        value: `${rawStatus} / ${assignedRaw}`, type: 'WARNING',
        description: 'Acessório com status não-ASSIGNED mas com responsável preenchido na planilha',
        suggestion: 'Confirmar se o vínculo deve ser removido (mantido como histórico em notes) ou se o status está desatualizado',
      })
    }

    let serial = trimOrNull(row['N. Serie'])
    if (serial && serial.toLowerCase() === 'null') {
      reviewLog.push({
        sheet: sourceSheet, row: sourceRow, field: 'N. Serie', value: row['N. Serie'],
        type: 'WARNING', description: 'Valor literal "null" (texto) normalizado para NULL real',
        suggestion: 'Nenhuma ação necessária — apenas registro da normalização',
      })
      serial = null
    }

    const patrimonio = trimOrNull(row['Etiqueta']) ?? trimOrNull(row['Equipo'])

    accessoryCandidates.push({
      sourceSheet, sourceRow, blockingReview: false,
      patrimonio,
      serialNumber: serial,
      modelo: trimOrNull(row['Modelo']),
      category,
      status: status ?? 'AVAILABLE',
      employeeTempId: finalEmployeeTempId,
      location: locResult.value,
      notes: notesParts.length ? notesParts.join(' | ') : null,
    })
  }

  const accessoryPartition = partitionByUniqueKey(
    accessoryCandidates,
    (r) => r.serialNumber, // patrimônio não é chave confiável em acessórios (maioria vazio)
    'N. Série',
    reviewLog,
  )

  return {
    employees: registry.employees,
    departments: [...departments],
    locations: [...locations],
    categories: [...categories],
    carriers: [...carriers],
    notebooks: notebookPartition,
    accessories: accessoryPartition,
    phoneLines: phonePartition,
    reviewLog,
  }
}
