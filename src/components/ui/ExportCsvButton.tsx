import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Download } from 'lucide-react'
import { Button } from './Button'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from '@/lib/csv'

/**
 * Downloads the rows currently being viewed (all pages, same filters) as a CSV
 * file that opens in Excel / Google Sheets. Reads only what the signed-in user
 * is already allowed to see.
 */
export function ExportCsvButton<T>({
  name,
  columns,
  load,
  label = 'Export CSV',
}: {
  name: string
  columns: CsvColumn<T>[]
  load: (client: SupabaseClient) => Promise<T[]>
  label?: string
}) {
  const { client, code } = useBusinessContext()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="no-print inline-flex flex-col items-end">
      <Button
        loading={busy}
        disabled={!client}
        onClick={async () => {
          if (!client) return
          setBusy(true)
          setError(null)
          try {
            const rows = await load(client)
            downloadCsv(csvFilename(name, code), toCsv(rows, columns))
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Export failed.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <Download className="h-4 w-4" /> {label}
      </Button>
      {error && <span className="mt-1 text-xs text-red-700" role="alert">{error}</span>}
    </span>
  )
}
