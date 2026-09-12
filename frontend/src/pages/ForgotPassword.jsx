import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/auth'

export default function ForgotPassword() {
  const [stage, setStage] = useState('request') // 'request' | 'reset' | 'done'
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await authApi.forgotPassword(email)
      setMessage(res.data.message)
      setStage('reset')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword({ token, new_password: newPassword })
      setStage('done')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-3xl font-bold text-slate-100">Reset Password</h1>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-accent-500/20 rounded-3xl p-8 shadow-2xl space-y-5">
          {stage === 'request' && (
            <form onSubmit={handleRequest} className="space-y-4">
              <p className="text-slate-400 text-sm">Enter your email and we'll print a reset token to the console (MVP mode).</p>
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-all"
              >
                {loading ? 'Sending...' : 'Request Reset Token'}
              </button>
            </form>
          )}

          {stage === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-green-400 text-sm">{message}</p>
              <p className="text-slate-400 text-sm">Check the backend console for your token, then enter it below.</p>
              {error && <div className="text-red-400 text-sm">{error}</div>}
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Paste reset token here"
                className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 transition-all"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="New password"
                className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent-500 to-accent-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-all"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {stage === 'done' && (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <p className="text-green-400">Password reset successfully!</p>
              <Link to="/login" className="block bg-gradient-to-r from-accent-500 to-accent-600 text-white py-3 rounded-xl font-semibold text-center transition-all">
                Sign In
              </Link>
            </div>
          )}

          <Link to="/login" className="block text-center text-slate-400 text-sm hover:text-accent-400 transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
