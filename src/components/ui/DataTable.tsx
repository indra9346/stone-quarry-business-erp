import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { EmptyState, ErrorState, TableSkeleton } from './feedback'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Right-align (numbers, money). */
  numeric?: boolean
  className?: string
  /** Allow long text to wrap (cells are single-line by default). */
  wrap?: boolean
  /** Enables click-to-sort on the rows currently loaded. */
  sortValue?: (row: T) => string | number | null
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/**
 * Enterprise table: sticky header, horizontal scroll on small screens, loading
 * skeleton, empty and error states, server-side pagination, and click-to-sort
 * of the current page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  pagination,
  className,
  dense,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  empty?: { title: string; description?: string; action?: ReactNode }
  onRowClick?: (row: T) => void
  pagination?: Pagination
  className?: string
  dense?: boolean
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!rows || !sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (av === bv) return 0
      if (av === null) return 1 // NULLs always last
      if (bv === null) return -1
      return av < bv ? -dir : dir
    })
  }, [rows, sort, columns])

  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (loading) return <TableSkeleton cols={Math.min(columns.length, 6)} />
  if (!sorted || sorted.length === 0) {
    return <EmptyState title={empty?.title ?? 'No records'} description={empty?.description} action={empty?.action} />
  }

  const lastPage = pagination ? Math.max(0, Math.ceil(pagination.total / pagination.pageSize) - 1) : 0

  return (
    <div className={className}>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'sticky top-0 z-[1] whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                      c.numeric && 'text-right',
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 hover:text-slate-800', c.numeric && 'flex-row-reverse')}
                        onClick={() =>
                          setSort(!active ? { key: c.key, dir: 'asc' } : sort.dir === 'asc' ? { key: c.key, dir: 'desc' } : null)
                        }
                      >
                        {c.header}
                        {active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn('group transition-colors', onRowClick && 'cursor-pointer hover:bg-cyan-50/50')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'border-b border-slate-100 px-4 text-slate-700',
                      !c.wrap && 'whitespace-nowrap',
                      dense ? 'py-1.5' : 'py-2.5',
                      c.numeric && 'tabular text-right',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > pagination.pageSize && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          <span className="tabular">
            {pagination.page * pagination.pageSize + 1}–
            {Math.min((pagination.page + 1) * pagination.pageSize, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secondary" disabled={pagination.page <= 0} onClick={() => pagination.onPageChange(pagination.page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular">
              Page {pagination.page + 1} / {lastPage + 1}
            </span>
            <Button size="sm" variant="secondary" disabled={pagination.page >= lastPage} onClick={() => pagination.onPageChange(pagination.page + 1)} aria-label="Next page">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
