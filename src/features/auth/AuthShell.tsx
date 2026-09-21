import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'
import Backdrop from '@/components/Backdrop'
import { useDarkPage } from '@/hooks/useDarkPage'

/** Frame shared by every pre-login screen of a business portal. */
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const { profile } = useBusinessContext()
  useDarkPage()

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Backdrop
        className="fixed h-[100lvh]"
        image="/media/quarry-gateway.webp"
        video="quarry-gateway"
        position="65% 50%"
        showPromotionalBadges={true}
      />

      <div className="relative w-full max-w-md animate-rise">
        {/* Navigation pill back to gateway */}
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-stone-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-amber-700 hover:shadow-md"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Central gateway</span>
        </Link>

        {/* Crisp Frosted Glass Card - Zero black */}
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-7 shadow-2xl backdrop-blur-lg sm:p-8">
          {/* Top Amber Accent */}
          <div className="-mx-7 -mt-7 mb-6 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 sm:-mx-8 sm:-mt-8" />

          <div className="mb-6 flex items-center justify-between border-b border-stone-100 pb-5">
            <div>
              <p className="text-lg font-bold leading-tight text-slate-900">{profile.name}</p>
              <p className="text-xs font-medium text-slate-500">{profile.legalName}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-sm font-bold text-white shadow-sm ring-1 ring-white">
              {profile.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secure Business Workspace</span>
          </div>

          <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p>}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
