import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
  sublabel?: string
}

export interface SearchableSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
  emptyMessage?: string
  ariaLabel?: string
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Search or select...',
  disabled = false,
  className,
  allowClear = true,
  emptyMessage = 'No matching options',
  ariaLabel,
}: SearchableSelectProps) {
  const generatedId = useId()
  const inputId = id || generatedId
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  )

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(term))
    )
  }, [options, searchTerm])

  // Sync search input when selected value changes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : '')
    }
  }, [selectedOption, isOpen])

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchTerm(selectedOption ? selectedOption.label : '')
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, selectedOption])

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  function handleSelect(opt: SearchableOption) {
    onChange(opt.value)
    setSearchTerm(opt.label)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
        setSearchTerm('')
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredOptions.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm(selectedOption ? selectedOption.label : '')
        break
      case 'Tab':
        setIsOpen(false)
        setSearchTerm(selectedOption ? selectedOption.label : '')
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Input container */}
      <div
        className={cn(
          'relative flex h-9 w-full items-center rounded-md bg-white shadow-sm ring-1 ring-inset ring-stone-300 transition-colors focus-within:ring-2 focus-within:ring-amber-500',
          disabled && 'cursor-not-allowed bg-stone-100 opacity-70'
        )}
      >
        <div className="pointer-events-none pl-2.5 text-stone-400">
          <Search className="h-3.5 w-3.5" />
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={searchTerm}
          disabled={disabled}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          aria-label={ariaLabel || placeholder}
          autoComplete="off"
          onFocus={() => {
            setIsOpen(true)
            setSearchTerm('')
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="h-full w-full bg-transparent px-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none disabled:cursor-not-allowed"
        />

        <div className="flex items-center gap-1 pr-1.5">
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              title="Clear selection"
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
                setSearchTerm(selectedOption ? selectedOption.label : '')
              } else {
                setIsOpen(true)
                setSearchTerm('')
                inputRef.current?.focus()
              }
            }}
            className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed"
            title="Toggle dropdown"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', isOpen && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-center text-xs text-stone-500">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlightedIndex
              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault() // prevent input blur
                    handleSelect(opt)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors',
                    isHighlighted ? 'bg-amber-50 text-amber-900' : 'text-stone-800',
                    isSelected && 'font-semibold'
                  )}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="truncate text-[10px] text-stone-400">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
