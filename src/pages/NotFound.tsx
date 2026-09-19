import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export default function NotFound({ inShell }: { inShell?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', inShell ? 'py-24 text-stone-600' : 'min-h-screen bg-navy-950 text-stone-300')}>
      <p className="text-sm text-stone-500">404</p>
      <p className="text-lg font-semibold">Page not found</p>
      <Link to={inShell ? '../dashboard' : '/'} className={cn('text-sm hover:underline', inShell ? 'text-amber-800' : 'text-amber-400')}>
        {inShell ? 'Back to dashboard' : 'Return to the central gateway'}
      </Link>
    </div>
  )
}
