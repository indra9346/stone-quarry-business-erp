import { useState, type ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Textarea } from './form'

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -transtone-x-1/2 -transtone-y-1/2 flex-col rounded-lg bg-white shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-stone-900">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-0.5 text-sm text-stone-500">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600" aria-label="Close">
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'primary',
  reasonLabel,
  busy,
  error,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  tone?: 'primary' | 'danger'
  /** When set, a mandatory free-text reason is collected and passed to onConfirm. */
  reasonLabel?: string
  busy?: boolean
  error?: string | null
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const needsReason = !!reasonLabel
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason('')
        onOpenChange(o)
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Back
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            disabled={needsReason && reason.trim() === ''}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="text-sm text-stone-600">{description}</div>}
      {needsReason && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="confirm-reason">
            {reasonLabel}
          </label>
          <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
