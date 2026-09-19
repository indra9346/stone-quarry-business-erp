import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBusinessContext } from './businessContextValue'
import AuthShell from './AuthShell'
import { Button } from '@/components/ui/Button'
import { FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/ui/feedback'

/** Landing page of the emailed reset link (Supabase signs the user in with a recovery session). */
export default function ResetPassword() {
  const { code, accessState, session, updatePassword, signOut } = useBusinessContext()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (accessState === 'loading') {
    return (
      <AuthShell title="Verifying reset link…">
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell title="Reset link invalid" subtitle="The link is missing, expired or already used.">
        <Link to={`/business/${code}/forgot-password`} className="text-sm text-cyan-700 hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) return setError(error)
    await signOut()
    navigate(`/business/${code}`, { replace: true })
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <FormField label="New password" required hint="At least 8 characters.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </FormField>
        <FormField label="Confirm password" required>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </FormField>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="accent" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
