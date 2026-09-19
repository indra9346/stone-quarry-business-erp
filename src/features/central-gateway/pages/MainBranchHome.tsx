import { Link } from 'react-router-dom'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import { cn } from '@/lib/utils'

/**
 * Central gateway. Static business metadata only — no operational data is
 * fetched here, and no business is entered implicitly: the user picks one,
 * which selects that business's own isolated Supabase project.
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
            const configured = isBusinessConfigured(code)
            const inner = (
              <div className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="text-lg font-medium text-stone-100">{b.name}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{b.location ?? b.legalName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className={cn('flex items-center gap-2 text-xs', configured ? 'text-emerald-400' : 'text-stone-500')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', configured ? 'bg-emerald-400' : 'bg-stone-600')} aria-hidden />
                    {configured ? 'Connected' : 'Configuration pending'}
                  </span>
                  {configured && <span className="text-sm font-medium text-amber-500">Enter →</span>}
                </div>
              </div>
            )
            return (
              <li key={code}>
                {configured ? (
                  <Link to={`/business/${code}`} className="-mx-3 block rounded px-3 transition-colors hover:bg-white/5">
                    {inner}
                  </Link>
                ) : (
                  <div aria-disabled className="-mx-3 px-3 opacity-70">
                    {inner}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
