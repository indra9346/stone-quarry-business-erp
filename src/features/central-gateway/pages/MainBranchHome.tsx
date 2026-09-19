import { Link } from 'react-router-dom'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'

/**
 * Central gateway. Static business metadata only — no operational data is
 * fetched here, and no business is entered implicitly: the user picks one,
 * which selects that business's own isolated Supabase project.
 *
 * Every registered business is listed. A business whose database is not
 * connected in this installation (its VITE_<CODE>_SUPABASE_* variables are
 * absent) is shown with a neutral "Database not connected" status and opens an
 * informational page — never another business's data.
 */
export default function MainBranchHome() {
  return (
    <div className="min-h-screen bg-navy-950 px-5 py-12 sm:px-10 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold text-amber-500">StoneQuarryERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-100">Choose a business</h1>
        <p className="mt-2 max-w-lg text-sm text-stone-400">
          Each business has its own database and its own logins. Signing in to one gives no access to the other.
        </p>

        <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {BUSINESS_CODES.map((code) => {
            const b = BUSINESS_REGISTRY[code]
            const connected = isBusinessConfigured(code)
            return (
              <li key={code}>
                <Link to={`/business/${code}`} className="-mx-3 block rounded px-3 transition-colors hover:bg-white/5">
                  <div className="flex items-center justify-between gap-4 py-5">
                    <div>
                      <p className="text-lg font-medium text-stone-100">{b.name}</p>
                      <p className="mt-0.5 text-sm text-stone-500">
                        {connected ? (b.location ?? b.legalName) : 'Operational workspace is not yet provisioned.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className={cn('flex items-center gap-2 text-xs', connected ? 'text-emerald-400' : 'text-stone-400')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-stone-500')} aria-hidden />
                        {connected ? 'Database connected' : 'Database not connected'}
                      </span>
                      <span className={cn('text-sm font-medium', connected ? 'text-amber-500' : 'text-stone-400')}>
                        {connected ? 'Enter →' : 'Details →'}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
