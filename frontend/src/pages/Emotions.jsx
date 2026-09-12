import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import '../services/auth'

const API_BASE = 'http://localhost:8000'

const EMOTION_COLORS = {
  happy:       '#facc15',
  joy:         '#84cc16',
  excited:     '#fb923c',
  content:     '#10b981',
  calm:        '#22d3ee',
  grateful:    '#4ade80',
  proud:       '#c084fc',
  loved:       '#f472b6',
  hopeful:     '#38bdf8',
  sad:         '#60a5fa',
  anxious:     '#fbbf24',
  angry:       '#f87171',
  frustrated:  '#fb923c',
  shame:       '#a78bfa',
  guilty:      '#94a3b8',
  disappointed:'#6b7280',
  scared:      '#ef4444',
  stressed:    '#f97316',
  lonely:      '#818cf8',
}

const PERIOD_LABELS = { week: 'Last 12 Weeks', month: 'Last 12 Months', year: 'All Years' }

const DEFAULT_COLOR = '#64748b'

export default function Emotions() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [period])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/analytics/emotions?period=${period}`)
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch emotion trends:', err)
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = !data || data.data.length === 0

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">How You've Been Feeling</h1>
        <div className="flex gap-2">
          {['week', 'month', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === p
                  ? 'bg-accent-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20">Analysing your emotions...</div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <EmotionFrequency totals={data.emotion_totals} topEmotions={data.top_emotions} />
          <EmotionChart chartData={data.data} topEmotions={data.top_emotions} periodLabel={PERIOD_LABELS[period]} />
        </>
      )}
    </main>
  )
}

function EmotionFrequency({ totals, topEmotions }) {
  const sorted = [...topEmotions]

  return (
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-4">Emotion Frequency</h2>
      <div className="flex flex-wrap gap-3">
        {sorted.map(emotion => {
          const count = totals[emotion] || 0
          const color = EMOTION_COLORS[emotion] || DEFAULT_COLOR
          return (
            <div
              key={emotion}
              className="flex items-center gap-2 bg-slate-700/60 rounded-xl px-4 py-2.5 border border-slate-600/40"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-200 text-sm capitalize">{emotion}</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: color + '30', color }}
              >
                {count}×
              </span>
            </div>
          )
        })}
      </div>

      {/* Horizontal bar per emotion */}
      <div className="mt-6 space-y-2">
        {sorted.map(emotion => {
          const count = totals[emotion] || 0
          const max = totals[sorted[0]] || 1
          const pct = Math.round((count / max) * 100)
          const color = EMOTION_COLORS[emotion] || DEFAULT_COLOR
          return (
            <div key={emotion} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-24 capitalize text-right">{emotion}</span>
              <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-slate-400 text-xs w-6 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmotionChart({ chartData, topEmotions, periodLabel }) {
  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 },
    labelStyle: { color: '#94a3b8' },
  }

  return (
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-200 mb-1">Emotions Over Time</h2>
      <p className="text-xs text-slate-500 mb-4">{periodLabel} — stacked by occurrence</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => (
              <span style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{value}</span>
            )}
          />
          {topEmotions.map(emotion => (
            <Bar
              key={emotion}
              dataKey={emotion}
              stackId="emotions"
              fill={EMOTION_COLORS[emotion] || DEFAULT_COLOR}
              name={emotion}
              radius={emotion === topEmotions[topEmotions.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-10 border border-slate-700/50 text-center">
      <p className="text-4xl mb-4">💭</p>
      <p className="text-slate-300 text-lg font-medium">No emotions tracked yet</p>
      <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
        Just chat naturally — when you mention feelings like "I'm feeling anxious" or "I'm so happy",
        they'll automatically be tracked here.
      </p>
      <Link
        to="/"
        className="inline-block mt-5 bg-accent-500 hover:bg-accent-400 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      >
        Start Chatting
      </Link>
    </div>
  )
}
