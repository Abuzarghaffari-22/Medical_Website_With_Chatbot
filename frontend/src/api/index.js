import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 40000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

export let _tokenRef = { current: null }

api.interceptors.request.use(
  (config) => {
    const token = _tokenRef.current || localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

let isRefreshing = false
let failedQueue = []
const MAX_QUEUE_SIZE = 20

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) =>
    error ? prom.reject(error) : prom.resolve(token)
  )
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // Only attempt refresh on 401, and only once per original request
    if (error.response?.status === 401 && !original._retry) {
      // If another refresh is already in flight, queue this request
      if (isRefreshing) {
        if (failedQueue.length >= MAX_QUEUE_SIZE) {
          return Promise.reject(new Error('Too many queued requests'))
        }
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        }).catch((err) => Promise.reject(err))
      }

      original._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        )

        const newToken = data.accessToken
        _tokenRef.current = newToken
        localStorage.setItem('accessToken', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`

        isRefreshing = false
        processQueue(null, newToken)

        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        isRefreshing = false
        processQueue(refreshError, null)
        _tokenRef.current = null
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api

export const authAPI = {
  register:        (data)            => api.post('/auth/register', data),
  login:           (data)            => api.post('/auth/login', data),
  logout:          ()                => api.post('/auth/logout'),
  getMe:           ()                => api.get('/auth/me'),
  updateProfile:   (data)            => api.put('/auth/update-profile', data),
  changePassword:  (data)            => api.put('/auth/change-password', data),
  forgotPassword:  (email)           => api.post('/auth/forgot-password', { email }),
  resetPassword:   (token, password) => api.put(`/auth/reset-password/${token}`, { password }),
}

export const appointmentsAPI = {
  create:          (data)                => api.post('/appointments', data),
  getAll:          (params)              => api.get('/appointments', { params }),
  getOne:          (id)                  => api.get(`/appointments/${id}`),
  update:          (id, data)            => api.put(`/appointments/${id}`, data),
  cancel:          (id, reason)          => api.patch(`/appointments/${id}/cancel`, { reason }),
  updateStatus:    (id, status, notes)   => api.patch(`/appointments/${id}/status`, { status, adminNotes: notes }),
  getUpcoming:     ()                    => api.get('/appointments/my/upcoming'),
  getAvailableSlots: (doctorName, date)  => api.get('/appointments/available-slots', { params: { doctorName, date } }),
  getMySummary:    ()                    => api.get('/users/me/appointments/summary'),
}

export const chatAPI = {
  sendMessage:   (message, sessionId) => api.post('/chat/message', { message, sessionId }),
  newSession:    ()                   => api.post('/chat/new-session'),
  getSessions:   (params)             => api.get('/chat/sessions', { params }),
  getSession:    (sessionId)          => api.get(`/chat/sessions/${sessionId}`),
  deleteSession: (sessionId)          => api.delete(`/chat/sessions/${sessionId}`),
}

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
}

export const adminAPI = {
  getDashboard:        ()           => api.get('/admin/dashboard'),
  getUsers:            (params)     => api.get('/admin/users', { params }),
  getUser:             (id)         => api.get(`/admin/users/${id}`),
  updateUser:          (id, data)   => api.patch(`/admin/users/${id}`, data),
  deleteUser:          (id)         => api.delete(`/admin/users/${id}`),
  getAllAppointments:   (params)     => api.get('/admin/appointments', { params }),
}