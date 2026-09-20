import { Link } from 'react-router-dom'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import Backdrop from '@/components/Backdrop'
import { cn } from '@/lib/utils'

/**
 * Central gateway. Static business metadata only — no operational data is
 * fetched here, and no business is entered implicitly: the user picks one,
 * which selects that business's own isolated Supabase project.
 *
 * A business whose database is not connected in this installation shows a
 * neutral "Database not connected" status and opens an informational page —
 * never another business's data.
 */
export default function MainBranchHome() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Backdrop image="/media/quarry-gateway.webp" video="quarry-gateway" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-10">
        <header className="flex animate-rise items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-amber-500 text-sm font-bold text-navy-950">SQ</span>
          <span className="text-sm font-semibold tracking-wide text-stone-200">StoneQuarryERP</span>
        </header>

        <main className="flex flex-1 flex-col justify-center py-14">
          <p className="animate-rise text-sm font-medium text-amber-400" style={{ animationDelay: '80ms' }}>
            Quarry · Stone · Factory operations
          </p>
          <h1 className="mt-3 max-w-2xl animate-rise text-4xl font-semibold leading-tight text-white sm:text-5xl" style={{ animationDelay: '160ms' }}>
            From the quarry face to the finished stone.
          </h1>
          <p className="mt-4 max-w-xl animate-rise text-base text-stone-300" style={{ animationDelay: '240ms' }}>
            Choose a business to continue. Each one runs on its own database with its own logins, so signing in to one gives no access to the other.
          </p>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {BUSINESS_CODES.map((code, i) => {
              const b = BUSINESS_REGISTRY[code]
              const connected = isBusinessConfigured(code)
              return (
                <li key={code} className="animate-rise" style={{ animationDelay: `${320 + i * 90}ms` }}>
                  <Link
                    to={`/business/${code}`}
                    className="group block h-full rounded-lg border border-white/10 bg-navy-900/70 p-6 shadow-lift backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/50 hover:bg-navy-900/85"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded bg-navy-700 text-base font-bold tracking-wide text-amber-400 ring-1 ring-white/10">
                        {b.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <span className={cn('flex items-center gap-2 text-xs', connected ? 'text-emerald-400' : 'text-stone-400')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-stone-500')} aria-hidden />
                        {connected ? 'Database connected' : 'Database not connected'}
                      </span>
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-white">{b.name}</h2>
                    <p className="mt-1 text-sm text-stone-400">
                      {connected ? (b.location ?? b.legalName) : 'Operational workspace is not yet provisioned.'}
                    </p>
                    <p className={cn('mt-6 text-sm font-medium transition-transform duration-300 group-hover:translate-x-1', connected ? 'text-amber-400' : 'text-stone-400')}>
                      {connected ? 'Enter business →' : 'View details →'}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </main>

        <footer className="animate-rise pb-2 text-xs text-stone-500" style={{ animationDelay: '600ms' }}>
          Secure, isolated business databases · Indian business formats (₹, DD-MM-YYYY)
        </footer>
      </div>
    </div>
  )
}
