import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { appointmentsAPI, chatAPI } from '../api'
import { StatCard, SkeletonCard, StatusBadge, EmptyState } from '../components/common'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'

const formatApptDate = (dateStr) => {
  const d = parseISO(dateStr)
  if (isToday(d))    return `Today, ${format(d, 'h:mm a')}`
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, yyyy h:mm a')
}

export default function PatientDashboard() {
  const { user } = useAuth()
  const [upcomingAppts, setUpcomingAppts] = useState([])
  const [sessions, setSessions]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [stats, setStats]                 = useState({ upcoming: 0, completed: 0, cancelled: 0, chatSessions: 0 })

  useEffect(() => {
    const load = async () => {
      try {
        const [apptRes, sessionRes, summaryRes] = await Promise.all([
          appointmentsAPI.getUpcoming(),
          chatAPI.getSessions({ limit: 3 }),
          appointmentsAPI.getMySummary().catch(() => null), // graceful fallback
        ])

        setUpcomingAppts(apptRes.data.appointments || [])
        setSessions(sessionRes.data.sessions || [])

        if (summaryRes) {
          // Use dedicated summary endpoint when available
          const s = summaryRes.data.summary || summaryRes.data
          setStats({
            upcoming:     s.upcoming ?? apptRes.data.count ?? 0,
            completed:    s.completed ?? 0,
            cancelled:    s.cancelled ?? 0,
            chatSessions: sessionRes.data.pagination?.total || 0,
          })
        } else {
          // Fallback: compute from upcoming list only
          setStats({
            upcoming:     apptRes.data.count || 0,
            completed:    0,
            cancelled:    0,
            chatSessions: sessionRes.data.pagination?.total || 0,
          })
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 text-sm mt-0.5">Here's what's happening with your health today.</p>
        </div>
        <Link to="/appointments/book" className="btn-md btn-primary flex-shrink-0">
          + Book Appointment
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Upcoming"  value={stats.upcoming}     icon="📅" color="blue"  loading={loading} />
        <StatCard label="Completed" value={stats.completed}    icon="✅" color="green" loading={loading} />
        <StatCard label="Cancelled" value={stats.cancelled}    icon="❌" color="amber" loading={loading} />
        <StatCard label="AI Chats"  value={stats.chatSessions} icon="🤖" color="teal"  loading={loading} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming appointments */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Upcoming Appointments</h3>
            <Link to="/appointments" className="text-xs text-primary-600 hover:underline">View all →</Link>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : upcomingAppts.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No upcoming appointments"
              description="You have no scheduled appointments. Book one now!"
              action={<Link to="/appointments/book" className="btn-md btn-primary">Book Now</Link>}
            />
          ) : (
            <div className="space-y-3">
              {upcomingAppts.map(appt => (
                <div key={appt._id}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all duration-150">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white text-lg flex-shrink-0">
                    🏥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{appt.doctorName}</p>
                    <p className="text-xs text-slate-500">{appt.specialty}</p>
                    <p className="text-xs text-primary-600 font-medium mt-1">{formatApptDate(appt.appointmentDate)}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { to: '/chat',               icon: '🤖', label: 'Chat with AI Assistant', color: 'hover:bg-primary-50 hover:border-primary-200' },
                { to: '/appointments/book',  icon: '📅', label: 'Book Appointment',       color: 'hover:bg-teal-50 hover:border-teal-200' },
                { to: '/appointments',       icon: '📋', label: 'View My Appointments',   color: 'hover:bg-emerald-50 hover:border-emerald-200' },
                { to: '/profile',            icon: '👤', label: 'Update Profile',         color: 'hover:bg-slate-50' },
              ].map(a => (
                <Link key={a.to} to={a.to}
                  className={`flex items-center gap-3 p-3 rounded-xl border border-transparent ${a.color} transition-all duration-150`}>
                  <span className="text-lg">{a.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{a.label}</span>
                  <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent AI sessions */}
          {sessions.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 text-sm">Recent AI Sessions</h3>
                <Link to="/chat" className="text-xs text-primary-600 hover:underline">Open Chat</Link>
              </div>
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.sessionId} className="text-xs text-slate-600 p-2.5 bg-slate-50 rounded-lg">
                    <p className="font-medium truncate">{s.title || 'Conversation'}</p>
                    <p className="text-slate-400 mt-0.5">{s.messageCount} messages</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Emergency card */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800 font-semibold text-sm mb-1">🚨 In an Emergency?</p>
            <p className="text-red-600 text-xs mb-2">Do not use this app. Call immediately:</p>
            <a href="tel:911" className="btn-sm btn-danger w-full justify-center">Call 911</a>
          </div>
        </div>
      </div>
    </div>
  )
}