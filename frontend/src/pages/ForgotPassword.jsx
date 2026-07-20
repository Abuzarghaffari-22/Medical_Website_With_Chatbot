import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'
import { Spinner, FormField } from '../components/common'
import AuthLayout from '../components/layout/AuthLayout'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
      toast.success('Reset link sent if that email is registered.')
    } catch {
      // Always show success to prevent email enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send you a secure reset link">
      {sent ? (
        <div className="space-y-5">
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <div className="text-4xl mb-3">📧</div>
            <h3 className="font-semibold text-emerald-800 mb-1">Check your inbox</h3>
            <p className="text-sm text-emerald-700">
              If <strong>{email}</strong> is registered, you'll receive a password reset link within a few minutes.
            </p>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Didn't receive it? Check your spam folder or{' '}
            <button onClick={() => setSent(false)} className="text-primary-600 hover:underline">try again</button>.
          </p>
          <Link to="/login" className="btn-md btn-secondary w-full justify-center block text-center">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Email address" error={error} required>
            <input
              type="email"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
              autoFocus
            />
          </FormField>

          <button type="submit" disabled={loading} className="btn-lg btn-primary w-full">
            {loading ? <Spinner size="sm" /> : 'Send reset link'}
          </button>

          <Link to="/login" className="block text-center text-sm text-slate-500 hover:text-slate-700">
            ← Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}