// Regras de normalização determinística validadas contra os dados reais da planilha
// (ver diagnóstico da Fase 1-3). Nada aqui funde valores semanticamente diferentes —
// só corrige variação de grafia/capitalização do MESMO valor.

const KNOWN_LOCATIONS = ['São Paulo', 'Rio Grande do Sul', 'Minas Gerais', 'Mato Grosso']
const LOCATION_BY_KEY = new Map(KNOWN_LOCATIONS.map((name) => [name.toLowerCase(), name]))

export function normalizeLocation(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { value: null, reviewRequired: false }
  const canonical = LOCATION_BY_KEY.get(trimmed.toLowerCase())
  if (canonical) return { value: canonical, reviewRequired: false }
  // Localidade fora da lista confirmada na planilha de origem: não inventamos valor.
  return { value: trimmed, reviewRequired: true, reason: `Localidade desconhecida: "${trimmed}"` }
}

// Departamentos só são deduplicados quando a diferença é PURAMENTE de grafia/espaço.
// Nomes lexicalmente diferentes ("RH" vs "Recursos Humanos") NÃO são fundidos aqui —
// ficam como departamentos distintos até decisão humana (ver relatório de migração).
const departmentCanonicalByKey = new Map()
export function normalizeDepartment(raw) {
  const trimmed = String(raw ?? '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  const key = trimmed.toLowerCase()
  if (!departmentCanonicalByKey.has(key)) {
    departmentCanonicalByKey.set(key, trimmed)
  }
  return departmentCanonicalByKey.get(key)
}

export function normalizeCategoryOrCarrier(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ') || null
}

// Responsáveis não-humanos encontrados na planilha (item 22 do briefing): nunca tratados
// como colaborador comum — entram como employees com is_shared_asset_holder = true.
const NON_HUMAN_HOLDERS = new Set(['escritório', 'escritorio', 'bloomberg', 'automações - biond', 'automacoes - biond'])

const PERSON_PATTERN = /^(?<name>.+?)\s*\((?<username>[a-zA-Z0-9_.\-]+)\)\s*(?<rest>.*)$/

/**
 * Interpreta o campo "Asignado a" / "Usuário" da planilha.
 * Retorna um descritor que NUNCA inventa username/e-mail quando eles não existem —
 * casos ambíguos voltam com reviewRequired=true em vez de um palpite.
 */
export function parsePersonField(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { kind: 'empty' }

  const normalizedForLookup = trimmed.toLowerCase()
  if (NON_HUMAN_HOLDERS.has(normalizedForLookup)) {
    return { kind: 'shared_holder', label: trimmed }
  }

  const match = trimmed.match(PERSON_PATTERN)
  if (match) {
    const { name, username, rest } = match.groups
    return {
      kind: 'person',
      name: name.trim(),
      username: username.trim().toLowerCase(),
      notes: rest.trim() ? rest.trim().replace(/^[-–]\s*/, '') : null,
    }
  }

  // Sem username identificável (ex.: "Marco Antonio Ciriaco", "Fabio", "Antiga -  Jessica Aires").
  // Fica marcado para reconciliação por nome, com confiança reduzida.
  return { kind: 'person_no_username', name: trimmed }
}

// DDDs presentes na planilha de origem e a UF esperada — usado só para checagem cruzada
// e relato, nunca para "corrigir" o UF informado (podem legitimamente divergir).
const DDD_TO_UF = { 11: 'SP', 66: 'MT', 34: 'MG', 54: 'RS' }

/**
 * Converte um telefone brasileiro em formato livre para E.164.
 * Nunca inventa dígitos: se não for possível reconhecer DDD + número, retorna
 * reviewRequired=true e preserva o valor original intacto.
 */
export function normalizePhoneNumber(raw, ufHint) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { e164: null, reviewRequired: true, reason: 'Linha vazia' }

  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 11) {
    return {
      e164: null,
      reviewRequired: true,
      reason: `Valor não reconhecível como telefone brasileiro: "${trimmed}"`,
      raw: trimmed,
    }
  }

  const ddd = Number(digitsOnly.slice(0, 2))
  const e164 = `+55${digitsOnly}`
  const expectedUf = DDD_TO_UF[ddd]
  const dddMismatch = expectedUf && ufHint && expectedUf !== ufHint

  return {
    e164,
    reviewRequired: false,
    dddMismatch,
    dddMismatchNote: dddMismatch
      ? `DDD ${ddd} é tipicamente de ${expectedUf}, mas a planilha informa UF=${ufHint}`
      : null,
  }
}

export function trimOrNull(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

export function excelDateToISO(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return null
}
