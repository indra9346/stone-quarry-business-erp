import { useEffect, useId, useState } from 'react'
import { Check, Plus, User } from 'lucide-react'

export interface CustomerOption {
  id: string
  customer_name: string
  gstin?: string | null
  billing_address?: string | null
}

/**
 * Customer selector that supports both typing custom customer names
 * directly and selecting from existing customer records.
 */
export function CustomerCombobox({
  value,
  customerName,
  onChange,
  customers,
  disabled,
  placeholder = 'Type or select customer...',
}: {
  value: string
  customerName?: string
  onChange: (customerId: string, name: string) => void
  customers: CustomerOption[]
  disabled?: boolean
  placeholder?: string
}) {
  const datalistId = useId()
  const [typed, setTyped] = useState(customerName || '')

  useEffect(() => {
    if (value) {
      const match = customers.find((c) => c.id === value)
      if (match) {
        setTyped(match.customer_name)
      }
    } else if (customerName !== undefined) {
      setTyped(customerName)
    }
  }, [value, customerName, customers])

  function handleInputChange(text: string) {
    setTyped(text)
    const exact = customers.find((c) => c.customer_name.trim().toLowerCase() === text.trim().toLowerCase())
    if (exact) {
      onChange(exact.id, exact.customer_name)
    } else {
      onChange('', text)
    }
  }

  const selectedMatch = customers.find((c) => c.id === value)
  const isNew = typed.trim() && !selectedMatch

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          list={datalistId}
          value={typed}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => handleInputChange(e.target.value)}
          className="h-9 w-full rounded-md border border-stone-300 bg-white px-3 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-stone-50"
        />
        <div className="pointer-events-none absolute right-2.5 text-stone-400">
          <User className="h-4 w-4" />
        </div>
      </div>

      <datalist id={datalistId}>
        {customers.map((c) => (
          <option key={c.id} value={c.customer_name}>
            {c.gstin ? `GST: ${c.gstin}` : c.billing_address || 'Customer'}
          </option>
        ))}
      </datalist>

      {/* Helper indicator */}
      <div className="mt-1 flex items-center gap-1.5 text-[11px]">
        {selectedMatch ? (
          <span className="flex items-center gap-1 font-medium text-emerald-700">
            <Check className="h-3 w-3" /> Existing customer record
          </span>
        ) : isNew ? (
          <span className="flex items-center gap-1 font-medium text-amber-700">
            <Plus className="h-3 w-3" /> Will be registered as a new customer on save
          </span>
        ) : (
          <span className="text-stone-400">Type a name to search or add a new customer</span>
        )}
      </div>
    </div>
  )
}
