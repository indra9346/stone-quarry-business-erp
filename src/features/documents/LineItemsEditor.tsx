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
      list.unshift({ code: 'SQT', label: 'SQT (Sq. Feet)', measurement_kind: 'area' })
    }
    return list
  }, [units])

  return (
    <div>
      {/* Desktop Column Header */}
      <div className="hidden grid-cols-[minmax(0,3.2fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_1.5rem_minmax(0,1.4fr)_1.5rem_minmax(0,1.6fr)_2rem] items-center gap-2 px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 md:grid">
        <span>Particulars (Feet × In × In)</span>
        <span>HSN</span>
        <span>Pieces</span>
        <span>Unit</span>
        <span className="text-center">×</span>
        <span>Rate (₹)</span>
        <span className="text-center">=</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      {/* Item Rows */}
      <div className="space-y-3 md:space-y-2">
        {lines.map((l, idx) => (
          <div
            key={l.key}
            className="flex flex-col gap-2 rounded-lg border border-stone-200/80 bg-stone-50/60 p-3 shadow-sm md:grid md:grid-cols-[minmax(0,3.2fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_1.5rem_minmax(0,1.4fr)_1.5rem_minmax(0,1.6fr)_2rem] md:items-center md:border-none md:bg-transparent md:p-0 md:shadow-none"
          >
            {/* 1. Particulars: 3 boxes [Feet] × [Inches] × [Inches] */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-stone-500 md:hidden">Size:</span>
              <div className="flex flex-1 items-center gap-1">
                <Input
                  inputMode="decimal"
                  placeholder="Feet"
                  aria-label={`Line ${idx + 1} Feet`}
                  value={l.feet}
                  disabled={disabled}
                  className="w-16 px-1.5 text-center text-xs font-medium placeholder:text-stone-400"
                  onChange={(e) => set(l.key, { feet: e.target.value })}
                />
                <span className="font-bold text-stone-400 select-none">×</span>
                <Input
                  inputMode="decimal"
                  placeholder="Inches"
                  aria-label={`Line ${idx + 1} Width Inches`}
                  value={l.inches1}
                  disabled={disabled}
                  className="w-16 px-1.5 text-center text-xs font-medium placeholder:text-stone-400"
                  onChange={(e) => set(l.key, { inches1: e.target.value })}
                />
                <span className="font-bold text-stone-400 select-none">×</span>
                <Input
                  inputMode="decimal"
                  placeholder="Inches"
                  aria-label={`Line ${idx + 1} Thickness Inches`}
                  value={l.inches2}
                  disabled={disabled}
                  className="w-16 px-1.5 text-center text-xs font-medium placeholder:text-stone-400"
                  onChange={(e) => set(l.key, { inches2: e.target.value })}
                />
              </div>
            </div>

            {/* 2. HSN box (Fixed default 6380) */}
            <div className="flex items-center gap-2 md:block">
              <span className="w-14 text-xs font-medium text-stone-500 md:hidden">HSN:</span>
              <Input
                placeholder="6380"
                aria-label={`Line ${idx + 1} HSN`}
                value={l.hsn || '6380'}
                disabled={disabled}
                className="text-center font-medium md:w-full"
                onChange={(e) => set(l.key, { hsn: e.target.value })}
              />
            </div>

            {/* 3. Pieces (was Qty) */}
            <div className="flex items-center gap-2 md:block">
              <span className="w-14 text-xs font-medium text-stone-500 md:hidden">Pieces:</span>
              <Input
                inputMode="decimal"
                placeholder="Pieces"
                aria-label={`Line ${idx + 1} pieces`}
                value={l.quantity}
                disabled={disabled}
                className="text-right font-medium md:w-full"
                onChange={(e) => set(l.key, { quantity: e.target.value })}
              />
            </div>

            {/* 4. Unit (Default SQT, customizable) */}
            <div className="flex items-center gap-2 md:block">
              <span className="w-14 text-xs font-medium text-stone-500 md:hidden">Unit:</span>
              <Select
                aria-label={`Line ${idx + 1} unit`}
                value={l.unit || 'SQT'}
                disabled={disabled}
                className="font-medium md:w-full"
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
            <span className="hidden select-none text-center text-base font-bold text-amber-600/80 md:block">×</span>

            {/* 6. Rate */}
            <div className="flex items-center gap-2 md:block">
              <span className="w-14 text-xs font-medium text-stone-500 md:hidden">Rate ₹:</span>
              <Input
                inputMode="decimal"
                placeholder="Rate"
                aria-label={`Line ${idx + 1} rate`}
                value={l.rate}
                disabled={disabled}
                className="text-right font-medium md:w-full"
                onChange={(e) => set(l.key, { rate: e.target.value })}
              />
            </div>

            {/* 7. Equals '=' Symbol */}
            <span className="hidden select-none text-center text-base font-bold text-stone-400 md:block">=</span>

            {/* 8. Amount */}
            <div className="flex items-center justify-between border-t border-stone-200/60 pt-2 md:block md:border-none md:pt-0">
              <span className="text-xs font-medium text-stone-500 md:hidden">Amount:</span>
              <div className="tabular text-right text-sm font-semibold text-stone-800 md:pr-1">
                {formatINR(draftAmount(l))}
              </div>
            </div>

            {/* 9. Delete action */}
            <button
              type="button"
              className="self-end rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 md:justify-self-end md:self-auto"
              aria-label={`Remove line ${idx + 1}`}
              disabled={disabled || lines.length <= 1}
              onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
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
