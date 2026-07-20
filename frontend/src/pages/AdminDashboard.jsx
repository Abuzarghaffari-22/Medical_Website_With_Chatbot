import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../api'
import { StatCard, StatusBadge, SkeletonCard } from '../components/common'
import { format, parseISO } from 'date-fns'

export default function AdminDashboard() {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminAPI.getDashboard()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const stats  = data?.stats
  const recent = data?.recentActivity

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h2 className="section-title">Admin Dashboard</h2>
        <p className="text-slate-500 text-sm mt-0.5">Overview of clinic operations and patient activity.</p>
      </div>

      {/* Primary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients"      value={stats?.users.total ?? '—'}              icon="👥" color="blue"  change={stats?.users.growthPercent} loading={loading} />
        <StatCard label="Today's Appointments" value={stats?.appointments.today ?? '—'}       icon="📅" color="teal"  loading={loading} />
        <StatCard label="Pending Approval"    value={stats?.appointments.pending ?? '—'}      icon="⏳" color="amber" loading={loading} />
        <StatCard label="AI Chat Sessions"    value={stats?.chat.sessionsThisMonth ?? '—'}    icon="🤖" color="green" loading={loading} />
      </div>

      {/* Secondary mini-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Confirmed',     value: stats?.appointments.confirmed,  color: 'teal',  icon: '✅' },
          { label: 'Completed',     value: stats?.appointments.completed,  color: 'green', icon: '🏁' },
          { label: 'Cancelled',     value: stats?.appointments.cancelled,  color: 'red',   icon: '❌' },
          { label: 'Total Sessions', value: stats?.chat.totalSessions,     color: 'blue',  icon: '💬' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              {loading
                ? <div className="skeleton h-6 w-10 mt-1" />
                : <p className="text-xl font-bold text-slate-900">{s.value ?? '—'}</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {!loading && stats?.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Appointments by Specialty */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Appointments by Specialty</h3>
            <div className="space-y-2.5">
              {(stats.charts.appointmentsBySpecialty || []).map(({ _id, count }) => {
                const total = stats.charts.appointmentsBySpecialty.reduce((s, a) => s + a.count, 0)
                const pct   = total ? Math.round((count / total) * 100) : 0
                return (
                  <div key={_id}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{_id}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-teal-400 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Appointments by Status */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Appointment Status Breakdown</h3>
            <div className="space-y-3">
              {(stats.charts.appointmentsByStatus || []).map(({ _id, count }) => (
                <div key={_id} className="flex items-center gap-3">
                  <StatusBadge status={_id} />
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-400 rounded-full"
                      style={{ width: `${Math.min((count / (stats.appointments.total || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent appointments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Appointments</h3>
            <Link to="/admin/appointments" className="text-xs text-primary-600 hover:underline">Manage →</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : (
            <div className="space-y-2.5">
              {(recent?.appointments || []).map(a => (
                <div key={a._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-teal-100 flex items-center justify-center text-sm">🏥</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.patientId?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{a.doctorName} · {a.specialty}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
              {!recent?.appointments?.length && (
                <p className="text-sm text-slate-400 text-center py-4">No recent appointments</p>
              )}
            </div>
          )}
        </div>

        {/* New patients */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">New Patients</h3>
            <span className="text-xs text-slate-400">This month: {stats?.users.newThisMonth ?? '—'}</span>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : (
            <div className="space-y-2.5">
              {(recent?.users || []).map(u => (
                <div key={u._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {u.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'} text-[10px]`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {!recent?.users?.length && (
                <p className="text-sm text-slate-400 text-center py-4">No new patients this month</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}