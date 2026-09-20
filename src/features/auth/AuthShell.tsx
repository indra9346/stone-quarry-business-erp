import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useBusinessContext } from './businessContextValue'
import Backdrop from '@/components/Backdrop'
import { useDarkPage } from '@/hooks/useDarkPage'

/** Frame shared by every pre-login screen of a business portal. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { profile } = useBusinessContext()
  useDarkPage()
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Backdrop className="fixed h-[100lvh]" image="/media/quarry-gateway.webp" video="quarry-gateway" position="65% 50%" />
      <div className="relative w-full max-w-sm animate-rise">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-stone-300 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Central gateway
        </Link>

        <div className="rounded-lg bg-white p-7 shadow-lift">
          <div className="mb-5 border-l-4 border-amber-500 pl-3">
            <p className="text-base font-semibold leading-tight text-stone-900">{profile.name}</p>
            <p className="text-xs text-stone-500">{profile.legalName}</p>
          </div>
          <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
