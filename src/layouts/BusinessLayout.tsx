import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Bell, ChevronDown, LogOut, Menu, Repeat, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navFor, NAV_GROUPS } from '@/config/navigation'
import { useBusinessContext } from '@/features/auth/businessContextValue'
import { useAlerts } from '@/hooks/useAlerts'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * The ERP shell. The business identity (name + monogram + the word "KMG"/
 * "Murudeshwara" in the URL) is visible on every screen so a user always knows
 * which isolated database they are working in.
 */
export default function BusinessLayout() {
  const { profile, code, role, isAdmin, can, fullName, email, signOut } = useBusinessContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const [search, setSearch] = useState('')
  const alerts = useAlerts()

  useEffect(() => setDrawer(false), [location.pathname])

  const section = location.pathname.split('/')[3] ?? 'dashboard'
  const sectionLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.to === section)?.label ?? 'Workspace'

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (q) navigate(`/business/${code}/bills?q=${encodeURIComponent(q)}`)
  }

  async function handleLogout() {
    await signOut()
    navigate(`/business/${code}`)
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 text-slate-200 border-r border-slate-700/60 shadow-lg">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-xs font-bold tracking-wide text-white shadow-xs">
          {initials(profile.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{profile.name}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden /> Live database
          </p>
        </div>
      </div>

      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {navFor(isAdmin, can).map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={`/business/${code}/${to}`}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-amber-500/15 font-semibold text-amber-300 shadow-[inset_3px_0_0_0_#e8a227]'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-white/5 px-2.5 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
            {initials(fullName ?? email ?? '?')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{fullName ?? email}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">{role}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="stone-bg min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-fade-up shadow-lift">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-2 text-stone-600 hover:bg-stone-100 lg:hidden"
            onClick={() => setDrawer((d) => !d)}
            aria-label={drawer ? 'Close menu' : 'Open menu'}
          >
            {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
            <span className="font-medium text-stone-900">{profile.name}</span>
            <span className="text-stone-300">/</span>
            <span className="truncate text-stone-500">{sectionLabel}</span>
          </div>

          <form onSubmit={onSearch} className={cn('relative ml-auto w-full max-w-xs', !can('bills') && 'invisible')} role="search" aria-hidden={!can('bills')}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bills by number…"
              aria-label="Search bills by number"
              className="h-9 w-full rounded-md border-0 bg-stone-100 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-amber-500"
            />
          </form>

          <Dropdown.Root>
            <Dropdown.Trigger className="relative rounded-md p-2 text-stone-600 hover:bg-stone-100" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {alerts.items.length > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-slate-900 shadow-xs">
                  {alerts.items.length}
                </span>
              )}
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={8} className="z-50 w-72 rounded-lg bg-white p-1.5 shadow-lift ring-1 ring-stone-200">
                <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">Alerts</p>
                {alerts.items.length === 0 ? (
                  <p className="px-2.5 py-3 text-sm text-stone-500">Nothing needs attention.</p>
                ) : (
                  alerts.items.map((a) => (
                    <Dropdown.Item
                      key={a.id}
                      onSelect={() => navigate(`/business/${code}/${a.to}`)}
                      className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-stone-700 outline-none data-[highlighted]:bg-stone-100"
                    >
                      {a.message}
                    </Dropdown.Item>
                  ))
                )}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>

          <Dropdown.Root>
            <Dropdown.Trigger className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-stone-100" aria-label="User menu">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
                {initials(fullName ?? email ?? '?')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={8} className="z-50 w-60 rounded-lg bg-white p-1.5 shadow-lift ring-1 ring-stone-200">
                <div className="border-b border-stone-100 px-2.5 py-2">
                  <p className="truncate text-sm font-medium text-stone-900">{fullName ?? email}</p>
                  <p className="truncate text-xs text-stone-500">{email}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">{role}</p>
                </div>
                <Dropdown.Item onSelect={() => navigate('/')} className="mt-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-stone-700 outline-none data-[highlighted]:bg-stone-100">
                  <Repeat className="h-4 w-4" /> Switch business
                </Dropdown.Item>
                <Dropdown.Item onSelect={() => void handleLogout()} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sign out
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
