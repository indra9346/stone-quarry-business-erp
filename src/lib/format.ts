/**
 * Display formatting. Indian conventions: ₹, DD-MM-YYYY, lakh/crore grouping.
 *
 * NULL is never turned into 0: every formatter returns the em dash "—" for a
 * missing value, so "not entered" stays visibly different from an explicit 0.
 */

export const EMPTY = '—'

type Numeric = number | string | null | undefined

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** ₹1,23,456.00 — or "—" when the value is NULL. */
export function formatINR(value: Numeric): string {
  const n = toNumber(value)
  return n === null ? EMPTY : inr.format(n)
}

const plain = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })

/** A quantity as stored, with Indian grouping and NO unit assumed. */
export function formatQuantity(value: Numeric): string {
  const n = toNumber(value)
  return n === null ? EMPTY : plain.format(n)
}

/** A percentage as stored, e.g. 2.5 -> "2.5%". */
export function formatPercent(value: Numeric): string {
  const n = toNumber(value)
  return n === null ? EMPTY : `${plain.format(n)}%`
}

/** 'YYYY-MM-DD' (a Postgres date) -> 'DD-MM-YYYY', without any timezone shift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value
}

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
})

/** A timestamptz -> 'DD/MM/YYYY, hh:mm am' in the business timezone. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : dateTime.format(d)
}

const istDate = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Kolkata',
})

/** Today's date in the business timezone (Asia/Kolkata), as 'YYYY-MM-DD'. */
export function todayIST(): string {
  return istDate.format(new Date())
}

/** 'YYYY-MM-DD' for `days` before today (business timezone). */
export function daysAgoIST(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000)
  return istDate.format(d)
}

/** Parse a form field: '' -> null (NOT 0), otherwise a finite number or NaN. */
export function parseOptionalNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

/** Round to 2 decimals, half away from zero — mirrors Postgres numeric round(x, 2). */
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(n) * 100 + Number.EPSILON)) / 100
}
