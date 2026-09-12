import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, setAuth } from '../services/auth'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      setAuth({
        access_token: res.data.access_token,
        user_id: res.data.user_id,
        username: res.data.username,
      })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧘</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-slate-400 text-sm mt-2">Start your personal wellness journey</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/60 backdrop-blur-xl border border-accent-500/20 rounded-3xl p-8 shadow-2xl space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {[
            { label: 'Username', field: 'username', type: 'text', placeholder: 'kirthi' },
            { label: 'Email', field: 'email', type: 'email', placeholder: 'you@example.com' },
            { label: 'Password', field: 'password', type: 'password', placeholder: '••••••••' },
            { label: 'Confirm Password', field: 'confirm', type: 'password', placeholder: '••••••••' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-slate-300 text-sm font-medium mb-2">{label}</label>
              <input
                type={type}
                value={form[field]}
                onChange={set(field)}
                required
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 focus:ring-2 focus:ring-accent-500/20 transition-all"
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-accent-500 to-accent-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-accent-500/50 disabled:opacity-50 transition-all duration-200 mt-2"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-slate-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 transition-colors">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
