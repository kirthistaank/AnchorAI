import { useNavigate, useLocation } from 'react-router-dom'
import { getUsername, getUserId, clearAuth } from '../services/auth'
import { useState, useEffect, useRef } from 'react'
import Sidebar from './Sidebar'
import { applyTheme } from './ThemePicker'

const SWATCHES = [
  { id: 'violet',  color: '#8b5cf6' },
  { id: 'blue',    color: '#3b82f6' },
  { id: 'emerald', color: '#10b981' },
  { id: 'rose',    color: '#f43f5e' },
  { id: 'amber',   color: '#f59e0b' },
  { id: 'teal',    color: '#14b8a6' },
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
      <img src={src} alt={username} style={{ width: size, height: size }}
        className="rounded-full object-cover ring-2 ring-accent-500/60" />
    )
  }
  return (
    <div style={{ width: size, height: size }}
      className="rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center ring-2 ring-accent-500/40 flex-shrink-0">
      <span className="text-white font-bold text-sm leading-none select-none">
        {(username?.[0] || '?').toUpperCase()}
      </span>
    </div>
  )
}

function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const username = getUsername()
  const [open, setOpen] = useState(false)
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('mc-theme') || 'violet')
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  const goTo = (path) => {
    setOpen(false)
    navigate(path)
  }

  const logout = () => {
    setOpen(false)
    clearAuth()
    navigate('/login')
  }

  return (
    <header className="h-16 border-b border-accent-500/20 flex flex-shrink-0 relative z-40">
      {/* Title section */}
      <div className="flex-1 flex items-center px-6">
        <p className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-accent-400 to-accent-200 bg-clip-text text-transparent whitespace-nowrap">
          AnchorAI
        </p>
      </div>
      {/* Profile section — separate, no banner bleed */}
      <div className="flex-shrink-0 flex items-center px-4 bg-slate-900 border-l border-slate-700/50">
      <div ref={ref} className="relative flex-shrink-0">
        {/* Trigger */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
        >
          <Avatar username={username} size={32} />
          <span className="text-slate-300 text-sm font-medium hidden sm:block">Hi, {username}</span>
          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl py-1 z-50">
            <div className="px-4 py-2.5 border-b border-slate-700/50">
              <p className="text-slate-200 text-sm font-semibold">{username}</p>
              <p className="text-slate-500 text-xs mt-0.5">Signed in</p>
            </div>
            <div className="px-4 py-2.5 border-b border-slate-700/50">
              <p className="text-slate-500 text-xs mb-2">Theme</p>
              <div className="flex gap-2">
                {SWATCHES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { applyTheme(s.id); setActiveTheme(s.id) }}
                    title={s.id}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${activeTheme === s.id ? 'border-white scale-110' : 'border-transparent hover:border-white/50'}`}
                    style={{ background: s.color }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => goTo('/profile')}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-300 hover:bg-slate-700/60 text-sm transition-colors text-left"
            >
              <span>👤</span> Profile & Settings
            </button>
            <div className="border-t border-slate-700/50 mt-1 pt-1">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-400 hover:bg-red-500/10 text-sm transition-colors text-left"
              >
                <span>↩</span> Log out
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  )
}

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
