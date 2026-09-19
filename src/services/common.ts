import type { PostgrestError } from '@supabase/supabase-js'

export const PAGE_SIZE = 25

export interface Page<T> {
  rows: T[]
  total: number
}

/** A failed query, with the database's own message (already human-readable for
 *  our RAISE EXCEPTION rules, e.g. "Bill 52 is posted to the ledger…"). */
export class DbError extends Error {
  code?: string
  constructor(error: PostgrestError | { message: string; code?: string }) {
    super(error.message)
    this.name = 'DbError'
    this.code = 'code' in error ? error.code : undefined
  }
}

export function ok<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new DbError(res.error)
  if (res.data === null) throw new DbError({ message: 'No data returned.' })
  return res.data
}

export function okVoid(res: { error: PostgrestError | null }): void {
  if (res.error) throw new DbError(res.error)
}

export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const from = page * size
  return [from, from + size - 1]
}

/** Escape a user search term for use inside a PostgREST `ilike`/`or` filter. */
export function likeTerm(term: string): string {
  return term.replace(/[%,()*]/g, ' ').trim()
}
