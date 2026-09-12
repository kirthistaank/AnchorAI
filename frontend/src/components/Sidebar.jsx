import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getToken, getUserId } from '../services/auth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const NAV_ITEMS = [
  { to: '/',          label: 'Home',      icon: '🏠' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/emotions',  label: 'Emotions',  icon: '💭' },
  { to: '/trends',    label: 'Trends',    icon: '📈' },
  { to: '/habits',    label: 'Habits',    icon: '✅' },
  { to: '/goals',     label: 'Goals',     icon: '🎯' },
  { to: '/exercises', label: 'Exercises', icon: '🧘' },
  { to: '/monitoring', label: 'Monitoring', icon: '🔧' },
]

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [budget, setBudget] = useState(null)
  const userId = getUserId()

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    if (!userId) return
    const fetchBudget = () =>
      fetch(`${API_BASE}/budget/${userId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setBudget(d))
        .catch(() => {})
    fetchBudget()
    const t = setInterval(fetchBudget, 60000)
    return () => clearInterval(t)
  }, [userId])

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <aside
      className={`flex flex-col bg-slate-900/90 backdrop-blur-md border-r border-accent-500/20 h-screen sticky top-0 transition-all duration-300 flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className={`px-3 py-4 border-b border-slate-700/50 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <span className="text-2xl">🧘</span>
        ) : (
          <img
            src="/logo.png"
            alt="AnchorAI"
            className="w-full h-16 object-contain object-left"
          />
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <Link
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive(to)
                ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="text-lg flex-shrink-0">{icon}</span>
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      {/* Budget status */}
      {budget && (
        <div className={`border-t border-slate-700/50 px-3 py-3 ${collapsed ? 'flex justify-center' : ''}`}>
          {collapsed ? (
            <div
              title={`$${budget.current_spend.toFixed(2)} / $${budget.monthly_budget.toFixed(2)}`}
              className={`w-2 h-2 rounded-full ${budget.percentage_used > 80 ? 'bg-red-400' : budget.percentage_used > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">Budget</span>
                <span className="text-xs font-mono text-slate-300">
                  ${budget.current_spend.toFixed(2)}<span className="text-slate-600"> / ${budget.monthly_budget.toFixed(2)}</span>
                </span>
              </div>
              <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${budget.percentage_used > 80 ? 'bg-red-400' : budget.percentage_used > 50 ? 'bg-amber-400' : 'bg-accent-500'}`}
                  style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                />
              </div>
              <p className={`text-xs mt-1 ${budget.can_use_claude ? 'text-green-400' : 'text-yellow-400'}`}>
                {budget.can_use_claude ? '✓ Claude available' : '⚡ Using local AI'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className={`flex items-center gap-2 px-3 py-3 border-t border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-all text-xs ${
          collapsed ? 'justify-center' : ''
        }`}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="text-base">{collapsed ? '→' : '←'}</span>
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  )
}
