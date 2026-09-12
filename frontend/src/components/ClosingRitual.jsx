import { useState, useEffect } from 'react'

export default function ClosingRitual({ sessionData, onComplete }) {
  const [stage, setStage] = useState('summary') // summary -> breathing -> affirmation -> intention -> complete
  const [breathCount, setBreathCount] = useState(0)
  const [breathPhase, setBreathPhase] = useState('in') // in -> hold -> out
  const [intention, setIntention] = useState('')
  const [showIntentionInput, setShowIntentionInput] = useState(false)

  // Auto-advance through breathing stages
  useEffect(() => {
    if (stage !== 'breathing') return

    const phaseTimings = { in: 3000, hold: 4000, out: 5000 }
    const phases = ['in', 'hold', 'out']
    const currentPhaseIndex = phases.indexOf(breathPhase)
    const nextPhaseIndex = (currentPhaseIndex + 1) % phases.length

    const timeout = setTimeout(() => {
      if (nextPhaseIndex === 0) {
        setBreathCount(prev => {
          if (prev + 1 >= 3) {
            setStage('affirmation')
            return prev
          }
          return prev + 1
        })
      }
      setBreathPhase(phases[nextPhaseIndex])
    }, phaseTimings[breathPhase])

    return () => clearTimeout(timeout)
  }, [stage, breathPhase, breathCount])

  // Auto-advance from summary to breathing after 3s
  useEffect(() => {
    if (stage === 'summary') {
      const timeout = setTimeout(() => setStage('breathing'), 3000)
      return () => clearTimeout(timeout)
    }
  }, [stage])

  // Auto-advance from affirmation to intention after 2s
  useEffect(() => {
    if (stage === 'affirmation') {
      const timeout = setTimeout(() => {
        setShowIntentionInput(true)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [stage])

  const handleIntentionSubmit = () => {
    setStage('complete')
  }

  const handleSkipIntention = () => {
    setStage('complete')
  }

  const getBreathingText = () => {
    const texts = {
      in: 'Breathe in...',
      hold: 'Hold...',
      out: 'Breathe out...'
    }
    return texts[breathPhase]
  }

  const getBreathingDuration = () => {
    const durations = { in: '3s', hold: '4s', out: '5s' }
    return durations[breathPhase]
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-accent-500/20">

        {/* Summary Stage */}
        {stage === 'summary' && (
          <div className="space-y-4 text-center animate-fadeIn">
            <h2 className="text-2xl font-bold text-white">Today's Session</h2>
            <div className="bg-slate-700/50 rounded-2xl p-4 space-y-3">
              <p className="text-slate-300 text-sm">
                <span className="font-semibold">Topics Explored:</span>
              </p>
              <p className="text-accent-300 text-base leading-relaxed">
                {sessionData.summary || "You shared your thoughts and feelings with honesty and courage."}
              </p>
              {sessionData.moodStart && sessionData.moodEnd && (
                <p className="text-slate-400 text-xs pt-2 border-t border-slate-600">
                  Mood: {sessionData.moodStart}/10 → {sessionData.moodEnd}/10
                </p>
              )}
            </div>
            <p className="text-slate-500 text-xs">Grounding in progress...</p>
          </div>
        )}

        {/* Breathing Stage */}
        {stage === 'breathing' && (
          <div className="space-y-8 text-center animate-fadeIn">
            <h2 className="text-2xl font-bold text-white">Let's Ground You</h2>

            {/* Breathing Circle */}
            <div className="relative w-48 h-48 mx-auto">
              <div
                className={`absolute inset-0 rounded-full border-4 border-accent-500/30 transition-all duration-1000 ${
                  breathPhase === 'in' ? 'scale-75' : breathPhase === 'hold' ? 'scale-100' : 'scale-125'
                }`}
              />
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                <p className="text-3xl font-bold text-accent-300">{getBreathingText()}</p>
                <p className="text-sm text-slate-400">{getBreathingDuration()}</p>
              </div>
            </div>

            <p className="text-slate-400 text-sm">
              Breath {breathCount + 1} of 3
            </p>
          </div>
        )}

        {/* Affirmation Stage */}
        {stage === 'affirmation' && (
          <div className="space-y-4 text-center animate-fadeIn">
            <div className="text-5xl mb-4">💙</div>
            <h3 className="text-xl font-semibold text-white">You're Doing Great</h3>
            <p className="text-slate-300 leading-relaxed">
              You showed up for yourself today. That takes courage. {sessionData.affirmation || "You're doing important work."}
            </p>
            {!showIntentionInput && (
              <p className="text-slate-500 text-xs pt-2">Setting intention...</p>
            )}
          </div>
        )}

        {/* Intention Stage */}
        {stage === 'affirmation' && showIntentionInput && (
          <div className="space-y-4 mt-4 animate-fadeIn">
            <p className="text-slate-300 text-sm font-semibold">One thing you'll remember:</p>
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g., 'I'm stronger than I think'"
              className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 focus:ring-2 focus:ring-accent-500/20 transition-all text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleIntentionSubmit()
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleIntentionSubmit}
                className="flex-1 bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-accent-500/50 transition-all"
              >
                Set Intention
              </button>
              <button
                onClick={handleSkipIntention}
                className="flex-1 bg-slate-700/60 border border-slate-600/50 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Complete Stage */}
        {stage === 'complete' && (
          <div className="space-y-6 text-center animate-fadeIn">
            <div className="text-6xl">✨</div>
            <h2 className="text-2xl font-bold text-white">Session Complete</h2>

            <div className="bg-slate-700/50 rounded-2xl p-4 space-y-2">
              {intention && (
                <>
                  <p className="text-slate-400 text-xs">Your intention:</p>
                  <p className="text-accent-300 font-semibold italic">"{intention}"</p>
                </>
              )}
              <p className="text-slate-400 text-xs pt-3 border-t border-slate-600">
                Your next session is waiting for you tomorrow. 💙
              </p>
            </div>

            <button
              onClick={onComplete}
              className="w-full bg-gradient-to-r from-accent-500 to-accent-600 text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg hover:shadow-accent-500/50 transition-all"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
