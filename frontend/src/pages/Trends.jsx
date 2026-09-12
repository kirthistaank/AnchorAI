import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { getToken } from '../services/auth'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import '../services/auth'

const API_BASE = 'http://localhost:8000'

export default function Trends() {
  const [trends, setTrends] = useState([])
  const [distribution, setDistribution] = useState(null)
  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [patterns, setPatterns] = useState(null)
  const [patternsLoading, setPatternsLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  const [playing, setPlaying] = useState(null) // 'summary' | 'patterns' | null
  const audioRef = useRef(null)
  const llmFetched = useRef(false)

  const playTTS = useCallback(async (text, id) => {
    // Stop current audio if same button clicked again
    if (playing === id) {
      audioRef.current?.pause()
      setPlaying(null)
      return
    }
    audioRef.current?.pause()
    setPlaying(id)
    try {
      const resp = await fetch(`${API_BASE}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text }),
      })
      if (!resp.ok) throw new Error('TTS unavailable')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPlaying(null); URL.revokeObjectURL(url) }
      audio.onerror = () => setPlaying(null)
      audio.play()
    } catch {
      setPlaying(null)
    }
  }, [playing])

  useEffect(() => { fetchCharts() }, [days])
  useEffect(() => {
    if (llmFetched.current) return
    llmFetched.current = true
    fetchSummary()
    fetchPatterns()
  }, [])

  const fetchCharts = async () => {
    setLoading(true)
    try {
      const [trendsRes, distRes] = await Promise.all([
        axios.get(`${API_BASE}/analytics/mood-trends?days=${days}`),
        axios.get(`${API_BASE}/analytics/mood-distribution?days=${days}`),
      ])
      setTrends(trendsRes.data)
      setDistribution(distRes.data)
    } catch (err) {
      console.error('Failed to fetch trends:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    setSummaryLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/analytics/weekly-summary`)
      setSummary(res.data.summary)
    } catch (err) {
      console.error('Failed to fetch summary:', err)
    } finally {
      setSummaryLoading(false)
    }
  }

  const fetchPatterns = async () => {
    setPatternsLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/analytics/patterns`)
      setPatterns(res.data)
    } catch (err) {
      console.error('Failed to fetch patterns:', err)
    } finally {
      setPatternsLoading(false)
    }
  }

  const distData = distribution
    ? Object.entries(distribution.distribution).map(([scale, count]) => ({
        scale: `${scale}/10`,
        count,
      }))
    : []

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 },
    labelStyle: { color: '#94a3b8' },
  }

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Mood Trends</h1>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 text-slate-200 rounded-xl px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20">Loading trends...</div>
      ) : (
        <>
          {distribution && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Average Mood" value={`${distribution.average}/10`} />
              <StatCard label="Total Logs" value={distribution.total_entries} />
              <StatCard label="Days Tracked" value={trends.length} />
            </div>
          )}

          <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Daily Average Mood</h2>
            {trends.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No mood data yet. Start logging your mood in the chat!
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis domain={[1, 10]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: '#818cf8' }} />
                  <Line
                    type="monotone"
                    dataKey="avg_mood"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={{ fill: '#818cf8', r: 4 }}
                    name="Avg Mood"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {distData.length > 0 && (
            <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-slate-200 mb-4">Mood Distribution</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="scale" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} itemStyle={{ color: '#818cf8' }} />
                  <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} name="Entries" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-slate-800/60 rounded-2xl p-6 border border-accent-500/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-200">Weekly Summary</h2>
              {summary && !summaryLoading && (
                <button
                  onClick={() => playTTS(summary, 'summary')}
                  title={playing === 'summary' ? 'Stop' : 'Listen to summary'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    playing === 'summary'
                      ? 'bg-accent-500/30 text-accent-300 animate-pulse'
                      : 'bg-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <span>{playing === 'summary' ? '⏹' : '🔊'}</span>
                  {playing === 'summary' ? 'Stop' : 'Listen'}
                </button>
              )}
            </div>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span className="animate-spin text-base">⏳</span> Generating summary…
              </div>
            ) : summary ? (
              <p className="text-slate-300 leading-relaxed">{summary}</p>
            ) : (
              <p className="text-slate-500 text-sm">No mood or journal data yet — start chatting to build your summary.</p>
            )}
          </div>

          <PatternsCard patterns={patterns} loading={patternsLoading} playing={playing} onPlay={playTTS} />
        </>
      )}
    </main>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-accent-400">{value}</p>
    </div>
  )
}

function PatternsCard({ patterns, loading, playing, onPlay }) {
  if (loading) {
    return (
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-200 mb-2">Triggers & Patterns</h2>
        <p className="text-slate-400 text-sm">Analysing your patterns...</p>
      </div>
    )
  }

  if (!patterns) return null

  if (!patterns.patterns) {
    return (
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-200 mb-2">Triggers & Patterns</h2>
        <p className="text-slate-400 text-sm">{patterns.message || 'Not enough data yet.'}</p>
      </div>
    )
  }

  const { triggers, helpers, insight } = patterns.patterns

  const patternsText = [
    insight ? `Key insight: ${insight}` : '',
    triggers?.length ? `Things that tend to lower your mood: ${triggers.join(', ')}.` : '',
    helpers?.length ? `Things that help you feel better: ${helpers.join(', ')}.` : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Triggers & Patterns</h2>
        {patternsText && (
          <button
            onClick={() => onPlay(patternsText, 'patterns')}
            title={playing === 'patterns' ? 'Stop' : 'Listen to patterns'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              playing === 'patterns'
                ? 'bg-accent-500/30 text-accent-300 animate-pulse'
                : 'bg-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            <span>{playing === 'patterns' ? '⏹' : '🔊'}</span>
            {playing === 'patterns' ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>

      {insight && (
        <div className="bg-accent-500/10 border border-accent-500/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-wider mb-1">Key Insight</p>
          <p className="text-slate-200 text-sm leading-relaxed">{insight}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {triggers?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">What tends to lower your mood</p>
            <ul className="space-y-2">
              {triggers.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">↓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {helpers?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">What tends to help</p>
            <ul className="space-y-2">
              {helpers.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">↑</span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {patterns.data_points && (
        <p className="text-xs text-slate-500">Based on {patterns.data_points} data points from the last 90 days</p>
      )}
    </div>
  )
}
