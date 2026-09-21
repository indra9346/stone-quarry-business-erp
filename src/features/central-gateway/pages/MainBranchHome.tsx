import { Link } from 'react-router-dom'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import Backdrop from '@/components/Backdrop'
import { cn } from '@/lib/utils'
import { useDarkPage } from '@/hooks/useDarkPage'
import { ArrowRight, Layers, Truck, Cpu, FileText, CheckCircle2, ShieldCheck } from 'lucide-react'

/**
 * Central gateway. Static business metadata only — no operational data is
 * fetched here, and no business is entered implicitly: the user picks one,
 * which selects that business's own isolated Supabase project.
 *
 * Displays a realistic 3D quarry video background with zero black elements,
 * featuring clean frosted glassmorphism, software promotional highlights,
 * and live enterprise capability tags.
 */
export default function MainBranchHome() {
  useDarkPage()

  const promotionalFeatures = [
    { icon: Cpu, label: '3D Pit Telemetry & Yield Analytics' },
    { icon: Truck, label: 'Automated Weighbridge & Hauler Fleet Sync' },
    { icon: Layers, label: 'Granite / Marble Block Stockyard Tracking' },
    { icon: FileText, label: 'Instant EV Billing, Quotations & GST' },
  ]

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Backdrop
        className="fixed h-[100lvh]"
        image="/media/quarry-gateway.webp"
        video="quarry-gateway"
        showPromotionalBadges={true}
      />

      {/* Modern Frosted Glass Top Navigation Bar - Non-black */}
      <header className="sticky top-0 z-20 border-b border-stone-200/60 bg-white/80 px-6 py-3 shadow-xs backdrop-blur-md transition-all sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/favicon-192.png"
              alt=""
              width={38}
              height={38}
              className="h-9.5 w-9.5 rounded-lg bg-amber-500/10 p-1 ring-1 ring-amber-500/30"
            />
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                StoneQuarry<span className="text-amber-600">ERP</span>
              </span>
              <span className="ml-2 hidden rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 sm:inline-block">
                Enterprise 2026
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="hidden sm:inline">Quarry Cloud:</span>
            <span className="font-semibold text-emerald-700">Operational</span>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col px-6 pb-12 sm:px-10">
        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          {/* Software Promotion Badge */}
          <div className="animate-rise inline-flex items-center gap-2 self-start rounded-full border border-amber-300/80 bg-amber-50/90 px-3.5 py-1 text-xs font-semibold text-amber-800 shadow-xs backdrop-blur-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            <span>Heavy Industry ERP · Multi-Unit Architecture</span>
          </div>

          <h1
            className="mt-4 max-w-3xl animate-rise text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '120ms' }}
          >
            From the quarry face to the <span className="text-amber-600 underline decoration-amber-300 decoration-wavy decoration-2">finished stone</span>.
          </h1>

          <p
            className="mt-4 max-w-2xl animate-rise text-base font-medium text-slate-700 sm:text-lg"
            style={{ animationDelay: '200ms' }}
          >
            Unified command platform for stone quarries, primary sawing mills, and heavy fleet logistics.
            Select an isolated operational portal to manage live billing, stock, and ledger data.
          </p>

          {/* Software Promotion Highlights Strip */}
          <div
            className="mt-6 flex flex-wrap gap-2.5 animate-rise"
            style={{ animationDelay: '260ms' }}
          >
            {promotionalFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-md border border-stone-200/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs backdrop-blur-xs"
              >
                <feat.icon className="h-3.5 w-3.5 text-amber-600" />
                <span>{feat.label}</span>
              </div>
            ))}
          </div>

          {/* Business Selection Cards - Pristine Glassmorphism with Warm Stone Highlights */}
          <ul className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-2">
            {BUSINESS_CODES.map((code, i) => {
              const b = BUSINESS_REGISTRY[code]
              const connected = isBusinessConfigured(code)
              return (
                <li key={code} className="animate-rise" style={{ animationDelay: `${320 + i * 90}ms` }}>
                  <Link
                    to={`/business/${code}`}
                    className="group relative block h-full overflow-hidden rounded-xl border border-white/80 bg-white/90 p-6 shadow-lift backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:bg-white hover:shadow-2xl"
                  >
                    {/* Top ambient accent glow */}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 opacity-80" />

                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-base font-bold tracking-wide text-white shadow-md ring-2 ring-white">
                        {b.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          connected
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20'
                            : 'bg-stone-100 text-stone-600 ring-1 ring-stone-400/20',
                        )}
                      >
                        <span
                          className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-stone-400')}
                          aria-hidden
                        />
                        {connected ? 'Database online' : 'Standby mode'}
                      </span>
                    </div>

                    <h2 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      {b.name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-slate-600">
                      {connected ? (b.location ?? b.legalName) : 'Operational workspace is not yet provisioned.'}
                    </p>

                    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                        {b.legalName}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1 text-sm font-semibold transition-transform duration-300 group-hover:translate-x-1',
                          connected ? 'text-amber-700' : 'text-stone-500',
                        )}
                      >
                        {connected ? 'Enter portal' : 'View info'}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </main>
      </div>
    </div>
  )
}
