import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/form'
import { formatINR } from '@/lib/format'
import { draftAmount, newLine, type LineDraft } from './lines'
import type { Unit } from '@/types/db'

/**
 * Line editor shared by bills and quotations. A line with only a description is
 * valid ("descriptive line"); quantity and rate go together. The amount shown is
 * a preview of quantity × rate — the database stores/validates the real value.
 */
export default function LineItemsEditor({
  lines,
  onChange,
  units,
  disabled,
}: {
  lines: LineDraft[]
  onChange: (lines: LineDraft[]) => void
  units: Unit[]
  disabled?: boolean
}) {
  const set = (key: string, patch: Partial<LineDraft>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] gap-2 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
        <span>Particulars</span>
        <span>HSN</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Rate</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      <div className="space-y-3 md:space-y-2">
        {lines.map((l, idx) => (
          <div key={l.key} className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] md:items-center md:bg-transparent md:p-0">
            <Input className="col-span-2 md:col-span-1" placeholder={`Line ${idx + 1} description`} aria-label={`Line ${idx + 1} description`} value={l.description} disabled={disabled} onChange={(e) => set(l.key, { description: e.target.value })} />
            <Input placeholder="HSN" aria-label={`Line ${idx + 1} HSN`} value={l.hsn} disabled={disabled} onChange={(e) => set(l.key, { hsn: e.target.value })} />
            <Input inputMode="decimal" placeholder="Qty" aria-label={`Line ${idx + 1} quantity`} value={l.quantity} disabled={disabled} onChange={(e) => set(l.key, { quantity: e.target.value })} />
            <Select aria-label={`Line ${idx + 1} unit`} value={l.unit} disabled={disabled} onChange={(e) => set(l.key, { unit: e.target.value })}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Input inputMode="decimal" placeholder="Rate" aria-label={`Line ${idx + 1} rate`} value={l.rate} disabled={disabled} onChange={(e) => set(l.key, { rate: e.target.value })} />
            <div className="tabular text-right text-sm text-slate-700 md:pr-1">{formatINR(draftAmount(l))}</div>
            <button
              type="button"
              className="justify-self-end rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              aria-label={`Remove line ${idx + 1}`}
              disabled={disabled || lines.length <= 1}
              onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <Button className="mt-3" size="sm" disabled={disabled} onClick={() => onChange([...lines, newLine()])}>
        <Plus className="h-3.5 w-3.5" /> Add line
      </Button>
      {units.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No units are defined yet — an administrator can add the business's units under Settings → Stock. A unit is optional.</p>
      )}
    </div>
  )
}
