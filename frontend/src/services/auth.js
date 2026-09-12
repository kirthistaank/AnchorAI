import axios from 'axios'

const API_BASE = 'http://localhost:8000'

export const getToken = () => localStorage.getItem('token')
export const getUserId = () => localStorage.getItem('user_id')
export const getUsername = () => localStorage.getItem('username')

export const setAuth = ({ access_token, user_id, username }) => {
  localStorage.setItem('token', access_token)
  localStorage.setItem('user_id', user_id)
  localStorage.setItem('username', username)
}

export const clearAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user_id')
  localStorage.removeItem('username')
}

export const isAuthenticated = () => !!getToken()

// Attach token to every outgoing request
axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to login on 401
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data) => axios.post(`${API_BASE}/auth/register`, data),
  login: (data) => axios.post(`${API_BASE}/auth/login`, data),
  logout: () => axios.post(`${API_BASE}/auth/logout`),
  forgotPassword: (email) => axios.post(`${API_BASE}/auth/forgot-password`, { email }),
  resetPassword: (data) => axios.post(`${API_BASE}/auth/reset-password`, data),
  getProfile: () => axios.get(`${API_BASE}/users/me`),
  updateProfile: (data) => axios.put(`${API_BASE}/users/me/profile`, data),
}
