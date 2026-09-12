import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

const PHASES = [
  { label: 'Inhale', duration: 4, color: 'from-blue-400 to-blue-500', bg: 'bg-blue-500' },
  { label: 'Hold', duration: 4, color: 'from-purple-400 to-purple-500', bg: 'bg-purple-500' },
  { label: 'Exhale', duration: 4, color: 'from-teal-400 to-teal-500', bg: 'bg-teal-500' },
  { label: 'Hold', duration: 4, color: 'from-indigo-400 to-indigo-500', bg: 'bg-indigo-500' },
]
const TOTAL_CYCLES = 4

export default function Breathing() {
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState(0)
  const [tick, setTick] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [done, setDone] = useState(false)
  const intervalRef = useRef(null)

  const current = PHASES[phase]
  const scale = running
    ? phase === 0 ? 1 + (tick / current.duration) * 0.6
      : phase === 2 ? 1.6 - (tick / current.duration) * 0.6
      : phase === 1 ? 1.6 : 1
    : 1

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setTick(prev => {
        const next = prev + 1
        if (next >= PHASES[phase].duration) {
          const nextPhase = (phase + 1) % 4
          const nextCycle = nextPhase === 0 ? cycle + 1 : cycle
          if (nextPhase === 0 && nextCycle >= TOTAL_CYCLES) {
            setRunning(false)
            finishSession()
            return 0
          }
          setPhase(nextPhase)
          setCycle(nextCycle)
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running, phase, cycle])

  const finishSession = async () => {
    setDone(true)
    try {
      await axios.post(`${API_BASE}/exercises/session`, { exercise_type: 'breathing', responses: { cycles: TOTAL_CYCLES } })
    } catch {}
  }

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setPhase(0)
    setTick(0)
    setCycle(0)
    setDone(false)
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <p className="text-6xl">🌊</p>
        <h2 className="text-2xl font-bold text-slate-100">Session complete</h2>
        <p className="text-slate-400">{TOTAL_CYCLES} cycles of box breathing. Your nervous system is settling.</p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={reset} className="px-5 py-2.5 border border-blue-500/40 text-blue-300 rounded-xl text-sm hover:border-blue-400 transition-colors">
            Go again
          </button>
          <Link to="/exercises" className="px-5 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-white rounded-xl text-sm font-semibold">
            Back to exercises
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌬️</span>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Box Breathing</h2>
            <p className="text-slate-500 text-xs">4-4-4-4 · {TOTAL_CYCLES} cycles</p>
          </div>
        </div>
        <Link to="/exercises" className="text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Exercises
        </Link>
      </div>

      {/* Cycle dots */}
      <div className="flex justify-center gap-2">
        {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
          <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${i < cycle ? 'bg-blue-500' : i === cycle && running ? 'bg-blue-400 animate-pulse' : 'bg-slate-700'}`} />
        ))}
      </div>

      {/* Animated circle */}
      <div className="flex flex-col items-center py-10">
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          {/* Outer ring */}
          <div
            className={`absolute rounded-full border-4 transition-all duration-1000 ease-in-out ${running ? `border-${current.bg.replace('bg-', '')} opacity-30` : 'border-slate-700 opacity-20'}`}
            style={{ width: 220, height: 220 }}
          />
          {/* Breathing circle */}
          <div
            className={`rounded-full bg-gradient-to-br ${running ? current.color : 'from-slate-600 to-slate-700'} transition-all duration-1000 ease-in-out shadow-2xl`}
            style={{
              width: 120,
              height: 120,
              transform: `scale(${scale})`,
              boxShadow: running ? `0 0 60px rgba(99,102,241,0.4)` : 'none',
            }}
          />
          {/* Center text */}
          <div className="absolute text-center">
            <p className="text-white font-bold text-lg leading-none">{running ? current.label : 'Ready'}</p>
            {running && (
              <p className="text-white/70 text-2xl font-mono mt-1">{current.duration - tick}</p>
            )}
          </div>
        </div>
      </div>

      {!running ? (
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">
            Inhale for 4 · Hold for 4 · Exhale for 4 · Hold for 4
          </p>
          <button
            onClick={() => setRunning(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-3 rounded-2xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            Begin
          </button>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-slate-300 text-sm">{current.label} for {current.duration} seconds</p>
          <button onClick={reset} className="text-slate-500 text-xs hover:text-slate-300 transition-colors">
            Stop
          </button>
        </div>
      )}
    </div>
  )
}
