import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-blue-300', bg: 'bg-blue-500/20 border-blue-500/30' },
  completed: { label: 'Completed', color: 'text-green-300', bg: 'bg-green-500/20 border-green-500/30' },
  paused: { label: 'Paused', color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/30' },
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{value} / {max}</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-accent-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', description: '', target_value: '', current_value: 0, unit: '', deadline: '' })
  const [editing, setEditing] = useState(null)

  useEffect(() => { fetchGoals() }, [])

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`${API_BASE}/goals`)
      setGoals(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addGoal = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newGoal,
        target_value: newGoal.target_value ? parseFloat(newGoal.target_value) : null,
        current_value: parseFloat(newGoal.current_value) || 0,
        deadline: newGoal.deadline || null,
      }
      await axios.post(`${API_BASE}/goals`, payload)
      setNewGoal({ title: '', description: '', target_value: '', current_value: 0, unit: '', deadline: '' })
      setShowAdd(false)
      fetchGoals()
    } catch (err) {
      console.error(err)
    }
  }

  const updateProgress = async (id, current_value) => {
    try {
      await axios.put(`${API_BASE}/goals/${id}`, { current_value: parseFloat(current_value) })
      fetchGoals()
      setEditing(null)
    } catch (err) {
      console.error(err)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API_BASE}/goals/${id}`, { status })
      fetchGoals()
    } catch {}
  }

  const deleteGoal = async (id) => {
    if (!confirm('Delete this goal?')) return
    try {
      await axios.delete(`${API_BASE}/goals/${id}`)
      setGoals(prev => prev.filter(g => g.id !== id))
    } catch {}
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading goals...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Goals</h2>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          + New Goal
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-800/60 border border-accent-500/30 rounded-2xl p-5">
          <h3 className="text-slate-100 font-semibold mb-4">New Goal</h3>
          <form onSubmit={addGoal} className="space-y-3">
            <input
              required value={newGoal.title} onChange={e => setNewGoal(p => ({ ...p, title: e.target.value }))}
              placeholder="Goal title (e.g. Run 5km without stopping)"
              className="w-full px-4 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 text-sm"
            />
            <textarea
              value={newGoal.description} onChange={e => setNewGoal(p => ({ ...p, description: e.target.value }))}
              placeholder="Why does this goal matter to you? (optional)"
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 text-sm resize-none"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number" min="0" value={newGoal.target_value} onChange={e => setNewGoal(p => ({ ...p, target_value: e.target.value }))}
                placeholder="Target (optional)"
                className="px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-accent-500/80"
              />
              <input
                value={newGoal.unit} onChange={e => setNewGoal(p => ({ ...p, unit: e.target.value }))}
                placeholder="Unit (km, days…)"
                className="px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-accent-500/80"
              />
              <input
                type="date" value={newGoal.deadline} onChange={e => setNewGoal(p => ({ ...p, deadline: e.target.value }))}
                className="px-3 py-2.5 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-accent-500/80"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                Save Goal
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-slate-700 text-slate-300 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-slate-300 font-medium">No goals yet</p>
          <p className="text-slate-500 text-sm mt-1">Set a goal to track your progress toward something meaningful.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const cfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.active
            const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / 86400000) : null
            return (
              <div key={goal.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-slate-100 font-semibold">{goal.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {daysLeft != null && daysLeft >= 0 && (
                        <span className={`text-xs ${daysLeft <= 7 ? 'text-red-400' : 'text-slate-400'}`}>
                          {daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                        </span>
                      )}
                      {daysLeft != null && daysLeft < 0 && (
                        <span className="text-xs text-red-400">Overdue</span>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-slate-400 text-sm mt-1">{goal.description}</p>
                    )}
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-slate-600 hover:text-red-400 text-lg leading-none transition-colors ml-2">×</button>
                </div>

                {goal.target_value != null && (
                  <ProgressBar value={goal.current_value || 0} max={goal.target_value} />
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {goal.target_value != null && (
                    editing === goal.id ? (
                      <form
                        onSubmit={e => { e.preventDefault(); updateProgress(goal.id, e.target.val.value) }}
                        className="flex gap-2"
                      >
                        <input
                          name="val" type="number" min="0" step="any"
                          defaultValue={goal.current_value}
                          className="w-28 px-3 py-1.5 bg-slate-700/60 border border-slate-600/50 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent-500/80"
                          autoFocus
                        />
                        <button type="submit" className="text-xs bg-accent-500 text-white px-3 py-1.5 rounded-lg font-semibold">Save</button>
                        <button type="button" onClick={() => setEditing(null)} className="text-xs text-slate-400 px-2">Cancel</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setEditing(goal.id)}
                        className="text-xs text-accent-400 hover:text-accent-300 border border-accent-500/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Update progress
                      </button>
                    )
                  )}
                  <select
                    value={goal.status}
                    onChange={e => updateStatus(goal.id, e.target.value)}
                    className="text-xs px-3 py-1.5 bg-slate-700/60 border border-slate-600/50 rounded-lg text-slate-300 focus:outline-none focus:border-accent-500/80"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Mark complete</option>
                    <option value="paused">Pause</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
