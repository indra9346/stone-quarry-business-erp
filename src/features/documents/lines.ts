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

/**
 * Mirrors `lineAmount()` in `services/bills.ts` (the database-facing
 * version) so the figure shown while typing is exactly what will be saved.
 * Client-confirmed formula: feet x width(in) x thickness(in) x rate x
 * pieces, where pieces defaults to 1 when left blank. A line with no
 * dimensions falls back to the original pieces x rate formula.
 */
export function draftAmount(l: LineDraft): number | null {
  const f = parseOptionalNumber(l.feet)
  const i1 = parseOptionalNumber(l.inches1)
  const i2 = parseOptionalNumber(l.inches2)
  const q = parseOptionalNumber(l.quantity)
  const r = parseOptionalNumber(l.rate)
  if (r === null || Number.isNaN(r)) return null
  if (f !== null && i1 !== null && i2 !== null && !Number.isNaN(f) && !Number.isNaN(i1) && !Number.isNaN(i2)) {
    return round2(f * i1 * i2 * r * (q !== null && !Number.isNaN(q) ? q : 1))
  }
  if (!l.feet.trim() && !l.inches1.trim() && !l.inches2.trim() && q !== null && !Number.isNaN(q)) {
    return round2(q * r)
  }
  return null
}

/** Small "16 × 15 × 3 = 720" caption shown under a dimensioned line's amount, or null otherwise. */
export function draftBreakdown(l: LineDraft): string | null {
  const f = parseOptionalNumber(l.feet)
  const i1 = parseOptionalNumber(l.inches1)
  const i2 = parseOptionalNumber(l.inches2)
  if (f === null || i1 === null || i2 === null || Number.isNaN(f) || Number.isNaN(i1) || Number.isNaN(i2)) return null
  const product = f * i1 * i2
  const q = parseOptionalNumber(l.quantity)
  const pieces = q !== null && !Number.isNaN(q) && q !== 1 ? ` × ${q} pcs` : ''
  return `${f} × ${i1} × ${i2} = ${round2(product)}${pieces}`
}

/**
 * Turn typed lines into database input.
 *  - blank rows are dropped;
 *  - a line is DESCRIPTIVE (dimensions, quantity, rate and amount all NULL)
 *    or fully priced. Fully priced means either:
 *      dimensioned  — feet, width and thickness all given, plus a rate
 *                      (pieces optional, defaults to 1);
 *      legacy/plain — no dimensions, but pieces AND rate given.
 *    A half-filled set (some but not all of feet/width/thickness, or pieces
 *    without rate / rate without pieces when there are no dimensions) is an
 *    error, matching the database CHECK;
 *  - empty stays NULL, never 0.
 */
export function draftsToInputs(lines: LineDraft[]): { items: BillItemInput[]; errors: string[] } {
  const items: BillItemInput[] = []
  const errors: string[] = []
  lines.forEach((l, i) => {
    if (lineIsBlank(l)) return
    const n = i + 1
    const f = parseOptionalNumber(l.feet)
    const i1 = parseOptionalNumber(l.inches1)
    const i2 = parseOptionalNumber(l.inches2)
    const q = parseOptionalNumber(l.quantity)
    const r = parseOptionalNumber(l.rate)
    const desc = formatParticulars(l)
    if (!desc.trim()) errors.push(`Line ${n}: particulars / description is required.`)

    const dimsGiven = [f, i1, i2].filter((d) => d !== null).length
    const hasDims = dimsGiven === 3
    if (dimsGiven > 0 && dimsGiven < 3) errors.push(`Line ${n}: enter feet, width and thickness together, or leave all three blank.`)
    if (f !== null && (Number.isNaN(f) || f < 0)) errors.push(`Line ${n}: feet must be a number ≥ 0.`)
    if (i1 !== null && (Number.isNaN(i1) || i1 < 0)) errors.push(`Line ${n}: width (inches) must be a number ≥ 0.`)
    if (i2 !== null && (Number.isNaN(i2) || i2 < 0)) errors.push(`Line ${n}: thickness (inches) must be a number ≥ 0.`)
    if (q !== null && (Number.isNaN(q) || q < 0)) errors.push(`Line ${n}: pieces must be a number ≥ 0.`)
    if (r !== null && (Number.isNaN(r) || r < 0)) errors.push(`Line ${n}: rate must be a number ≥ 0.`)

    if (hasDims && r === null) errors.push(`Line ${n}: enter a rate for this dimensioned line.`)
    if (!hasDims && dimsGiven === 0 && (q === null) !== (r === null)) {
      errors.push(`Line ${n}: enter both pieces and rate, or leave both blank for a descriptive line.`)
    }

    items.push({
      description: desc,
      hsn_code: l.hsn.trim() || '6380',
      quantity: q !== null && !Number.isNaN(q) ? q : null,
      unit: l.unit.trim() || 'SQT',
      rate: r !== null && !Number.isNaN(r) ? r : null,
      feet: hasDims && f !== null && !Number.isNaN(f) ? f : null,
      width_in: hasDims && i1 !== null && !Number.isNaN(i1) ? i1 : null,
      thickness_in: hasDims && i2 !== null && !Number.isNaN(i2) ? i2 : null,
    })
  })
  return { items, errors }
}

/** Existing rows -> editable drafts (NULL -> ''). */
export function rowsToDrafts(
  rows: {
    description: string
    hsn_code: string | null
    quantity: number | null
    unit: string | null
    rate: number | null
    feet?: number | null
    width_in?: number | null
    thickness_in?: number | null
  }[],
): LineDraft[] {
  return rows.map((r) => {
    // Rows saved since migration 014 carry real numeric columns — prefer
    // those. Older rows only have the dimensions baked into the
    // description text, so fall back to parsing that.
    let feet = r.feet != null ? String(r.feet) : ''
    let inches1 = r.width_in != null ? String(r.width_in) : ''
    let inches2 = r.thickness_in != null ? String(r.thickness_in) : ''
    if (!feet && !inches1 && !inches2) {
      const match = r.description.match(/^([0-9.]+)(?:'| ft)?\s*[×xX*]\s*([0-9.]+)(?:"| in)?\s*[×xX*]\s*([0-9.]+)(?:"| in)?/)
      if (match) {
        feet = match[1] ?? ''
        inches1 = match[2] ?? ''
        inches2 = match[3] ?? ''
      }
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
