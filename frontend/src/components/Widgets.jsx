import { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

// Deterministic pick by day-of-year so the same card shows all day
const byDay = (arr, offset = 0) => {
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return arr[(doy + offset) % arr.length]
}

// ─── Content libraries ──────────────────────────────────────────────────────

const JIM_ROHN_QUOTES = [
  { q: "Either you run the day or the day runs you.", },
  { q: "Don't wish it were easier; wish you were better." },
  { q: "You are the average of the five people you spend the most time with." },
  { q: "Success is nothing more than a few simple disciplines, practiced every day." },
  { q: "Your life does not get better by chance, it gets better by change." },
  { q: "Motivation is what gets you started. Habit is what keeps you going." },
  { q: "If you don't design your own life plan, chances are you'll fall into someone else's plan." },
  { q: "Discipline is the bridge between goals and accomplishment." },
  { q: "We must all suffer from one of two pains: the pain of discipline or the pain of regret." },
  { q: "Happiness is not something you postpone for the future; it is something you design for the present." },
  { q: "Time is more valuable than money. You can get more money, but you cannot get more time." },
  { q: "Learn how to be happy with what you have while you pursue all that you want." },
  { q: "Formal education will make you a living; self-education will make you a fortune." },
  { q: "Stand guard at the door of your mind." },
  { q: "Work harder on yourself than you do on your job." },
  { q: "Rich people have small TVs and big libraries, and poor people have small libraries and big TVs." },
  { q: "Take care of your body. It's the only place you have to live." },
  { q: "If you are not willing to risk the unusual, you will have to settle for the ordinary." },
  { q: "The more you know the less you need to say." },
  { q: "Days are expensive. When you spend a day you have one less day to spend." },
  { q: "Miss a meal if you have to, but don't miss a book." },
  { q: "Give whatever you are doing and whoever you are with the gift of your attention." },
  { q: "The philosophy of the rich and the poor is this: the rich invest their money and spend what is left; the poor spend their money and invest what is left." },
  { q: "You cannot change your destination overnight, but you can change your direction overnight." },
  { q: "Profits are better than wages. Wages make you a living; profits make you a fortune." },
  { q: "The worst thing one can do is not to try, to be aware of what one wants and not give in to it." },
  { q: "Start from wherever you are and with whatever you've got." },
  { q: "You don't get paid for the hour. You get paid for the value you bring to the hour." },
  { q: "Pity the man who inherits a million and isn't a millionaire. Here's what would be pitiful: if your income grew and you didn't." },
  { q: "The major value in life is not what you get. The major value in life is what you become." },
]

const OTHER_QUOTES = [
  { q: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { q: "What you think, you become. What you feel, you attract. What you imagine, you create.", author: "Buddha" },
  { q: "Energy flows where intention goes.", author: "Tony Robbins" },
  { q: "Do not wait; the time will never be 'just right'. Start where you stand.", author: "Napoleon Hill" },
  { q: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein" },
  { q: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { q: "If you can dream it, you can do it.", author: "Walt Disney" },
  { q: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { q: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { q: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { q: "What we think, we become.", author: "Buddha" },
  { q: "The mind is everything. What you think you become.", author: "Buddha" },
  { q: "An unexamined life is not worth living.", author: "Socrates" },
  { q: "Abundance is not something we acquire. It is something we tune into.", author: "Wayne Dyer" },
  { q: "You create your thoughts, your thoughts create your intentions, and your intentions create your reality.", author: "Wayne Dyer" },
  { q: "When you change the way you look at things, the things you look at change.", author: "Wayne Dyer" },
  { q: "Your whole life is a manifestation of the thoughts that go on in your head.", author: "Lisa Nichols" },
  { q: "Whatever the mind of man can conceive and believe, it can achieve.", author: "Napoleon Hill" },
  { q: "It's not about having the right opportunities. It's about handling the opportunities right.", author: "Mark Hunter" },
  { q: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
]

const AFFIRMATIONS = [
  "I am becoming the best version of myself, one day at a time.",
  "I attract abundance, health, and joy into my life effortlessly.",
  "Every challenge I face is an opportunity to grow stronger.",
  "I am worthy of all the good that flows into my life.",
  "My mind is calm, my heart is open, my energy is magnetic.",
  "I radiate positive energy and it comes back to me multiplied.",
  "I am aligned with my purpose and moving toward it with confidence.",
  "Today I choose growth over comfort and action over fear.",
  "I am grateful for this moment and excited about what is coming.",
  "The universe is always working in my favour — I trust the process.",
  "I release what no longer serves me and welcome what lifts me higher.",
  "I am in perfect harmony with the energy of success and wellbeing.",
  "My potential is limitless and I step into it fully today.",
  "I am disciplined, focused, and deeply at peace.",
  "Everything I need is already within me — I choose to access it now.",
  "I show up as my highest self in every interaction today.",
  "Wealth, health, love, and happiness flow to me naturally.",
  "I am a magnet for miracles and I expect great things today.",
  "I honour my body, my mind, and my spirit — they are my greatest assets.",
  "I am exactly where I need to be, and I am moving forward.",
]

const JIM_ROHN_HABITS = [
  { habit: "Read for 30 minutes", detail: "Leaders are readers. Even 10 pages a day = 3,650 pages a year — that's 10+ books." },
  { habit: "Review your goals morning and night", detail: "If you don't know where you're going, any road will get you there. Read your goals daily." },
  { habit: "Journal your thoughts", detail: "If you're serious about becoming a wealthy, powerful, sophisticated person, keep a journal." },
  { habit: "Exercise your body daily", detail: "Take care of your body. It's the only place you have to live." },
  { habit: "Practice gratitude", detail: "Gratitude is the healthiest of all human emotions. Count your blessings, not your troubles." },
  { habit: "Invest in your education", detail: "Formal education makes you a living. Self-education makes you a fortune." },
  { habit: "Guard your associations", detail: "You are the average of the five people you spend the most time with — choose wisely." },
  { habit: "Plan your week on Sunday", detail: "Without a plan, even the most brilliant team will lose to a disciplined opponent." },
  { habit: "Give more than you receive", detail: "Give what you can, whenever you can. The seeds you plant today are the harvest of tomorrow." },
  { habit: "Practice the discipline of saving", detail: "Save 10% of all you earn. It's not the amount, it's the habit that sets you free." },
  { habit: "Turn off the TV — read instead", detail: "Rich people have big libraries. Poor people have big TVs. The choice is yours." },
  { habit: "Work on your craft for one extra hour a day", detail: "One extra hour per day = 365 hours per year = more than nine 40-hour work weeks of advantage." },
  { habit: "Spend time in silence and reflection", detail: "Take time to gather up the past so that you will be able to draw from your experience and invest them in the future." },
  { habit: "Master your emotions, don't suppress them", detail: "Don't let your emotions control your thinking. Let your thinking control your emotions." },
  { habit: "Set goals in all areas of life", detail: "Set goals that make you reach — for your career, health, relationships, finances, and spirit." },
]

const VIBRATION_TIPS = [
  { emoji: "🌅", tip: "Start your morning before the world wakes you up. Own the first hour." },
  { emoji: "🧘", tip: "Five deep breaths right now. In for 4, hold for 4, out for 6. Reset your state." },
  { emoji: "🌊", tip: "You can't control the waves, but you can learn to surf. Ride today with ease." },
  { emoji: "🔥", tip: "Your energy introduces you before you even speak. What does yours say today?" },
  { emoji: "💎", tip: "You are not a drop in the ocean. You are the entire ocean in a drop." },
  { emoji: "🌱", tip: "Small consistent actions compound into extraordinary results. Show up today." },
  { emoji: "✨", tip: "What you appreciate, appreciates. Find three things around you right now to be grateful for." },
  { emoji: "🦁", tip: "Courage is not the absence of fear — it's deciding that something else matters more." },
  { emoji: "🌙", tip: "How you end your day programs your subconscious overnight. End with gratitude." },
  { emoji: "🎯", tip: "Clarity is power. Get clear on what you want, and the universe conspires to deliver it." },
  { emoji: "🌞", tip: "Your vibe is contagious. Be the energy you want to be around." },
  { emoji: "💫", tip: "The goal is not to be better than others. It's to be better than you were yesterday." },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function QuoteCard() {
  // Alternate between Jim Rohn and other speakers
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const useJim = doy % 3 !== 0  // 2 out of 3 days show Jim Rohn
  const item = useJim
    ? byDay(JIM_ROHN_QUOTES, 0)
    : byDay(OTHER_QUOTES, 7)

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">💬</span>
        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Quote of the Day</span>
      </div>
      <p className="text-slate-200 text-sm leading-relaxed italic">"{item.q}"</p>
      <p className="text-amber-400 text-xs font-semibold">
        — {item.author || 'Jim Rohn'}
      </p>
    </div>
  )
}

function AffirmationCard() {
  const affirmation = byDay(AFFIRMATIONS, 3)
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">✨</span>
        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Daily Affirmation</span>
      </div>
      <p className="text-slate-200 text-sm leading-relaxed font-medium">{affirmation}</p>
      <p className="text-purple-400 text-xs">Say this out loud. Mean it.</p>
    </div>
  )
}

function HabitCard() {
  const item = byDay(JIM_ROHN_HABITS, 5)
  return (
    <div className="bg-gradient-to-br from-green-500/10 to-teal-500/5 border border-green-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🌱</span>
        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Jim Rohn Habit</span>
      </div>
      <p className="text-green-300 text-sm font-semibold">{item.habit}</p>
      <p className="text-slate-400 text-xs leading-relaxed">{item.detail}</p>
    </div>
  )
}

function VibrationCard() {
  const item = byDay(VIBRATION_TIPS, 9)
  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Raise Your Vibration</span>
      </div>
      <div className="flex gap-2 items-start">
        <span className="text-2xl flex-shrink-0">{item.emoji}</span>
        <p className="text-slate-300 text-xs leading-relaxed">{item.tip}</p>
      </div>
    </div>
  )
}

function EnergyCard() {
  const [dominant, setDominant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API_BASE}/analytics/emotions?period=week`)
      .then(res => {
        const totals = res.data?.emotion_totals || {}
        const topEmotion = res.data?.top_emotions?.[0]
        if (topEmotion) {
          setDominant({ emotion: topEmotion, count: totals[topEmotion] || 0 })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ENERGY_MAP = {
    happy: { emoji: '😊', label: 'Positive', color: 'text-yellow-400', bg: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20' },
    joy: { emoji: '🌟', label: 'Joyful', color: 'text-yellow-300', bg: 'from-yellow-400/10 to-orange-500/5 border-yellow-400/20' },
    calm: { emoji: '🌊', label: 'Calm', color: 'text-blue-400', bg: 'from-blue-500/10 to-cyan-500/5 border-blue-500/20' },
    grateful: { emoji: '🙏', label: 'Grateful', color: 'text-green-400', bg: 'from-green-500/10 to-teal-500/5 border-green-500/20' },
    anxious: { emoji: '😰', label: 'Processing', color: 'text-orange-400', bg: 'from-orange-500/10 to-red-500/5 border-orange-500/20' },
    sad: { emoji: '💙', label: 'Reflective', color: 'text-blue-300', bg: 'from-blue-600/10 to-indigo-500/5 border-blue-600/20' },
    angry: { emoji: '🔥', label: 'Fired up', color: 'text-red-400', bg: 'from-red-500/10 to-orange-500/5 border-red-500/20' },
    frustrated: { emoji: '💪', label: 'Driven', color: 'text-orange-300', bg: 'from-orange-400/10 to-red-500/5 border-orange-400/20' },
    excited: { emoji: '⚡', label: 'Energised', color: 'text-accent-300', bg: 'from-accent-500/10 to-purple-500/5 border-accent-500/20' },
  }

  const config = dominant ? (ENERGY_MAP[dominant.emotion] || { emoji: '💫', label: 'Evolving', color: 'text-slate-300', bg: 'from-slate-600/20 to-slate-700/10 border-slate-600/30' }) : null

  return (
    <div className={`bg-gradient-to-br border rounded-2xl p-4 space-y-2 ${config ? config.bg : 'from-slate-700/20 to-slate-800/10 border-slate-700/30'}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">🧠</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Energy This Week</span>
      </div>
      {loading ? (
        <p className="text-slate-500 text-xs">Reading your energy…</p>
      ) : !dominant ? (
        <p className="text-slate-500 text-xs">Chat more to see your energy pattern emerge.</p>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-3xl">{config.emoji}</span>
          <div>
            <p className={`font-bold text-sm ${config.color}`}>{config.label}</p>
            <p className="text-slate-500 text-xs capitalize">Most felt: {dominant.emotion} ({dominant.count}×)</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function Widgets() {
  return (
    <aside className="flex flex-col gap-3 w-72 flex-shrink-0">
      <QuoteCard />
      <AffirmationCard />
      <HabitCard />
      <VibrationCard />
      <EnergyCard />
    </aside>
  )
}
