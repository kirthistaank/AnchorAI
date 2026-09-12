import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const DISTORTIONS = [
  'All-or-nothing thinking',
  'Catastrophising',
  'Mind reading',
  'Fortune telling',
  'Emotional reasoning',
  'Overgeneralisation',
  'Personalisation',
  'Should statements',
  'Labelling',
  'Magnification / minimisation',
]

const STEPS = [
  {
    id: 'situation',
    title: 'Describe the Situation',
    prompt: 'What happened? Where were you? Who was there? Stick to the facts.',
    placeholder: 'e.g. My manager gave feedback on my report in front of the team…',
    type: 'textarea',
  },
  {
    id: 'automatic_thought',
    title: 'Automatic Thought',
    prompt: 'What went through your mind in that moment? Write it exactly as it appeared.',
    placeholder: 'e.g. "I\'m terrible at my job and everyone noticed."',
    type: 'textarea',
  },
  {
    id: 'emotion',
    title: 'Emotions & Intensity',
    prompt: 'What emotions did you feel? Rate each from 0–100%.',
    placeholder: 'e.g. Shame 80%, anxiety 60%, anger 30%',
    type: 'textarea',
  },
  {
    id: 'distortions',
    title: 'Cognitive Distortions',
    prompt: 'Which thinking patterns can you spot in that automatic thought?',
    type: 'checkboxes',
  },
  {
    id: 'balanced_thought',
    title: 'Balanced Response',
    prompt: 'Write a more balanced, realistic thought. Consider: what evidence supports or contradicts your automatic thought? What would you tell a friend?',
    placeholder: 'e.g. "My manager pointed out one specific area. I do good work overall and this is a chance to improve."',
    type: 'textarea',
  },
  {
    id: 'outcome',
    title: 'Outcome',
    prompt: 'How do you feel now after the balanced response? Re-rate the original emotions.',
    placeholder: 'e.g. Shame now 30%, anxiety 25%. I feel more grounded.',
    type: 'textarea',
  },
]

export default function ThoughtRecord() {
  const [step, setStep] = useState(0)
  const [responses, setResponses] = useState({})
  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const setValue = (val) => setResponses(prev => ({ ...prev, [current.id]: val }))
  const currentValue = responses[current.id] || ''

  const toggleDistortion = (d) => {
    setSelected(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const handleNext = () => {
    if (current.type === 'checkboxes') {
      setResponses(prev => ({ ...prev, distortions: selected }))
    }
    if (isLast) {
      submitSession()
    } else {
      setStep(s => s + 1)
    }
  }

  const canProceed = current.type === 'checkboxes'
    ? selected.length > 0
    : currentValue.trim().length > 0

  const submitSession = async () => {
    setSubmitting(true)
    const finalResponses = { ...responses, distortions: selected }
    try {
      await axios.post(`${API_BASE}/exercises/session`, {
        exercise_type: 'thought_record',
        responses: finalResponses,
      })
      setDone(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <p className="text-6xl">✅</p>
        <h2 className="text-2xl font-bold text-slate-100">Well done!</h2>
        <p className="text-slate-400">
          You completed a thought record. Regularly challenging automatic thoughts builds resilience over time.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => { setStep(0); setResponses({}); setSelected([]); setDone(false) }}
            className="px-5 py-2.5 border border-accent-500/40 text-accent-300 rounded-xl text-sm hover:border-accent-400 transition-colors">
            Do another
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
          <span className="text-2xl">📝</span>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Thought Record</h2>
            <p className="text-slate-500 text-xs">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>
        <Link to="/exercises" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Exercises
        </Link>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-accent-500 to-accent-400 h-1.5 rounded-full transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="bg-slate-800/60 border border-purple-500/20 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-purple-300">{current.title}</h3>
          <p className="text-slate-400 text-sm mt-1">{current.prompt}</p>
        </div>

        {current.type === 'textarea' ? (
          <textarea
            value={currentValue}
            onChange={e => setValue(e.target.value)}
            placeholder={current.placeholder}
            rows={4}
            autoFocus
            className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/80 focus:ring-2 focus:ring-purple-500/10 transition-all resize-none text-sm"
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {DISTORTIONS.map(d => (
              <button
                key={d}
                onClick={() => toggleDistortion(d)}
                className={`text-left px-3 py-2 rounded-xl text-xs border transition-all ${
                  selected.includes(d)
                    ? 'bg-purple-500/30 border-purple-500/60 text-purple-200'
                    : 'bg-slate-700/40 border-slate-600/40 text-slate-400 hover:border-slate-500'
                }`}
              >
                {selected.includes(d) && '✓ '}{d}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="text-sm text-slate-400 hover:text-slate-300 disabled:opacity-0 transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed || submitting}
            className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-accent-500/30"
          >
            {submitting ? 'Saving…' : isLast ? 'Complete ✓' : 'Next →'}
          </button>
        </div>
      </div>

      {/* Summary of previous answers */}
      {step > 0 && (
        <div className="space-y-2">
          {STEPS.slice(0, step).map(s => (
            <div key={s.id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-2.5 text-sm">
              <span className="text-slate-500 text-xs uppercase tracking-wider">{s.title}: </span>
              <span className="text-slate-300">
                {s.type === 'checkboxes'
                  ? (responses.distortions || []).join(', ') || '—'
                  : responses[s.id] || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
