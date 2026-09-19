import { Link } from 'react-router-dom'
import { ArrowUpRight, Lock, Mountain, ShieldCheck } from 'lucide-react'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'

/**
 * Central Gateway. Static, non-sensitive business metadata only — no
 * operational data is fetched here, and no business is entered implicitly:
 * the user must explicitly choose one, which selects that business's own
 * isolated Supabase project.
 */
export default function MainBranchHome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(232,162,39,0.10) 0%, rgba(5,10,20,0) 70%)' }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center px-5 py-14 sm:py-20">
        <header className="mb-12 animate-fade-up text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-navy-800 text-amber-400 ring-1 ring-white/10">
            <Mountain className="h-6 w-6" />
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Central operations gateway
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">StoneQuarryERP</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
            Choose a business to enter. Each one runs on its own isolated database — nothing is shared between them.
          </p>
        </header>

        <div className="grid w-full gap-5 sm:grid-cols-2">
          {BUSINESS_CODES.map((code, i) => {
            const b = BUSINESS_REGISTRY[code]
            const configured = isBusinessConfigured(code)
            const card = (
              <>
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-navy-700 text-sm font-bold tracking-wide text-amber-400 ring-1 ring-white/10">
                    {b.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset',
                      configured ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', configured ? 'bg-emerald-400' : 'bg-slate-500')} aria-hidden />
                    {configured ? 'Database connected' : 'Configuration pending'}
                  </span>
                </div>

                <h2 className="mt-6 text-xl font-semibold text-white">{b.name}</h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-500">{b.tagline}</p>
                {b.location && <p className="mt-3 text-sm text-slate-400">{b.location}</p>}

                <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5" /> Isolated data
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1 text-sm font-medium transition-colors',
                      configured ? 'text-slate-100 group-hover:text-amber-400' : 'text-slate-500',
                    )}
                  >
                    {configured ? 'Enter business' : 'Not available yet'}
                    {configured && <ArrowUpRight className="h-4 w-4" />}
                  </span>
                </div>
              </>
            )
            const cls =
              'group relative animate-fade-up overflow-hidden rounded-lg border border-white/10 bg-graphite-900/70 p-6 backdrop-blur transition-all duration-200'
            return configured ? (
              <Link
                key={code}
                to={`/business/${code}`}
                style={{ animationDelay: `${i * 70}ms` }}
                className={cn(cls, 'hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)]')}
              >
                {card}
              </Link>
            ) : (
              <div key={code} aria-disabled style={{ animationDelay: `${i * 70}ms` }} className={cn(cls, 'opacity-80')}>
                {card}
              </div>
            )
          })}
        </div>

        <p className="mt-14 text-center text-xs text-slate-600">
          Data never crosses between businesses. Access is granted per business by its own administrators.
        </p>
      </div>
    </div>
  )
}
