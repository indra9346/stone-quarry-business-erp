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
 * The ERP shell in Cream & Gold aesthetic.
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
    <div className="flex h-full flex-col bg-[#f7f3eb] text-[#3d342a] border-r border-[#e5dac8] shadow-sm">
      <div className="flex items-center gap-3 border-b border-[#e5dac8] bg-[#fbf9f4] px-4 py-4.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] via-[#c59b27] to-[#a87a15] text-xs font-extrabold tracking-wide text-white shadow-sm ring-1 ring-[#d4af37]/40">
          {initials(profile.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#241e17]">{profile.name}</p>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" aria-hidden /> Live database
          </p>
        </div>
      </div>

      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main">
        {navFor(isAdmin, can).map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-widest text-[#8c7e6e]">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={`/business/${code}/${to}`}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150',
                        isActive
                          ? 'bg-[#ebdcb8] font-bold text-[#7d5604] border-l-3 border-[#c59b27] shadow-xs'
                          : 'text-[#54483b] hover:bg-[#efe7d8] hover:text-[#241e17] font-medium',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#a87a15]" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#e5dac8] bg-[#fbf9f4] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-[#f0e8da] px-2.5 py-2 border border-[#e2d5c1]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-xs font-bold text-white shadow-xs">
            {initials(fullName ?? email ?? '?')}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#241e17]">{fullName ?? email}</p>
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#996515]">{role}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="stone-bg min-h-screen bg-[#faf7f2] text-[#2d261e]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-[#3d342a]/40 backdrop-blur-xs" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] animate-fade-up shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-[#e8dfcf] bg-[#fdfcf9]/95 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            className="rounded-lg p-2 text-[#54483b] hover:bg-[#efe7d8] lg:hidden"
            onClick={() => setDrawer((d) => !d)}
            aria-label={drawer ? 'Close menu' : 'Open menu'}
          >
            {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
            <span className="font-bold text-[#241e17]">{profile.name}</span>
            <span className="text-[#c5b9a7]">/</span>
            <span className="truncate text-[#786c5e] font-medium">{sectionLabel}</span>
          </div>

          <form onSubmit={onSearch} className={cn('relative ml-auto w-full max-w-xs', !can('bills') && 'invisible')} role="search" aria-hidden={!can('bills')}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c7e6e]" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bills by number…"
              aria-label="Search bills by number"
              className="h-9 w-full rounded-lg border border-[#e0d4c1] bg-[#f7f2e8] pl-9 pr-3 text-sm text-[#241e17] placeholder:text-[#8c7e6e] focus:bg-white focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30"
            />
          </form>

          <Dropdown.Root>
            <Dropdown.Trigger className="relative rounded-lg p-2 text-[#54483b] hover:bg-[#efe7d8]" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {alerts.items.length > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4af37] px-1 text-[10px] font-extrabold text-white shadow-xs">
                  {alerts.items.length}
                </span>
              )}
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={8} className="z-50 w-72 rounded-xl bg-[#fdfcf9] p-1.5 shadow-xl ring-1 ring-[#e5dac8]">
                <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-[#8c7e6e]">Alerts</p>
                {alerts.items.length === 0 ? (
                  <p className="px-2.5 py-3 text-sm text-[#786c5e]">Nothing needs attention.</p>
                ) : (
                  alerts.items.map((a) => (
                    <Dropdown.Item
                      key={a.id}
                      onSelect={() => navigate(`/business/${code}/${a.to}`)}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-[#3d342a] outline-none data-[highlighted]:bg-[#efe7d8]"
                    >
                      {a.message}
                    </Dropdown.Item>
                  ))
                )}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>

          <Dropdown.Root>
            <Dropdown.Trigger className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[#efe7d8]" aria-label="User menu">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-xs font-bold text-white shadow-xs">
                {initials(fullName ?? email ?? '?')}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#8c7e6e]" />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={8} className="z-50 w-60 rounded-xl bg-[#fdfcf9] p-1.5 shadow-xl ring-1 ring-[#e5dac8]">
                <div className="border-b border-[#f0e8dc] px-2.5 py-2">
                  <p className="truncate text-sm font-bold text-[#241e17]">{fullName ?? email}</p>
                  <p className="truncate text-xs text-[#786c5e]">{email}</p>
                  <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[#996515]">{role}</p>
                </div>
                <Dropdown.Item onSelect={() => navigate('/')} className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#3d342a] outline-none data-[highlighted]:bg-[#efe7d8]">
                  <Repeat className="h-4 w-4 text-[#a87a15]" /> Switch business
                </Dropdown.Item>
                <Dropdown.Item onSelect={() => void handleLogout()} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-600 outline-none data-[highlighted]:bg-red-50">
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
