import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mountain } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'

/** Dark "command" frame shared by every pre-login screen of a business portal. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { profile } = useBusinessContext()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 45% at 50% 0%, rgba(232,162,39,0.10) 0%, rgba(5,10,20,0) 70%)' }}
      />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="h-3.5 w-3.5" /> Central gateway
        </Link>

        <div className="rounded-lg bg-white p-7 shadow-lift">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy-800 text-amber-400 ring-1 ring-white/10">
              <Mountain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">{profile.tagline}</p>
              <p className="text-base font-semibold leading-tight text-slate-900">{profile.name}</p>
            </div>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Secure, isolated portal — {profile.name} data is stored separately from every other business.
        </p>
      </div>
    </div>
  )
}
