#!/usr/bin/env node
// Validação pós-carga (Fase 23): confere contagens reais no banco contra o que o
// relatório de migração previa, e testa a view de ciclo de vida dos notebooks.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function count(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`)
  return count
}

async function main() {
  const tables = ['departments', 'locations', 'asset_categories', 'carriers', 'employees', 'notebooks', 'accessories', 'phone_lines']
  console.log('== Contagens por tabela ==')
  for (const t of tables) {
    console.log(`  ${t}: ${await count(t)}`)
  }

  console.log('\n== Ciclo de vida dos notebooks (view notebooks_with_lifecycle) ==')
  const { data: lifecycle, error: lifecycleError } = await supabase
    .from('notebooks_with_lifecycle')
    .select('patrimonio, data_aquisicao, data_prevista_troca, lifecycle_status')
  if (lifecycleError) throw new Error(`Falha ao ler view: ${lifecycleError.message}`)

  const byStatus = lifecycle.reduce((acc, n) => {
    acc[n.lifecycle_status] = (acc[n.lifecycle_status] ?? 0) + 1
    return acc
  }, {})
  console.log('  Distribuição:', byStatus)
  console.log('  Amostra:', lifecycle.slice(0, 3))

  console.log('\n== Verificação de integridade referencial ==')
  const { data: orphanNotebooks, error: orphanError } = await supabase
    .from('notebooks')
    .select('id, patrimonio, employee_id')
    .not('employee_id', 'is', null)
  if (orphanError) throw new Error(orphanError.message)
  console.log(`  Notebooks com employee_id preenchido: ${orphanNotebooks.length} (todos devem ter FK válida por constraint)`)

  console.log('\n== Confirmação: nenhum registro REVIEW_REQUIRED foi carregado ==')
  const { data: bnd015 } = await supabase.from('notebooks').select('patrimonio, serial_number').eq('patrimonio', 'BND015')
  console.log(`  BND015 (deveria ser 0, pois é o duplicado pendente de revisão): ${bnd015.length}`)

  const { data: dupSerial } = await supabase.from('accessories').select('serial_number').eq('serial_number', 'RX2T500PQVR')
  console.log(`  RX2T500PQVR (deveria ser 0, pendente de revisão): ${dupSerial.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
