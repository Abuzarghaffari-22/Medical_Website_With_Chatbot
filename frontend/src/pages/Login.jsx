import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner, FormField } from '../components/common'
import AuthLayout from '../components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.email) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.password) errs.password = 'Password is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name?.split(' ')[0]}!`)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials'
      toast.error(msg)
      if (msg.toLowerCase().includes('locked')) setErrors({ password: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your patient portal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Email address" error={errors.email} required>
          <input
            type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password" error={errors.password} required>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </FormField>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className="btn-lg btn-primary w-full">
          {loading ? <Spinner size="sm" /> : 'Sign in'}
        </button>

        {/* Demo credentials */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <p className="font-semibold mb-1">🔑 Demo Credentials</p>
          <p>Admin:   admin@medicareclinic.com / Admin@123456</p>
          <p>Patient: john.smith@example.com / Patient@123456</p>
        </div>

        <p className="text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">Create one free</Link>
        </p>
      </form>
    </AuthLayout>
  )
}