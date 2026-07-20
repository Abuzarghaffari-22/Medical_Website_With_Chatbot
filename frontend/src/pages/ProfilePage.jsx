import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../api'
import { FormField, Spinner, Modal } from '../components/common'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()

  const [form, setForm] = useState({
    name:        user?.name || '',
    phone:       user?.phone || '',
    dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
    gender:      user?.gender || '',
  })
  const [pwForm, setPwForm]       = useState({ currentPassword: '', newPassword: '' })
  const [loading, setLoading]     = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [errors, setErrors]       = useState({})
  const [pwErrors, setPwErrors]   = useState({})

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name?.trim() || form.name.trim().length < 2) {
      setErrors({ name: 'Name must be at least 2 characters' })
      return
    }
    setLoading(true)
    try {
      const res = await authAPI.updateProfile(form)
      updateUser(res.data.user)
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!pwForm.currentPassword) errs.currentPassword = 'Required'
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) errs.newPassword = 'Min 8 characters'
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwForm.newPassword))
      errs.newPassword = 'Need uppercase, lowercase, and a number'
    if (Object.keys(errs).length) { setPwErrors(errs); return }

    setPwLoading(true)
    try {
      await authAPI.changePassword(pwForm)
      toast.success('Password changed. Please log in again.')
      setShowPwModal(false)
      setPwForm({ currentPassword: '', newPassword: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="section-title">My Profile</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your personal information and account settings.</p>
      </div>

      {/* Avatar card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <span className={`badge mt-1 ${user?.role === 'admin' ? 'badge-blue' : 'badge-teal'}`}>
            {user?.role}
          </span>
        </div>
      </div>

      {/* Personal info form */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Personal Information</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label="Full Name" error={errors.name} required>
            <input type="text"
              className={`input ${errors.name ? 'input-error' : ''}`}
              value={form.name}
              onChange={e => set('name', e.target.value)} />
          </FormField>

          <FormField label="Email Address">
            <input type="email" className="input bg-slate-50 cursor-not-allowed"
              value={user?.email || ''} disabled />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed here. Contact support.</p>
          </FormField>

          <FormField label="Phone Number" error={errors.phone}>
            <input type="tel" className="input"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+1 (555) 000-0000" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date of Birth">
              <input type="date" className="input"
                value={form.dateOfBirth}
                onChange={e => set('dateOfBirth', e.target.value)} />
            </FormField>
            <FormField label="Gender">
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </FormField>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-md btn-primary">
              {loading ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setShowPwModal(true)} className="btn-md btn-secondary">
              Change Password
            </button>
          </div>
        </form>
      </div>

      {/* Read-only account info */}
      <div className="card p-5 sm:p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Account Information</h3>
        <p className="text-xs text-slate-400 mb-4">Read-only account details.</p>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Account ID',    value: user?._id || user?.id },
            { label: 'Role',          value: user?.role },
            { label: 'Member since',  value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="text-slate-500 w-32">{label}</span>
              <span className="font-medium text-slate-800 font-mono text-xs break-all">{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal isOpen={showPwModal} onClose={() => setShowPwModal(false)} title="Change Password" size="sm">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <FormField label="Current Password" error={pwErrors.currentPassword} required>
            <input type="password"
              className={`input ${pwErrors.currentPassword ? 'input-error' : ''}`}
              value={pwForm.currentPassword}
              onChange={e => { setPwForm(p => ({ ...p, currentPassword: e.target.value })); setPwErrors(p => ({ ...p, currentPassword: '' })) }}
            />
          </FormField>
          <FormField label="New Password" error={pwErrors.newPassword} required>
            <input type="password"
              className={`input ${pwErrors.newPassword ? 'input-error' : ''}`}
              value={pwForm.newPassword}
              onChange={e => { setPwForm(p => ({ ...p, newPassword: e.target.value })); setPwErrors(p => ({ ...p, newPassword: '' })) }}
              placeholder="Min. 8 chars with uppercase, lowercase, number"
            />
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowPwModal(false)} className="btn-md btn-secondary" disabled={pwLoading}>Cancel</button>
            <button type="submit" className="btn-md btn-primary" disabled={pwLoading}>
              {pwLoading ? <Spinner size="sm" /> : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}