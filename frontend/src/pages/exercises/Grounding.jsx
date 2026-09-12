import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const STEPS = [
  {
    sense: 'sight',
    count: 5,
    icon: '👁️',
    instruction: 'Look around and name 5 things you can SEE',
    placeholder: (i) => `Thing ${i + 1} you can see…`,
    color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    accent: 'text-yellow-300',
  },
  {
    sense: 'touch',
    count: 4,
    icon: '✋',
    instruction: 'Notice 4 things you can FEEL or TOUCH',
    placeholder: (i) => `Thing ${i + 1} you can feel…`,
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
    accent: 'text-orange-300',
  },
  {
    sense: 'hearing',
    count: 3,
    icon: '👂',
    instruction: 'Listen for 3 things you can HEAR',
    placeholder: (i) => `Sound ${i + 1} you can hear…`,
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    accent: 'text-blue-300',
  },
  {
    sense: 'smell',
    count: 2,
    icon: '👃',
    instruction: 'Notice 2 things you can SMELL',
    placeholder: (i) => `Smell ${i + 1}…`,
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    accent: 'text-purple-300',
  },
  {
    sense: 'taste',
    count: 1,
    icon: '👅',
    instruction: 'Notice 1 thing you can TASTE',
    placeholder: () => `Taste you notice right now…`,
    color: 'from-pink-500/20 to-pink-600/10 border-pink-500/30',
    accent: 'text-pink-300',
  },
]

export default function Grounding() {
  const [step, setStep] = useState(0)
  const [inputs, setInputs] = useState({})
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const updateInput = (sense, i, val) => {
    setInputs(prev => ({
      ...prev,
      [sense]: { ...(prev[sense] || {}), [i]: val },
    }))
  }

  const stepComplete = () => {
    const vals = inputs[current.sense] || {}
    return Array.from({ length: current.count }).every((_, i) => (vals[i] || '').trim().length > 0)
  }

  const handleNext = async () => {
    if (isLast) {
      setSubmitting(true)
      try {
        await axios.post(`${API_BASE}/exercises/session`, {
          exercise_type: 'grounding',
          responses: inputs,
        })
        setDone(true)
      } catch (err) {
        console.error(err)
      } finally {
        setSubmitting(false)
      }
    } else {
      setStep(s => s + 1)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <p className="text-6xl">🌿</p>
        <h2 className="text-2xl font-bold text-slate-100">You're here</h2>
        <p className="text-slate-400">You've grounded yourself in the present moment. Notice how you feel now compared to when you started.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => { setStep(0); setInputs({}); setDone(false) }}
            className="px-5 py-2.5 border border-green-500/40 text-green-300 rounded-xl text-sm hover:border-green-400 transition-colors"
          >
            Do again
          </button>
          <Link to="/exercises" className="px-5 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-white rounded-xl text-sm font-semibold">
            Back to exercises
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <div>
            <h2 className="text-xl font-bold text-slate-100">5-4-3-2-1 Grounding</h2>
            <p className="text-slate-500 text-xs">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>
        <Link to="/exercises" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Exercises
        </Link>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s.sense}
            className={`flex-1 h-1.5 rounded-full transition-all ${i < step ? 'bg-green-500' : i === step ? 'bg-accent-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <div className={`bg-gradient-to-br ${current.color} border backdrop-blur-xl rounded-2xl p-6 space-y-4`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{current.icon}</span>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{current.count} things</p>
            <h3 className={`text-lg font-bold ${current.accent}`}>{current.instruction}</h3>
          </div>
        </div>

        <div className="space-y-2">
          {Array.from({ length: current.count }).map((_, i) => (
            <input
              key={i}
              value={(inputs[current.sense] || {})[i] || ''}
              onChange={e => updateInput(current.sense, i, e.target.value)}
              placeholder={current.placeholder(i)}
              autoFocus={i === 0}
              className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400 text-sm transition-all"
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="text-sm text-slate-400 hover:text-slate-300 disabled:opacity-0 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            disabled={!stepComplete() || submitting}
            className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-accent-500/30"
          >
            {submitting ? 'Saving…' : isLast ? 'Complete ✓' : 'Next →'}
          </button>
        </div>
      </div>

      {step > 0 && (
        <div className="space-y-2">
          {STEPS.slice(0, step).map(s => {
            const vals = inputs[s.sense] || {}
            const items = Array.from({ length: s.count }).map((_, i) => vals[i]).filter(Boolean)
            return (
              <div key={s.sense} className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-2.5">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{s.icon} {s.sense}</p>
                <p className="text-slate-300 text-sm">{items.join(' · ')}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
