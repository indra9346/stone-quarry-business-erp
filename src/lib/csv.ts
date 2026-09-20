import type { Page } from '@/services/common'

export interface CsvColumn<T> {
  header: string
  /** null / undefined become an EMPTY cell (not 0): blank means "not on the document". */
  value: (row: T) => string | number | null | undefined
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  // A text cell that starts with = + - @ could be run as a formula by a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV text with a UTF-8 byte-order mark so Excel reads ₹ and Kannada names correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(','))
  return '\uFEFF' + [head, ...body].join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Reads every page of a paginated list (the whole filtered result, not just the visible page). */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<Page<T>>, maxPages = 400): Promise<T[]> {
  const all: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(page)
    all.push(...res.rows)
    if (res.rows.length === 0 || all.length >= res.total) break
  }
  return all
}

export function csvFilename(base: string, businessCode: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${businessCode}-${base}-${stamp}.csv`
}
