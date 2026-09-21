import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'
import Backdrop from '@/components/Backdrop'
import { useDarkPage } from '@/hooks/useDarkPage'

/** Frame shared by every pre-login screen of a business portal in Cream & Gold aesthetic. */
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf7f2] px-4 py-10">
      <Backdrop
        className="fixed h-[100lvh]"
        image="/media/quarry-gateway.webp"
        position="65% 50%"
      />

      <div className="relative w-full max-w-md">
        {/* Navigation pill back to gateway */}
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#e0d4c1] bg-[#fdfcf9]/95 px-4 py-1.5 text-xs font-bold text-[#3d342a] shadow-xs transition-all hover:bg-white hover:text-[#996515] hover:shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Central gateway</span>
        </Link>

        {/* Creamy & Gold Card */}
        <div className="overflow-hidden rounded-2xl border-2 border-[#e3d5be] bg-[#fdfcf9] p-7 shadow-[0_12px_32px_-8px_rgba(184,134,11,0.14)] sm:p-8">
          {/* Top Gold Accent Bar */}
          <div className="-mx-7 -mt-7 mb-6 h-1.5 bg-gradient-to-r from-[#e5c875] via-[#d4af37] to-[#b8860b] sm:-mx-8 sm:-mt-8" />

          <div className="mb-6 flex items-center justify-between border-b border-[#f0e8dc] pb-5">
            <div>
              <p className="text-lg font-bold leading-tight text-[#241e17]">{profile.name}</p>
              <p className="text-xs font-medium text-[#786c5e]">{profile.legalName}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] via-[#c59b27] to-[#a87a15] text-sm font-bold text-white shadow-sm ring-2 ring-white">
              {profile.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[#996515]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secure Business Workspace</span>
          </div>

          <h1 className="mt-1.5 text-xl font-bold text-[#241e17]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-[#6e6153]">{subtitle}</p>}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
