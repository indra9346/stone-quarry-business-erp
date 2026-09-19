import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-950 text-slate-300">
      <p className="text-sm text-slate-500">404</p>
      <p>Page not found.</p>
      <Link to="/" className="text-sm text-amber-400 hover:underline">
        Return to Central Gateway
      </Link>
    </div>
  )
}
