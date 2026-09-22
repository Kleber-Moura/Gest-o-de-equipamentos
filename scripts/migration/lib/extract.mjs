import ExcelJS from 'exceljs'

const SHEET_MATCHERS = {
  Laptop: (name) => name.trim().toLowerCase().startsWith('laptop'),
  Acessorios: (name) => name.trim().toLowerCase().includes('acess'),
  LinhasTelefone: (name) => name.trim().toLowerCase().includes('linhas'),
}

function cellValue(cell) {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object' && 'result' in v) return v.result ?? '' // fórmula já calculada
  if (typeof v === 'object' && 'text' in v) return v.text // rich text
  return v
}

function rowIsBlank(values) {
  return values.every((v) => (v instanceof Date ? false : String(v).trim() === ''))
}

/**
 * Lê exclusivamente as 3 abas autorizadas (Laptop, Acessórios, Linhas de telefone).
 * Todas as demais abas do arquivo são ignoradas por completo, mesmo que existam.
 */
export async function extractSheets(filePath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const result = {}

  for (const worksheet of workbook.worksheets) {
    const matchKey = Object.entries(SHEET_MATCHERS).find(([, matcher]) => matcher(worksheet.name))?.[0]
    if (!matchKey) continue

    const rows = []
    let header = []
    worksheet.eachRow((row, rowNumber) => {
      const values = []
      // row.eachCell não preenche células realmente vazias; iteramos por índice até o maior colNumber
      for (let i = 1; i <= worksheet.columnCount; i++) {
        values.push(cellValue(row.getCell(i)))
      }
      if (rowNumber === 1) {
        header = values.map((v) => String(v).trim())
        return
      }
      if (rowIsBlank(values)) return
      const record = {}
      header.forEach((col, idx) => {
        record[col] = values[idx]
      })
      record.__sourceSheet = worksheet.name
      record.__sourceRow = rowNumber
      rows.push(record)
    })

    result[matchKey] = { sheetName: worksheet.name, header, rows }
  }

  for (const key of Object.keys(SHEET_MATCHERS)) {
    if (!result[key]) {
      throw new Error(`Aba esperada não encontrada na planilha: ${key}`)
    }
  }

  return result
}
