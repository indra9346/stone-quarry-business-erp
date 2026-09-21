import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CustomerOption {
  id: string
  customer_name: string
  gstin?: string | null
  billing_address?: string | null
}

/**
 * Customer combobox that supports both typing custom customer names
 * directly and selecting from a rich searchable dropdown list of customers.
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
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [typed, setTyped] = useState(customerName || '')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  // Sync selected customer name
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

  // Filter customers based on typed query
  const filteredCustomers = useMemo(() => {
    const q = typed.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(q) ||
        (c.gstin && c.gstin.toLowerCase().includes(q)) ||
        (c.billing_address && c.billing_address.toLowerCase().includes(q))
    )
  }, [customers, typed])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function handleSelectCustomer(c: CustomerOption) {
    setTyped(c.customer_name)
    onChange(c.id, c.customer_name)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleInputChange(text: string) {
    setTyped(text)
    if (!isOpen) setIsOpen(true)
    const exact = customers.find((c) => c.customer_name.trim().toLowerCase() === text.trim().toLowerCase())
    if (exact) {
      onChange(exact.id, exact.customer_name)
    } else {
      onChange('', text)
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setTyped('')
    onChange('', '')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const selectedMatch = customers.find((c) => c.id === value)
  const isNew = typed.trim() && !selectedMatch

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredCustomers.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + filteredCustomers.length) % Math.max(1, filteredCustomers.length))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCustomers[highlightedIndex]) {
          handleSelectCustomer(filteredCustomers[highlightedIndex])
        } else if (isNew) {
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={cn(
          'relative flex h-9 w-full items-center rounded-md bg-white shadow-sm ring-1 ring-inset ring-stone-300 transition-colors focus-within:ring-2 focus-within:ring-amber-500',
          disabled && 'cursor-not-allowed bg-stone-100 opacity-70'
        )}
      >
        <div className="pointer-events-none pl-2.5 text-stone-400">
          <User className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={typed}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full w-full bg-transparent px-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none disabled:cursor-not-allowed"
        />

        <div className="flex items-center gap-1 pr-1.5">
          {typed && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              title="Clear customer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false)
              } else {
                setIsOpen(true)
                inputRef.current?.focus()
              }
            }}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed"
            title="Toggle customer list"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Helper status indicator below input */}
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
          <span className="text-stone-400">Type a name to search or click dropdown to select</span>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute left-0 top-[42px] z-50 max-h-64 w-full overflow-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {filteredCustomers.length === 0 ? (
            <div className="p-3 text-xs text-stone-500">
              {isNew ? (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsOpen(false)
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded bg-amber-50 p-2 text-amber-900 font-medium hover:bg-amber-100"
                >
                  <Plus className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>Create new customer: &ldquo;<strong>{typed}</strong>&rdquo;</span>
                </div>
              ) : (
                <p className="text-center">No matching customers found</p>
              )}
            </div>
          ) : (
            <>
              {filteredCustomers.map((c, idx) => {
                const isSelected = c.id === value
                const isHighlighted = idx === highlightedIndex
                return (
                  <div
                    key={c.id}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectCustomer(c)
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors',
                      isHighlighted ? 'bg-amber-50 text-amber-900' : 'text-stone-800',
                      isSelected && 'bg-amber-100/60 font-medium'
                    )}
                  >
                    <div className="flex flex-col truncate">
                      <span className="font-medium">{c.customer_name}</span>
                      {(c.gstin || c.billing_address) && (
                        <span className="truncate text-[10px] text-stone-500">
                          {c.gstin ? `GST: ${c.gstin} ` : ''}
                          {c.billing_address ? `· ${c.billing_address}` : ''}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-amber-700" />}
                  </div>
                )
              })}

              {isNew && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsOpen(false)
                  }}
                  className="border-t border-stone-100 px-3 py-2 text-xs text-amber-800 hover:bg-amber-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-amber-600" />
                  <span>Use custom name: &ldquo;{typed}&rdquo;</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
