import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner, FormField } from '../components/common'
import AuthLayout from '../components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm]       = useState({ name: '', email: '', password: '', phone: '' })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name?.trim() || form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Minimum 8 characters'
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      errs.password = 'Need uppercase, lowercase, and a number'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      await register(form)
      toast.success('Account created! Welcome to MediCare.')
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Password strength score 0–5
  const strength = (() => {
    const p = form.password
    if (!p) return 0
    let s = 0
    if (p.length >= 8)           s++
    if (/[A-Z]/.test(p))         s++
    if (/[a-z]/.test(p))         s++
    if (/\d/.test(p))            s++
    if (/[^A-Za-z0-9]/.test(p))  s++
    return s
  })()

  const strengthColors = ['', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500']
  const strengthLabels = ['', 'Weak', 'Fair', 'Fair', 'Good', 'Strong']

  return (
    <AuthLayout title="Create your account" subtitle="Join MediCare — it's completely free">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Full name" error={errors.name} required>
          <input type="text"
            className={`input ${errors.name ? 'input-error' : ''}`}
            placeholder="John Smith"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoComplete="name"
          />
        </FormField>

        <FormField label="Email address" error={errors.email} required>
          <input type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            autoComplete="email"
          />
        </FormField>

        <FormField label="Phone number" error={errors.phone}>
          <input type="tel"
            className="input"
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            autoComplete="tel"
          />
        </FormField>

        <FormField label="Password" error={errors.password} required>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'}
              className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
          {/* Strength meter */}
          {form.password && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-200
                      ${i <= strength ? strengthColors[strength] : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <p className={`text-xs mt-1 ${strength >= 4 ? 'text-emerald-600' : strength >= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                {strengthLabels[strength]}
              </p>
            </div>
          )}
        </FormField>

        <button type="submit" disabled={loading} className="btn-lg btn-primary w-full mt-2">
          {loading ? <Spinner size="sm" /> : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-400">
          By registering you agree to our Terms of Service and Privacy Policy.
        </p>

        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  )
}