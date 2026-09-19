import { useBizQuery } from './useBiz'
import { ok } from '@/services/common'

export interface AlertItem {
  id: string
  message: string
  to: string
  tone: 'warning' | 'info'
}

/** Real, derived alerts only — nothing is shown unless the data says so. */
export function useAlerts() {
  const q = useBizQuery(
    ['alerts'],
    async (c) => {
      const drafts = await c
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('ledger_posted_at', null)
      const empty = await c.from('stock_items').select('id', { count: 'exact', head: true }).eq('quantity_on_hand', 0)
      if (drafts.error) ok(drafts as never)
      if (empty.error) ok(empty as never)
      return { draftBills: drafts.count ?? 0, emptyStock: empty.count ?? 0 }
    },
    { staleTime: 60_000 },
  )

  const items: AlertItem[] = []
  if (q.data && q.data.draftBills > 0) {
    items.push({
      id: 'draft-bills',
      message: `${q.data.draftBills} draft bill${q.data.draftBills === 1 ? '' : 's'} not yet posted to the ledger`,
      to: 'bills',
      tone: 'warning',
    })
  }
  if (q.data && q.data.emptyStock > 0) {
    items.push({
      id: 'empty-stock',
      message: `${q.data.emptyStock} stock item${q.data.emptyStock === 1 ? '' : 's'} at zero quantity`,
      to: 'stock',
      tone: 'warning',
    })
  }
  return { items, loading: q.isLoading }
}
