import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { appointmentsAPI, adminAPI } from '../api'
import { StatusBadge, EmptyState, Pagination, ConfirmDialog } from '../components/common'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'completed', 'cancelled']

const RowSkeleton = () => (
  <div className="border border-slate-100 rounded-xl p-4 space-y-2 animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-1/3" />
    <div className="h-3 bg-slate-100 rounded w-1/2" />
    <div className="h-3 bg-slate-100 rounded w-1/4" />
  </div>
)

export default function AppointmentsList({ admin = false }) {
  const { isAdmin } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [pagination, setPagination]     = useState(null)
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage]                 = useState(1)
  const [confirmCancel, setConfirmCancel]   = useState(null)
  const [confirmStatus, setConfirmStatus]   = useState(null)
  const [actionLoading, setActionLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (statusFilter !== 'all') params.status = statusFilter

      const res = (admin || isAdmin)
        ? await adminAPI.getAllAppointments(params)
        : await appointmentsAPI.getAll(params)

      setAppointments(res.data.appointments || [])
      setPagination(res.data.pagination || null)
    } catch {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, admin, isAdmin])

  useEffect(() => { load() }, [load])

  const handleCancel = async () => {
    setActionLoading(true)
    try {
      await appointmentsAPI.cancel(confirmCancel._id)
      toast.success('Appointment cancelled')
      setConfirmCancel(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel appointment')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    setActionLoading(true)
    try {
      await appointmentsAPI.updateStatus(confirmStatus._id, confirmStatus.newStatus)
      toast.success(`Appointment marked as ${confirmStatus.newStatus}`)
      setConfirmStatus(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{admin || isAdmin ? 'All Appointments' : 'My Appointments'}</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {pagination ? `${pagination.total} total` : ''} appointment{pagination?.total !== 1 ? 's' : ''}
          </p>
        </div>
        {!isAdmin && (
          <Link to="/appointments/book" className="btn-md btn-primary flex-shrink-0">
            + Book New
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
              ${statusFilter === s
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <RowSkeleton key={i} />)}</div>
      ) : appointments.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon="📅"
            title="No appointments found"
            description={statusFilter !== 'all' ? `No ${statusFilter} appointments.` : 'No appointments yet.'}
            action={!isAdmin && <Link to="/appointments/book" className="btn-md btn-primary">Book Now</Link>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map(appt => (
            <div key={appt._id} className="card-hover p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-100 to-teal-100 flex items-center justify-center text-xl flex-shrink-0">
                  🏥
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900 text-sm">{appt.doctorName}</h4>
                    <StatusBadge status={appt.status} />
                    {appt.urgencyLevel && appt.urgencyLevel !== 'unknown' && (
                      <StatusBadge status={appt.urgencyLevel} />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{appt.specialty} · {appt.type}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>📅 {format(parseISO(appt.appointmentDate), 'EEE, MMM d yyyy')}</span>
                    <span>🕐 {format(parseISO(appt.appointmentDate), 'h:mm a')}</span>
                    <span>⏱ {appt.duration} min</span>
                    {(admin || isAdmin) && appt.patientId && (
                      <span>👤 {appt.patientId.name}</span>
                    )}
                  </div>
                  {appt.reason && (
                    <p className="text-xs text-slate-500 mt-1.5 italic truncate">💬 {appt.reason}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  {/* Patient cancel */}
                  {!isAdmin && ['pending', 'confirmed'].includes(appt.status) && (
                    <button onClick={() => setConfirmCancel(appt)} className="btn-sm btn-danger">
                      Cancel
                    </button>
                  )}
                  {/* Admin: confirm / cancel pending */}
                  {isAdmin && appt.status === 'pending' && (
                    <>
                      <button onClick={() => setConfirmStatus({ ...appt, newStatus: 'confirmed' })} className="btn-sm btn-teal">Confirm</button>
                      <button onClick={() => setConfirmStatus({ ...appt, newStatus: 'cancelled' })} className="btn-sm btn-danger">Cancel</button>
                    </>
                  )}
                  {/* Admin: complete confirmed */}
                  {isAdmin && appt.status === 'confirmed' && (
                    <button onClick={() => setConfirmStatus({ ...appt, newStatus: 'completed' })} className="btn-sm btn-primary">Complete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={setPage} />

      {/* Patient cancel dialog */}
      <ConfirmDialog
        isOpen={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="Cancel Appointment"
        message={`Cancel your appointment with ${confirmCancel?.doctorName} on ${confirmCancel ? format(parseISO(confirmCancel.appointmentDate), 'MMM d yyyy') : ''}? Note: cancellations within 2 hours of the appointment require a phone call.`}
        confirmLabel="Yes, Cancel"
        danger
        loading={actionLoading}
      />

      {/* Admin status dialog */}
      <ConfirmDialog
        isOpen={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleStatusUpdate}
        title={`Mark as ${confirmStatus?.newStatus}?`}
        message={`Set appointment with ${confirmStatus?.patientId?.name || 'patient'} to "${confirmStatus?.newStatus}"?`}
        confirmLabel={`Yes, mark ${confirmStatus?.newStatus}`}
        danger={confirmStatus?.newStatus === 'cancelled'}
        loading={actionLoading}
      />
    </div>
  )
}