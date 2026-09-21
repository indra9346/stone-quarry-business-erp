import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/form'
import { formatINR } from '@/lib/format'
import { draftAmount, newLine, type LineDraft } from './lines'
import type { Unit } from '@/types/db'

/**
 * Line editor for stone quarry bills and quotations.
 * Particulars features 3 dimension boxes: [Feet] × [Inches] × [Inches].
 * Pre-filled HSN 6380, Pieces, Unit SQT (customizable), explicit '×' multiplication
 * symbol, Rate, and computed Amount.
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

  const allUnits = useMemo(() => {
    const list = [...units]
    if (!list.some((u) => u.code.toUpperCase() === 'SQT')) {
      list.unshift({ code: 'SQT', label: 'SQT', measurement_kind: 'area' })
    }
    return list.map((u) => ({
      ...u,
      label: u.code.toUpperCase() === 'SQT' ? 'SQT' : u.label,
    }))
  }, [units])

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          {/* Desktop Column Header */}
          <div className="grid grid-cols-[minmax(225px,3.2fr)_minmax(70px,1fr)_minmax(70px,1fr)_minmax(80px,1.2fr)_1.25rem_minmax(80px,1.2fr)_1.25rem_minmax(90px,1.4fr)_2rem] items-center gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <span>Particulars (Feet × In × In)</span>
            <span>HSN</span>
            <span>Pieces</span>
            <span>Unit</span>
            <span className="text-center font-bold text-amber-600">×</span>
            <span>Rate (₹)</span>
            <span className="text-center font-bold text-stone-400">=</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {/* Item Rows */}
          <div className="space-y-2">
            {lines.map((l, idx) => (
              <div
                key={l.key}
                className="grid grid-cols-[minmax(225px,3.2fr)_minmax(70px,1fr)_minmax(70px,1fr)_minmax(80px,1.2fr)_1.25rem_minmax(80px,1.2fr)_1.25rem_minmax(90px,1.4fr)_2rem] items-center gap-2 rounded-lg bg-stone-50/40 p-1 md:bg-transparent md:p-0"
              >
                {/* 1. Particulars: 3 distinct boxes [Feet] × [Inches] × [Inches] */}
                <div className="flex items-center gap-1">
                  <Input
                    inputMode="decimal"
                    placeholder="Feet"
                    aria-label={`Line ${idx + 1} Feet`}
                    value={l.feet}
                    disabled={disabled}
                    className="h-9 w-16 px-1 text-center text-xs font-medium placeholder:text-stone-400"
                    onChange={(e) => set(l.key, { feet: e.target.value })}
                  />
                  <span className="font-bold text-stone-400 select-none">×</span>
                  <Input
                    inputMode="decimal"
                    placeholder="Inches"
                    aria-label={`Line ${idx + 1} Width Inches`}
                    value={l.inches1}
                    disabled={disabled}
                    className="h-9 w-16 px-1 text-center text-xs font-medium placeholder:text-stone-400"
                    onChange={(e) => set(l.key, { inches1: e.target.value })}
                  />
                  <span className="font-bold text-stone-400 select-none">×</span>
                  <Input
                    inputMode="decimal"
                    placeholder="Inches"
                    aria-label={`Line ${idx + 1} Thickness Inches`}
                    value={l.inches2}
                    disabled={disabled}
                    className="h-9 w-16 px-1 text-center text-xs font-medium placeholder:text-stone-400"
                    onChange={(e) => set(l.key, { inches2: e.target.value })}
                  />
                </div>

                {/* 2. HSN box (Fixed default 6380) */}
                <div>
                  <Input
                    placeholder="6380"
                    aria-label={`Line ${idx + 1} HSN`}
                    value={l.hsn || '6380'}
                    disabled={disabled}
                    className="h-9 text-center font-medium"
                    onChange={(e) => set(l.key, { hsn: e.target.value })}
                  />
                </div>

                {/* 3. Pieces (was Qty) */}
                <div>
                  <Input
                    inputMode="decimal"
                    placeholder="Pieces"
                    aria-label={`Line ${idx + 1} pieces`}
                    value={l.quantity}
                    disabled={disabled}
                    className="h-9 text-right font-medium"
                    onChange={(e) => set(l.key, { quantity: e.target.value })}
                  />
                </div>

                {/* 4. Unit (Default SQT, customizable) */}
                <div>
                  <Select
                    aria-label={`Line ${idx + 1} unit`}
                    value={l.unit || 'SQT'}
                    disabled={disabled}
                    className="h-9 px-2 pr-6 text-xs font-medium"
                    onChange={(e) => set(l.key, { unit: e.target.value })}
                  >
                    {allUnits.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* 5. Explicit '×' Multiplication Symbol */}
                <span className="select-none text-center text-base font-bold text-amber-600">×</span>

                {/* 6. Rate */}
                <div>
                  <Input
                    inputMode="decimal"
                    placeholder="Rate"
                    aria-label={`Line ${idx + 1} rate`}
                    value={l.rate}
                    disabled={disabled}
                    className="h-9 text-right font-medium"
                    onChange={(e) => set(l.key, { rate: e.target.value })}
                  />
                </div>

                {/* 7. Equals '=' Symbol */}
                <span className="select-none text-center text-base font-bold text-stone-400">=</span>

                {/* 8. Amount */}
                <div className="tabular text-right text-sm font-semibold text-stone-800 pr-1">
                  {formatINR(draftAmount(l))}
                </div>

                {/* 9. Delete action */}
                <button
                  type="button"
                  className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  aria-label={`Remove line ${idx + 1}`}
                  disabled={disabled || lines.length <= 1}
                  onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Line Button */}
      <Button
        className="mt-3 border-amber-300/80 bg-amber-50 font-medium text-amber-900 hover:bg-amber-100"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...lines, newLine()])}
      >
        <Plus className="h-3.5 w-3.5 text-amber-700" /> Add stone item
      </Button>
    </div>
  )
}
