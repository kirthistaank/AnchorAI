import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getUsername, getUserId, clearAuth } from '../services/auth'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/emotions', label: 'Emotions' },
  { to: '/trends', label: 'Trends' },
  { to: '/habits', label: 'Habits' },
  { to: '/goals', label: 'Goals' },
  { to: '/exercises', label: 'Exercises' },
]

function Avatar({ username, size = 32 }) {
  const userId = getUserId()
  const [src, setSrc] = useState(() => localStorage.getItem(`avatar_${userId}`) || null)

  useEffect(() => {
    const handler = () => setSrc(localStorage.getItem(`avatar_${userId}`) || null)
    window.addEventListener('avatar-updated', handler)
    return () => window.removeEventListener('avatar-updated', handler)
  }, [userId])

  if (src) {
    return (
      <img
        src={src}
        alt={username}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-2 ring-accent-500/60"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center ring-2 ring-accent-500/40 flex-shrink-0"
    >
      <span className="text-white font-bold text-sm leading-none select-none">
        {(username?.[0] || '?').toUpperCase()}
      </span>
    </div>
  )
}

export default function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const username = getUsername()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close dropdown on navigation
  useEffect(() => { setOpen(false) }, [location.pathname])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-accent-500/20 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl">🧘</span>
          <span className="font-bold text-base bg-gradient-to-r from-accent-400 to-accent-300 bg-clip-text text-transparent hidden sm:block">
            AnchorAI
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 justify-center">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive(to)
                  ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Avatar dropdown */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Avatar username={username} size={34} />
            <span className="text-slate-300 text-sm font-medium hidden md:block">
              Hi, {username}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden md:block ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden py-1 animate-slideIn">
              <div className="px-4 py-2.5 border-b border-slate-700/50">
                <p className="text-slate-200 text-sm font-semibold">{username}</p>
                <p className="text-slate-500 text-xs mt-0.5">Signed in</p>
              </div>
              <Link
                to="/profile"
                className="flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:bg-slate-700/60 text-sm transition-colors"
              >
                <span>👤</span> Profile & Settings
              </Link>
              <div className="border-t border-slate-700/50 mt-1 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
                >
                  <span>↩</span> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
