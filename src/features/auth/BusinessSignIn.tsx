import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'

/** LEVEL 1 -> LEVEL 2 transition: Business Authentication (spec section 5). */
export default function BusinessSignIn() {
  const { profile, configured, session, loading, signIn } = useBusinessContext()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (session) return <Navigate to={`/business/${profile.code}/dashboard`} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate(`/business/${profile.code}/dashboard`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-6">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Central Gateway
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-amber-400">{profile.tagline}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">{profile.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Secure Business Gateway</p>
        </div>

        {!configured ? (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
            This business portal has no Supabase project connected yet. Add{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs">
              VITE_{profile.code.toUpperCase()}_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-xs">
              VITE_{profile.code.toUpperCase()}_SUPABASE_ANON_KEY
            </code>{' '}
            to your <code className="rounded bg-black/30 px-1 py-0.5 text-xs">.env.local</code>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-graphite-900 px-3 py-2 text-sm text-slate-100 outline-none ring-amber-500/40 focus:ring-2"
                autoComplete="email"
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium text-slate-400"
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-graphite-900 px-3 py-2 text-sm text-slate-100 outline-none ring-amber-500/40 focus:ring-2"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : `Sign in to ${profile.name.split(' ')[0]} Panel`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
