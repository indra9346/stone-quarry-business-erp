import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'
import NotProvisioned from './NotProvisioned'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/form'

export default function ForgotPassword() {
  const { code, requestPasswordReset, configured } = useBusinessContext()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!configured) return <NotProvisioned />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await requestPasswordReset(email.trim().toLowerCase())
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <AuthShell title="Reset your password" subtitle="We will email a secure reset link.">
      {sent ? (
        <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          If an account exists for {email}, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Email" required>
            {(p) => <Input {...p} type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />}
          </FormField>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="accent" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to={`/business/${code}`} className="text-sm text-amber-800 hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  )
}
