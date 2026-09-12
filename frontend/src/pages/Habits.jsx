import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const CATEGORY_ICONS = {
  anchorai: '🧘',
  exercise: '💪',
  sleep: '😴',
  nutrition: '🥗',
  social: '👥',
  learning: '📚',
  custom: '⭐',
}

const PRESETS = [
  { name: 'Morning meditation', category: 'anchorai', unit: 'minutes', target_value: 10 },
  { name: 'Exercise', category: 'exercise', unit: 'minutes', target_value: 30 },
  { name: 'Sleep 8 hours', category: 'sleep', unit: 'hours', target_value: 8 },
  { name: 'Drink water', category: 'nutrition', unit: 'glasses', target_value: 8 },
  { name: 'Gratitude journal', category: 'anchorai', unit: 'entries', target_value: 3 },
  { name: 'Read', category: 'learning', unit: 'pages', target_value: 20 },
]

function StreakBadge({ streak }) {
  if (!streak) return null
  return (
    <span className="inline-flex items-center gap-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
      🔥 {streak}d
    </span>
  )
}

function MiniHistory({ logs }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const logMap = {}
  logs.forEach(l => { logMap[l.logged_date] = l.value })
  return (
    <div className="flex gap-1 mt-2">
      {days.map(day => (
        <div key={day} title={day} className={`w-5 h-5 rounded-sm ${logMap[day] != null ? 'bg-accent-500' : 'bg-slate-700'}`} />
      ))}
    </div>
  )
}

export default function Habits() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState({})
  const [logValues, setLogValues] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newHabit, setNewHabit] = useState({ name: '', category: 'custom', unit: '', target_value: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { fetchHabits() }, [])

  const fetchHabits = async () => {
    try {
      const res = await axios.get(`${API_BASE}/habits`)
      setHabits(res.data)
      await Promise.all(res.data.map(h => fetchLogs(h.id)))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (habitId) => {
    try {
      const res = await axios.get(`${API_BASE}/habits/${habitId}/logs?days=7`)
      setLogs(prev => ({ ...prev, [habitId]: res.data }))
    } catch {}
  }

  const logHabit = async (habitId) => {
    const value = parseFloat(logValues[habitId] || 1)
    setSaving(habitId)
    try {
      await axios.post(`${API_BASE}/habits/${habitId}/log`, { value })
      await fetchLogs(habitId)
      const streak = await axios.get(`${API_BASE}/habits/${habitId}/streak`)
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, streak: streak.data.streak } : h))
      setLogValues(prev => ({ ...prev, [habitId]: '' }))
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(null)
    }
  }

  const addHabit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newHabit,
        target_value: newHabit.target_value ? parseFloat(newHabit.target_value) : null,
      }
      await axios.post(`${API_BASE}/habits`, payload)
      setNewHabit({ name: '', category: 'custom', unit: '', target_value: '' })
      setShowAdd(false)
      fetchHabits()
    } catch (err) {
      console.error(err)
    }
  }

  const deleteHabit = async (id) => {
    if (!confirm('Delete this habit?')) return
    try {
      await axios.delete(`${API_BASE}/habits/${id}`)
      setHabits(prev => prev.filter(h => h.id !== id))
    } catch {}
  }

  const usePreset = (preset) => {
    setNewHabit(preset)
    setShowAdd(true)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading habits...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Habit Tracker</h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          + Add Habit
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-800/60 border border-accent-500/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-slate-100 font-semibold">New Habit</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => usePreset(p)}
                className="text-left px-3 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-sm text-slate-300 transition-colors"
              >
                {CATEGORY_ICONS[p.category]} {p.name}
              </button>
            ))}
          </div>
          <form onSubmit={addHabit} className="space-y-3">
            <input
              required value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))}
              placeholder="Habit name"
              className="w-full px-4 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newHabit.category} onChange={e => setNewHabit(p => ({ ...p, category: e.target.value }))}
                className="px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-accent-500/80"
              >
                {Object.keys(CATEGORY_ICONS).map(c => (
                  <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
                ))}
              </select>
              <input
                value={newHabit.unit} onChange={e => setNewHabit(p => ({ ...p, unit: e.target.value }))}
                placeholder="Unit (e.g. minutes)"
                className="px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-accent-500/80"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="number" min="0" value={newHabit.target_value} onChange={e => setNewHabit(p => ({ ...p, target_value: e.target.value }))}
                placeholder="Daily target (optional)"
                className="flex-1 px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-accent-500/80"
              />
              <button type="submit" className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                Save
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {habits.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-slate-300 font-medium">No habits yet</p>
          <p className="text-slate-500 text-sm mt-1">Add your first habit to start building consistency.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map(habit => {
            const todayLog = logs[habit.id]?.find(l => l.logged_date === todayStr)
            const pct = habit.target_value && todayLog ? Math.min((todayLog.value / habit.target_value) * 100, 100) : null
            return (
              <div key={habit.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CATEGORY_ICONS[habit.category] || '⭐'}</span>
                      <h3 className="text-slate-100 font-semibold">{habit.name}</h3>
                      <StreakBadge streak={habit.streak} />
                    </div>
                    {habit.target_value && (
                      <p className="text-slate-500 text-xs mt-0.5 ml-7">
                        Target: {habit.target_value} {habit.unit}
                      </p>
                    )}
                  </div>
                  <button onClick={() => deleteHabit(habit.id)} className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                </div>

                {pct != null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Today: {todayLog.value} {habit.unit}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-accent-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <MiniHistory logs={logs[habit.id] || []} />

                <div className="flex gap-2 mt-3">
                  {habit.unit && (
                    <input
                      type="number" min="0" step="any"
                      value={logValues[habit.id] || ''}
                      onChange={e => setLogValues(prev => ({ ...prev, [habit.id]: e.target.value }))}
                      placeholder={`Enter ${habit.unit}`}
                      className="flex-1 px-3 py-2 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-accent-500/80"
                    />
                  )}
                  <button
                    onClick={() => logHabit(habit.id)}
                    disabled={saving === habit.id}
                    className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all whitespace-nowrap"
                  >
                    {saving === habit.id ? '...' : todayLog ? '+ Add more' : '✓ Log today'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
