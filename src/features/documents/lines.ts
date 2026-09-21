import { parseOptionalNumber, round2 } from '@/lib/format'
import type { BillItemInput } from '@/services/bills'

/** A line as typed in the form (all strings, so "" can stay NULL rather than 0). */
export interface LineDraft {
  key: string
  feet: string
  inches1: string
  inches2: string
  description: string
  hsn: string
  quantity: string // Pieces
  unit: string
  rate: string
}

let counter = 0
export function newLine(partial: Partial<LineDraft> = {}): LineDraft {
  counter += 1
  return {
    key: `l${Date.now()}-${counter}`,
    feet: '',
    inches1: '',
    inches2: '',
    description: '',
    hsn: '6380',
    quantity: '',
    unit: 'SQT',
    rate: '',
    ...partial,
  }
}

export function lineIsBlank(l: LineDraft): boolean {
  return (
    !l.feet.trim() &&
    !l.inches1.trim() &&
    !l.inches2.trim() &&
    !l.description.trim() &&
    !l.quantity.trim() &&
    !l.rate.trim()
  )
}

/** Formats feet x inches x inches into a clean stone measurement description. */
export function formatParticulars(l: LineDraft): string {
  const f = l.feet.trim()
  const i1 = l.inches1.trim()
  const i2 = l.inches2.trim()
  if (f || i1 || i2) {
    const p1 = f ? `${f}'` : "0'"
    const p2 = i1 ? `${i1}"` : '0"'
    const p3 = i2 ? `${i2}"` : '0"'
    return `${p1} × ${p2} × ${p3}`
  }
  return l.description.trim() || 'Stone Slabs / Blocks'
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
    const desc = formatParticulars(l)
    if (!desc.trim()) errors.push(`Line ${n}: particulars / description is required.`)
    if (q !== null && (Number.isNaN(q) || q < 0)) errors.push(`Line ${n}: pieces must be a number ≥ 0.`)
    if (r !== null && (Number.isNaN(r) || r < 0)) errors.push(`Line ${n}: rate must be a number ≥ 0.`)
    if ((q === null) !== (r === null)) errors.push(`Line ${n}: enter both pieces and rate, or leave both blank for a descriptive line.`)
    items.push({
      description: desc,
      hsn_code: l.hsn.trim() || '6380',
      quantity: q !== null && !Number.isNaN(q) ? q : null,
      unit: l.unit.trim() || 'SQT',
      rate: r !== null && !Number.isNaN(r) ? r : null,
    })
  })
  return { items, errors }
}

/** Existing rows -> editable drafts (NULL -> ''). */
export function rowsToDrafts(
  rows: { description: string; hsn_code: string | null; quantity: number | null; unit: string | null; rate: number | null }[],
): LineDraft[] {
  return rows.map((r) => {
    let feet = ''
    let inches1 = ''
    let inches2 = ''
    const match = r.description.match(/^([0-9.]+)(?:'| ft)?\s*[×xX*]\s*([0-9.]+)(?:"| in)?\s*[×xX*]\s*([0-9.]+)(?:"| in)?/)
    if (match) {
      feet = match[1] ?? ''
      inches1 = match[2] ?? ''
      inches2 = match[3] ?? ''
    }
    return newLine({
      feet,
      inches1,
      inches2,
      description: r.description,
      hsn: r.hsn_code ?? '6380',
      quantity: r.quantity === null ? '' : String(r.quantity),
      unit: r.unit ?? 'SQT',
      rate: r.rate === null ? '' : String(r.rate),
    })
  })
}
