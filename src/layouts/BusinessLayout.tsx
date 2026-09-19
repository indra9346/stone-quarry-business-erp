import { Link, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, ArrowLeftRight } from 'lucide-react'
import { useBusinessContext } from '@/features/auth/BusinessContext'

/**
 * Business identity must remain visible everywhere inside a business portal
 * (spec section 5): header, sidebar, dashboard, bills, PDFs, etc. This shell
 * is the one place that renders it, so every page inherits it consistently.
 */
export default function BusinessLayout() {
  const { profile, role, signOut } = useBusinessContext()
  const navigate = useNavigate()

  async function handleLeave() {
    // "Leave Business" — return to the gateway without ending the business
    // session outright (Rule #36). Full sign-out is a separate action.
    navigate('/')
  }

  async function handleLogout() {
    await signOut()
    navigate(`/business/${profile.code}`)
  }

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-navy-950/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-navy-800 text-xs font-bold text-amber-400 ring-1 ring-white/10">
            {profile.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-slate-100">{profile.name}</p>
            <p className="mt-0.5 text-[11px] leading-none text-slate-500">
              Business Management Portal{role ? ` · ${role}` : ''}
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 text-xs">
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Leave {profile.name.split(' ')[0]} Panel
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

// Placeholder brand link used before sidebar navigation modules are built.
export function BrandHome({ code }: { code: string }) {
  return (
    <Link to={`/business/${code}/dashboard`} className="text-sm text-slate-300">
      Dashboard
    </Link>
  )
}
