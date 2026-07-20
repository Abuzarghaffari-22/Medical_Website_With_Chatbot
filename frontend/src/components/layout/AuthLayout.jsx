import { Link } from 'react-router-dom'

/**
 * Split-screen layout for all auth pages.
 * Left panel: gradient brand panel with quote.
 * Right panel: form area.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ─── Left Brand Panel (desktop only) ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-40" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-white font-display font-semibold text-xl">MediCare</span>
          </Link>

          <div>
            <blockquote className="text-white/90 text-2xl font-display leading-relaxed mb-6">
              "Healthcare that understands you — not just your symptoms."
            </blockquote>
            <div className="flex gap-6">
              {[
                { icon: '🤖', text: 'AI-Powered Guidance' },
                { icon: '🔒', text: 'HIPAA Compliant' },
                { icon: '⚡', text: 'Instant Triage' },
              ].map(f => (
                <div key={f.text} className="flex flex-col items-center gap-1 text-center">
                  <span className="text-2xl">{f.icon}</span>
                  <p className="text-white/70 text-xs">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-xs">🚨 For emergencies, always call 911 immediately.</p>
        </div>
      </div>

      {/* ─── Right Form Panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop — shown in left panel) */}
          <div className="mb-6 lg:hidden">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-teal-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="font-display font-semibold text-slate-900">MediCare</span>
            </Link>
          </div>

          <div className="animate-slide-up">
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">{title}</h2>
            <p className="text-slate-500 text-sm mb-6">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}