import ExcelJS from 'exceljs'

export async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: unknown[][],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

  for (const row of rows) {
    sheet.addRow(row.map((v) => (v == null ? '' : v)))
  }

  sheet.columns.forEach((col) => {
    let max = 10
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0
      if (len > max) max = len
    })
    col.width = Math.min(max + 2, 60)
  })

  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf) as unknown as Buffer
}

export const XLSX_HEADERS = {
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
