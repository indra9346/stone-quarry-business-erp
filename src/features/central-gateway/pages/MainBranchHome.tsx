import { Link } from 'react-router-dom'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'

/**
 * LEVEL 1 — Main Branch / Central Home UI (spec section 1-4).
 * Central Business / Quarry Selection Gateway — not a marketing page.
 * Loads only static, non-sensitive business metadata (Rule #34); no
 * operational data (sales, stock, ledger) is fetched here.
 */
export default function MainBranchHome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(232,162,39,0.08) 0%, rgba(5,10,20,0) 70%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center px-6 py-16">
        <header className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Central Operations Gateway
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Stone Business Panel
          </h1>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Select a business operation to enter its secure, independently governed portal.
          </p>
        </header>

        <div className="grid w-full gap-6 sm:grid-cols-2">
          {BUSINESS_CODES.map((code) => {
            const business = BUSINESS_REGISTRY[code]
            const configured = isBusinessConfigured(code)
            return (
              <Link
                key={code}
                to={`/business/${code}`}
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-graphite-900/60 p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-[0_0_0_1px_rgba(232,162,39,0.15),0_20px_40px_-15px_rgba(0,0,0,0.6)]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-navy-800 text-sm font-bold tracking-wide text-amber-400 ring-1 ring-white/10">
                  {business.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <h2 className="text-xl font-semibold text-slate-100">{business.name}</h2>
                <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                  {business.tagline}
                </p>
                {business.location && (
                  <p className="mt-3 text-sm text-slate-400">{business.location}</p>
                )}

                <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-5">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      configured ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        configured ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    {configured ? 'Portal online' : 'Awaiting configuration'}
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-200 transition-colors group-hover:text-amber-400">
                    Sign in to {business.name.split(' ')[0]} panel
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>

        <p className="mt-16 text-center text-xs text-slate-600">
          Each business operates on an isolated database. No data is shared between portals.
        </p>
      </div>
    </div>
  )
}
