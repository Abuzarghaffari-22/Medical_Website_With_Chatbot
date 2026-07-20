import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md animate-slide-up">
        {/* Decorative */}
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-600 to-teal-500 flex items-center justify-center mx-auto shadow-glow">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="absolute -top-2 -right-2 text-3xl">🔍</span>
        </div>

        <h1 className="text-6xl font-display font-bold gradient-text mb-3">404</h1>
        <h2 className="text-2xl font-display font-semibold text-slate-800 mb-3">Page not found</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-md btn-secondary">
            ← Go back
          </button>
          <Link to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/'} className="btn-md btn-primary">
            {user ? 'Go to Dashboard' : 'Go Home'}
          </Link>
        </div>

        {/* Emergency reminder */}
        <div className="mt-10 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          🚨 If you're experiencing a medical emergency, call <strong>911</strong> immediately — do not use this app.
        </div>
      </div>
    </div>
  )
}