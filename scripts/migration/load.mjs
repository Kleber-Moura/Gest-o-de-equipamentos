#!/usr/bin/env node
// LOAD — único script deste diretório que efetivamente escreve no Supabase.
// Não é chamado automaticamente por run-etl.mjs nem por nenhum outro script:
// precisa ser executado manualmente, depois de revisar data/reports/migration_report.md.
//
// Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (nunca no código).
// A Service Role Key tem privilégio total e bypassa RLS — por isso este script só
// deve rodar localmente/server-side, nunca dentro do bundle do frontend (item 33
// do briefing).
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migration/load.mjs
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const processedDir = path.join(projectRoot, 'data', 'processed')

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(processedDir, file), 'utf-8'))
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no ambiente. ' +
        'Este script não roda com valores hardcoded nem com a anon key.',
    )
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const referenceData = await readJson('reference-data.json')
  const employees = await readJson('employees.json')
  const notebooks = await readJson('notebooks.json')
  const accessories = await readJson('accessories.json')
  const phoneLines = await readJson('phone-lines.json')

  console.log('== Carregando tabelas de referência ==')
  const departmentIdByName = await upsertReferenceTable(supabase, 'departments', referenceData.departments)
  const locationIdByName = await upsertReferenceTable(supabase, 'locations', referenceData.locations)
  const categoryIdByName = await upsertReferenceTable(supabase, 'asset_categories', referenceData.categories)
  const carrierIdByName = await upsertReferenceTable(supabase, 'carriers', referenceData.carriers)

  console.log('== Carregando colaboradores ==')
  const employeeIdByTempId = await upsertEmployees(supabase, employees, departmentIdByName, locationIdByName)

  console.log('== Carregando notebooks ==')
  await upsertNotebooks(supabase, notebooks.ready, employeeIdByTempId, locationIdByName)

  console.log('== Carregando acessórios ==')
  await upsertAccessories(supabase, accessories.ready, employeeIdByTempId, locationIdByName, categoryIdByName)

  console.log('== Carregando linhas telefônicas ==')
  await upsertPhoneLines(supabase, phoneLines.ready, employeeIdByTempId, departmentIdByName, locationIdByName, carrierIdByName)

  console.log('')
  console.log('Carga concluída. Registros em REVIEW_REQUIRED/DUPLICATE/IMPORT_ERROR não foram carregados —')
  console.log('ver data/reports/migration_report.md para a lista completa.')
}

async function upsertReferenceTable(supabase, table, names) {
  const idByName = new Map()
  for (const name of names) {
    const { data, error } = await supabase
      .from(table)
      .upsert({ name }, { onConflict: 'name', ignoreDuplicates: false })
      .select('id, name')
      .single()
    if (error) throw new Error(`Falha ao upsertar ${table}."${name}": ${error.message}`)
    idByName.set(name, data.id)
  }
  console.log(`  ${table}: ${idByName.size} registros`)
  return idByName
}

async function upsertEmployees(supabase, employees, departmentIdByName, locationIdByName) {
  const idByTempId = new Map()
  for (const employee of employees) {
    const payload = {
      name: employee.name,
      username: employee.username,
      email: employee.email,
      department_id: employee.department ? departmentIdByName.get(employee.department) ?? null : null,
      location_id: employee.location ? locationIdByName.get(employee.location) ?? null : null,
      is_shared_asset_holder: employee.isSharedAssetHolder,
    }

    let id
    if (employee.username || employee.email) {
      // username/email têm UNIQUE no schema — upsert de verdade é seguro aqui.
      const conflictTarget = employee.username ? 'username' : 'email'
      const { data, error } = await supabase
        .from('employees')
        .upsert(payload, { onConflict: conflictTarget })
        .select('id')
        .single()
      if (error) throw new Error(`Falha ao upsertar employee "${employee.name}": ${error.message}`)
      id = data.id
    } else {
      // Sem username/email não existe UNIQUE em employees.name (nomes se repetem
      // legitimamente). Faz select-then-write em vez de upsert por ON CONFLICT
      // inexistente — reduz, mas não elimina, duplicidade em reexecuções. Esses são
      // exatamente os colaboradores já sinalizados como REVIEW_REQUIRED no relatório;
      // o ideal é resolver a ambiguidade manualmente antes de repetir o load.
      const { data: existing, error: selectError } = await supabase
        .from('employees')
        .select('id')
        .eq('name', employee.name)
        .is('username', null)
        .is('email', null)
        .maybeSingle()
      if (selectError) throw new Error(`Falha ao consultar employee "${employee.name}": ${selectError.message}`)

      if (existing) {
        const { error: updateError } = await supabase.from('employees').update(payload).eq('id', existing.id)
        if (updateError) throw new Error(`Falha ao atualizar employee "${employee.name}": ${updateError.message}`)
        id = existing.id
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('employees')
          .insert(payload)
          .select('id')
          .single()
        if (insertError) throw new Error(`Falha ao inserir employee "${employee.name}": ${insertError.message}`)
        id = inserted.id
      }
    }
    idByTempId.set(employee.tempId, id)
  }
  console.log(`  employees: ${idByTempId.size} registros`)
  return idByTempId
}

