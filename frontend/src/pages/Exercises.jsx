import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const EXERCISES = [
  {
    type: 'thought_record',
    title: 'Thought Record',
    icon: '📝',
    description: 'Identify and reframe negative automatic thoughts using CBT principles.',
    duration: '10–15 min',
    best_for: ['anxiety', 'overthinking', 'self-criticism'],
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    accent: 'text-purple-300',
  },
  {
    type: 'breathing',
    title: 'Box Breathing',
    icon: '🌬️',
    description: 'A 4-4-4-4 breathing technique to calm your nervous system instantly.',
    duration: '3–5 min',
    best_for: ['stress', 'panic', 'focus'],
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    accent: 'text-blue-300',
  },
  {
    type: 'grounding',
    title: '5-4-3-2-1 Grounding',
    icon: '🌿',
    description: 'Use your five senses to anchor yourself in the present moment.',
    duration: '5 min',
    best_for: ['dissociation', 'overwhelm', 'anxiety spirals'],
    color: 'from-green-500/20 to-green-600/10 border-green-500/30',
    accent: 'text-green-300',
  },
]

export default function Exercises() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    axios.get(`${API_BASE}/exercises/history`).then(res => setHistory(res.data)).catch(() => {})
  }, [])

  const countByType = {}
  history.forEach(s => { countByType[s.exercise_type] = (countByType[s.exercise_type] || 0) + 1 })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">CBT Exercises</h2>
          <p className="text-slate-400 text-sm mt-1">Evidence-based tools to support your mental wellbeing</p>
        </div>
        <Link to="/" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Back to Chat
        </Link>
      </div>

      <div className="space-y-4">
        {EXERCISES.map(ex => (
          <Link
            key={ex.type}
            to={`/exercises/${ex.type}`}
            className={`block bg-gradient-to-br ${ex.color} backdrop-blur-xl border rounded-2xl p-5 hover:scale-[1.01] transition-all duration-200 hover:shadow-lg`}
          >
            <div className="flex items-start gap-4">
              <span className="text-4xl flex-shrink-0">{ex.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`font-bold text-lg ${ex.accent}`}>{ex.title}</h3>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">{ex.duration}</span>
                    {countByType[ex.type] > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">Done {countByType[ex.type]}×</p>
                    )}
                  </div>
                </div>
                <p className="text-slate-300 text-sm mt-1">{ex.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {ex.best_for.map(tag => (
                    <span key={tag} className="text-xs text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {history.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-slate-100 font-semibold mb-3">Recent Sessions</h3>
          <ul className="space-y-2">
            {history.slice(0, 5).map(s => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {EXERCISES.find(e => e.type === s.exercise_type)?.icon}{' '}
                  {EXERCISES.find(e => e.type === s.exercise_type)?.title || s.exercise_type}
                </span>
                <span className="text-slate-500 text-xs">
                  {new Date(s.completed_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
