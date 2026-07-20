import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-4">Please refresh the page or contact support.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Pages
import Home            from './pages/Home'
import Login           from './pages/Login'
import Register        from './pages/Register'
import ForgotPassword  from './pages/ForgotPassword'
import PatientDashboard from './pages/PatientDashboard'
import AdminDashboard  from './pages/AdminDashboard'
import BookAppointment from './pages/BookAppointment'
import AppointmentsList from './pages/AppointmentsList'
import ChatPage        from './pages/ChatPage'
import ProfilePage     from './pages/ProfilePage'
import NotFound        from './pages/NotFound'

// Layouts
import MainLayout      from './components/layout/MainLayout'
import DashboardLayout from './components/layout/DashboardLayout'

const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center shadow-glow">
        <svg className="w-7 h-7 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </div>
      <p className="text-slate-500 text-sm font-medium animate-pulse">Loading MediCare...</p>
    </div>
  </div>
)

/** Redirects logged-in users away from auth pages */
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  return children
}

/** Redirects guests to login */
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  return user ? children : <Navigate to="/login" replace />
}

/** Admin-only. Patients are bounced to /dashboard */
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <AppLoader />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<MainLayout><Home /></MainLayout>} />

      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute><Register /></PublicRoute>
      } />
      <Route path="/forgot-password" element={
        <PublicRoute><ForgotPassword /></PublicRoute>
      } />

      {/* Patient pages */}
      <Route path="/dashboard" element={
        <PrivateRoute>
          <DashboardLayout><PatientDashboard /></DashboardLayout>
        </PrivateRoute>
      } />
      <Route path="/appointments" element={
        <PrivateRoute>
          <DashboardLayout><AppointmentsList /></DashboardLayout>
        </PrivateRoute>
      } />
      <Route path="/appointments/book" element={
        <PrivateRoute>
          <DashboardLayout><BookAppointment /></DashboardLayout>
        </PrivateRoute>
      } />
      <Route path="/chat" element={
        <PrivateRoute>
          <DashboardLayout fullHeight><ChatPage /></DashboardLayout>
        </PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute>
          <DashboardLayout><ProfilePage /></DashboardLayout>
        </PrivateRoute>
      } />

      {/* Admin pages */}
      <Route path="/admin" element={
        <AdminRoute>
          <DashboardLayout><AdminDashboard /></DashboardLayout>
        </AdminRoute>
      } />
      <Route path="/admin/appointments" element={
        <AdminRoute>
          <DashboardLayout><AppointmentsList admin /></DashboardLayout>
        </AdminRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            },
            success: { iconTheme: { primary: '#14b8a6', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}