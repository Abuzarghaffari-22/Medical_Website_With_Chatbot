import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function MainLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/#services', label: 'Services' },
    { to: '/#about', label: 'About' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 glass border-b border-slate-200/70">
        <div className="page-container">
          <nav className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-600 to-teal-500 flex items-center justify-center shadow-sm group-hover:shadow-glow transition-shadow duration-300">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="font-display font-semibold text-slate-900 text-lg">MediCare</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <a key={link.to} href={link.to}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all duration-150">
                  {link.label}
                </a>
              ))}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="btn-md btn-primary">
                  Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn-md btn-ghost">Sign in</Link>
                  <Link to="/register" className="btn-md btn-primary">Get started</Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </nav>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white animate-slide-down">
            <div className="page-container py-4 flex flex-col gap-1">
              {navLinks.map(link => (
                <a key={link.to} href={link.to}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl"
                  onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-3 border-t border-slate-100 flex flex-col gap-2">
                {user ? (
                  <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="btn-md btn-primary w-full text-center">Dashboard</Link>
                ) : (
                  <>
                    <Link to="/login" className="btn-md btn-secondary w-full text-center">Sign in</Link>
                    <Link to="/register" className="btn-md btn-primary w-full text-center">Get started</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="page-container py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-teal-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="font-display font-semibold text-slate-900">MediCare Clinic</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                AI-powered healthcare for the modern era. Book appointments, chat with our AI health assistant, and manage your health journey.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link to="/" className="hover:text-primary-600">Home</Link></li>
                <li><Link to="/register" className="hover:text-primary-600">Register</Link></li>
                <li><Link to="/login" className="hover:text-primary-600">Patient Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-3">Contact</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>📞 {import.meta.env.VITE_CLINIC_PHONE || '+1-800-MEDICARE'}</li>
                <li>📧 {import.meta.env.VITE_CLINIC_EMAIL || 'info@medicareclinic.com'}</li>
                <li>📍 123 Health Ave, Medical City</li>
                <li className="text-xs pt-1">Mon–Fri: 8AM–6PM</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} MediCare Clinic. All rights reserved. &nbsp;|&nbsp; Not for emergency use — call 911.
          </div>
        </div>
      </footer>
    </div>
  )
}