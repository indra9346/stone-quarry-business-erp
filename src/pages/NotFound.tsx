import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function NotFound({ inShell }: { inShell?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', inShell ? 'py-24 text-stone-600' : 'min-h-screen stone-bg text-slate-800')}>
      <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">404</p>
      <p className="text-xl font-bold text-slate-900">Page not found</p>
      <Link to={inShell ? '../dashboard' : '/'} className="text-sm font-semibold text-amber-700 hover:text-amber-900 hover:underline">
        {inShell ? 'Back to dashboard' : 'Return to the central gateway'}
      </Link>
    </div>
  )
}
