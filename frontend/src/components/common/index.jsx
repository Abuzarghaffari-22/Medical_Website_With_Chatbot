export const Skeleton = ({ className = '' }) => (
  <div className={`skeleton ${className}`} />
)

export const SkeletonCard = () => (
  <div className="card p-5 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-3 w-2/3" />
  </div>
)

const STATUS_STYLES = {
  pending:     'badge-yellow',
  confirmed:   'badge-teal',
  completed:   'badge-green',
  cancelled:   'badge-red',
  'no-show':   'badge-slate',
  emergency:   'badge-red',
  urgent:      'badge-yellow',
  semi_urgent: 'badge-blue',
  non_urgent:  'badge-teal',
  self_care:   'badge-green',
}

export const StatusBadge = ({ status }) => (
  <span className={`badge ${STATUS_STYLES[status] || 'badge-slate'}`}>
    {status?.replace(/_/g, ' ')}
  </span>
)

export const StatCard = ({ label, value, icon, color = 'blue', change, loading }) => {
  const colors = {
    blue:  'from-primary-500 to-primary-600',
    teal:  'from-teal-500 to-teal-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red:   'from-red-500 to-red-600',
  }

  if (loading) return <SkeletonCard />

  return (
    <div className="card-hover p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-2xl font-display font-bold text-slate-900 mt-1">{value}</p>
          {change !== undefined && (
            <p className={`text-xs mt-1 font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% this month
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <span className="text-white text-lg">{icon}</span>
        </div>
      </div>
    </div>
  )
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} animate-slide-up max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-display font-semibold text-slate-900 text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export const EmptyState = ({ icon = '📋', title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-semibold text-slate-800 text-lg">{title}</h3>
    <p className="text-slate-500 text-sm mt-2 max-w-xs">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
)

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <svg className={`animate-spin text-primary-600 ${sizes[size]} ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <p className="text-slate-600 text-sm mb-5">{message}</p>
    <div className="flex gap-3 justify-end">
      <button onClick={onClose} className="btn-md btn-secondary" disabled={loading}>Cancel</button>
      <button
        onClick={onConfirm}
        className={`btn-md ${danger ? 'btn-danger' : 'btn-primary'}`}
        disabled={loading}
      >
        {loading ? <Spinner size="sm" /> : confirmLabel}
      </button>
    </div>
  </Modal>
)

export const FormField = ({ label, error, children, required }) => (
  <div>
    {label && (
      <label className="label">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
    )}
    {children}
    {error && <p className="error-msg">⚠ {error}</p>}
  </div>
)

export const UrgencyAlert = ({ level, message }) => {
  const styles = {
    emergency:   'bg-red-50 border-red-200 text-red-800 urgency-emergency',
    urgent:      'bg-amber-50 border-amber-200 text-amber-800',
    semi_urgent: 'bg-blue-50 border-blue-200 text-blue-800',
    self_care:   'bg-emerald-50 border-emerald-200 text-emerald-800',
  }
  const icons = { emergency: '🚨', urgent: '⚠️', semi_urgent: '📅', self_care: '🏠' }

  return (
    <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${styles[level] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
      <span className="flex-shrink-0 text-base">{icons[level] || 'ℹ️'}</span>
      <p className="leading-relaxed">{message}</p>
    </div>
  )
}

export const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages } = pagination

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="btn-sm btn-secondary disabled:opacity-40"
      >← Prev</button>
      <span className="text-sm text-slate-600 px-2">
        Page {page} of {pages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === pages}
        className="btn-sm btn-secondary disabled:opacity-40"
      >Next →</button>
    </div>
  )
}