import { Link } from 'react-router-dom'
import { BUSINESS_CODES, BUSINESS_REGISTRY } from '@/types/business'
import { isBusinessConfigured } from '@/lib/supabase/business-client'
import Backdrop from '@/components/Backdrop'
import { cn } from '@/lib/utils'
import { useDarkPage } from '@/hooks/useDarkPage'
import { ArrowRight } from 'lucide-react'

/**
 * Central gateway.
 * Minimalist, elegant Cream & Gold aesthetic.
 * Strictly 1 big quote and the 2 business selection cards.
 */
export default function MainBranchHome() {
  useDarkPage()

  return (
    <div className="relative min-h-screen bg-[#faf7f2] overflow-x-clip text-[#2d261e]">
      <Backdrop className="fixed h-[100lvh]" image="/media/quarry-gateway.webp" />

      {/* Clean Cream & Gold Header */}
      <header className="sticky top-0 z-20 border-b border-[#e8dfcf] bg-[#fdfbf7]/90 px-6 py-4 shadow-xs backdrop-blur-md sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/favicon-192.png"
              alt=""
              width={38}
              height={38}
              className="h-9.5 w-9.5 rounded-lg bg-[#fae5a3]/40 p-1 ring-1 ring-[#d4af37]/40"
            />
            <span className="text-lg font-bold tracking-tight text-[#2d261e]">
              StoneQuarry<span className="text-[#b8860b]">ERP</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-[#8c6d1f]">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
            <span>Operational</span>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-center px-6 py-10 sm:px-10 sm:py-16">
        <main className="flex flex-col items-center text-center">
          {/* 1 Big Quote */}
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-[#241e17] sm:text-5xl sm:leading-tight">
            “From the quarry face to the <span className="text-[#b8860b]">finished stone</span>.”
          </h1>

          {/* Only 2 Business Selection Cards */}
          <ul className="mt-10 grid w-full gap-6 sm:mt-12 sm:grid-cols-2 text-left">
            {BUSINESS_CODES.map((code) => {
              const b = BUSINESS_REGISTRY[code]
              const connected = isBusinessConfigured(code)
              return (
                <li key={code}>
                  <Link
                    to={`/business/${code}`}
                    className="group relative block h-full overflow-hidden rounded-2xl border-2 border-[#e3d5be] bg-[#fdfcf9] p-7 shadow-[0_8px_24px_-6px_rgba(184,134,11,0.12)] transition-all duration-200 hover:-translate-y-1 hover:border-[#d4af37] hover:shadow-[0_16px_32px_-8px_rgba(184,134,11,0.22)]"
                  >
                    {/* Top Gold Accent Bar */}
                    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#e5c875] via-[#d4af37] to-[#b8860b]" />

                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] via-[#c59b27] to-[#a87a15] text-base font-bold tracking-wide text-white shadow-md ring-2 ring-white">
                        {b.name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>

                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          connected
                            ? 'bg-[#ecfdf5] text-[#065f46] ring-1 ring-[#10b981]/30'
                            : 'bg-[#f4efe6] text-[#786c5e] ring-1 ring-[#d8cfbe]',
                        )}
                      >
                        <span
                          className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-[#10b981]' : 'bg-[#94877a]')}
                          aria-hidden
                        />
                        {connected ? 'Database online' : 'Standby mode'}
                      </span>
                    </div>

                    <h2 className="mt-5 text-2xl font-bold text-[#241e17] transition-colors group-hover:text-[#996515]">
                      {b.name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-[#6e6153]">
                      {connected ? (b.location ?? b.legalName) : 'Operational workspace is not yet provisioned.'}
                    </p>

                    <div className="mt-8 flex items-center justify-between border-t border-[#f0e8dc] pt-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#998b7a]">
                        {b.legalName}
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1 text-sm font-bold transition-transform duration-200 group-hover:translate-x-1',
                          connected ? 'text-[#a87a15]' : 'text-[#8a7c6c]',
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
