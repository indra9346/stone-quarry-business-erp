import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useBizMutation, useBizQuery } from '@/hooks/useBiz'
import { getQuotation, setQuotationStatus } from '@/services/documents'
import { PageHeader, PDFButton, PrintButton } from '@/components/ui/layout'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/form'
import { QuotationStatusBadge } from '@/components/ui/StatusBadge'
import { ErrorState, Skeleton } from '@/components/ui/feedback'
import { QuotationDocument } from '@/components/documents/documents'
import { formatDate } from '@/lib/format'
import type { QuotationStatus } from '@/types/db'

export default function QuotationDetail() {
  const { id } = useParams()
  const { code } = useBusinessContext()
  const [error, setError] = useState<string | null>(null)
  const query = useBizQuery(['quotations', 'detail', id ?? ''], (c) => getQuotation(c, id!), { enabled: !!id })
  const setStatus = useBizMutation((c, s: QuotationStatus) => setQuotationStatus(c, id!, s), { invalidate: [['quotations'], ['dashboard']] })

  if (query.isLoading) return <Skeleton className="h-96" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!query.data) return null
  const { quotation, items } = query.data

  return (
    <div>
      <PageHeader
        title={`Quotation ${quotation.quotation_number}`}
        crumbs={[{ label: 'Quotations', to: `/business/${code}/quotations` }, { label: quotation.quotation_number }]}
        description={`${quotation.customers?.customer_name ?? '—'} · ${formatDate(quotation.quotation_date)}`}
        actions={
          <>
            <QuotationStatusBadge status={quotation.status} />
            <Select
              aria-label="Change status"
              className="w-36"
              value={['draft', 'sent', 'accepted', 'rejected'].includes(quotation.status) ? quotation.status : ''}
              onChange={(e) => { setError(null); setStatus.mutate(e.target.value as QuotationStatus, { onError: (er) => setError(er.message) }) }}
            >
              {!['draft', 'sent', 'accepted', 'rejected'].includes(quotation.status) && <option value="">{quotation.status}</option>}
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Link to={`/business/${code}/quotations/${quotation.id}/edit`}>
              <Button><Pencil className="h-4 w-4" /> Edit</Button>
            </Link>
            <PrintButton />
            <PDFButton />
          </>
        }
      />
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <QuotationDocument quotation={quotation} items={items} />
    </div>
  )
}
