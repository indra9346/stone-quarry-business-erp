import { parseOptionalNumber, round2 } from '@/lib/format'
import type { BillItemInput } from '@/services/bills'

/** A line as typed in the form (all strings, so "" can stay NULL rather than 0). */
export interface LineDraft {
  key: string
  description: string
  hsn: string
  quantity: string
  unit: string
  rate: string
}

let counter = 0
export function newLine(partial: Partial<LineDraft> = {}): LineDraft {
  counter += 1
  return { key: `l${Date.now()}-${counter}`, description: '', hsn: '', quantity: '', unit: '', rate: '', ...partial }
}

export function lineIsBlank(l: LineDraft): boolean {
  return !l.description.trim() && !l.hsn.trim() && !l.quantity.trim() && !l.rate.trim() && !l.unit.trim()
}

/** The amount the database will store for this line, or null if it is not fully priced. */
export function draftAmount(l: LineDraft): number | null {
  const q = parseOptionalNumber(l.quantity)
  const r = parseOptionalNumber(l.rate)
  if (q === null || r === null || Number.isNaN(q) || Number.isNaN(r)) return null
  return round2(q * r)
}

/**
 * Turn typed lines into database input.
 *  - blank rows are dropped;
 *  - a line is DESCRIPTIVE (quantity, rate and amount all NULL) or fully priced
 *    (quantity AND rate present) — a half-filled line is an error, as in the
 *    database CHECK;
 *  - empty stays NULL, never 0.
 */
export function draftsToInputs(lines: LineDraft[]): { items: BillItemInput[]; errors: string[] } {
  const items: BillItemInput[] = []
  const errors: string[] = []
  lines.forEach((l, i) => {
    if (lineIsBlank(l)) return
    const n = i + 1
    const q = parseOptionalNumber(l.quantity)
    const r = parseOptionalNumber(l.rate)
    if (!l.description.trim()) errors.push(`Line ${n}: description is required.`)
    if (q !== null && (Number.isNaN(q) || q < 0)) errors.push(`Line ${n}: quantity must be a number ≥ 0.`)
    if (r !== null && (Number.isNaN(r) || r < 0)) errors.push(`Line ${n}: rate must be a number ≥ 0.`)
    if ((q === null) !== (r === null)) errors.push(`Line ${n}: enter both quantity and rate, or leave both blank for a descriptive line.`)
    items.push({
      description: l.description.trim(),
      hsn_code: l.hsn.trim() || null,
      quantity: q !== null && !Number.isNaN(q) ? q : null,
      unit: l.unit.trim() || null,
      rate: r !== null && !Number.isNaN(r) ? r : null,
    })
  })
  return { items, errors }
}

/** Existing rows -> editable drafts (NULL -> ''). */
export function rowsToDrafts(
  rows: { description: string; hsn_code: string | null; quantity: number | null; unit: string | null; rate: number | null }[],
): LineDraft[] {
  return rows.map((r) =>
    newLine({
      description: r.description,
      hsn: r.hsn_code ?? '',
      quantity: r.quantity === null ? '' : String(r.quantity),
      unit: r.unit ?? '',
      rate: r.rate === null ? '' : String(r.rate),
    }),
  )
}