async function upsertNotebooks(supabase, readyNotebooks, employeeIdByTempId, locationIdByName) {
  let count = 0
  for (const n of readyNotebooks) {
    const payload = {
      patrimonio: n.patrimonio,
      serial_number: n.serialNumber,
      modelo: n.modelo,
      categoria: n.categoria,
      data_aquisicao: n.dataAquisicao,
      garantia_fim: n.garantiaFim,
      status: n.status,
      employee_id: n.employeeTempId ? employeeIdByTempId.get(n.employeeTempId) ?? null : null,
      location_id: locationIdByName.get(n.location) ?? null,
      notes: n.notes,
    }
    const { error } = await supabase.from('notebooks').upsert(payload, { onConflict: 'serial_number' })
    if (error) throw new Error(`Falha ao upsertar notebook "${n.patrimonio}": ${error.message}`)
    count++
  }
  console.log(`  notebooks: ${count} registros`)
}

async function upsertAccessories(supabase, readyAccessories, employeeIdByTempId, locationIdByName, categoryIdByName) {
  let count = 0
  for (const a of readyAccessories) {
    const payload = {
      patrimonio: a.patrimonio,
      serial_number: a.serialNumber,
      modelo: a.modelo,
      category_id: categoryIdByName.get(a.category) ?? null,
      status: a.status,
      employee_id: a.employeeTempId ? employeeIdByTempId.get(a.employeeTempId) ?? null : null,
      location_id: locationIdByName.get(a.location) ?? null,
      notes: a.notes,
    }
    if (a.serialNumber) {
      const { error } = await supabase.from('accessories').upsert(payload, { onConflict: 'serial_number' })
      if (error) throw new Error(`Falha ao upsertar acessório serial "${a.serialNumber}": ${error.message}`)
    } else {
      // Sem serial não há chave natural — insert simples (idempotência exige checagem
      // manual antes de reexecutar para acessórios sem serial, conforme relatório).
      const { error } = await supabase.from('accessories').insert(payload)
      if (error) throw new Error(`Falha ao inserir acessório sem serial (linha origem ${a.sourceRow}): ${error.message}`)
    }
    count++
  }
  console.log(`  accessories: ${count} registros`)
}

async function upsertPhoneLines(supabase, readyPhoneLines, employeeIdByTempId, departmentIdByName, locationIdByName, carrierIdByName) {
  let count = 0
  for (const p of readyPhoneLines) {
    const payload = {
      number: p.number,
      carrier_id: carrierIdByName.get(p.carrier) ?? null,
      assigned_employee_id: p.employeeTempId ? employeeIdByTempId.get(p.employeeTempId) ?? null : null,
      department_id: p.department ? departmentIdByName.get(p.department) ?? null : null,
      location_id: p.location ? locationIdByName.get(p.location) ?? null : null,
      status: p.status,
      notes: p.notes,
    }
    const { error } = await supabase.from('phone_lines').upsert(payload, { onConflict: 'number' })
    if (error) throw new Error(`Falha ao upsertar linha "${p.number}": ${error.message}`)
    count++
  }
  console.log(`  phone_lines: ${count} registros`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
