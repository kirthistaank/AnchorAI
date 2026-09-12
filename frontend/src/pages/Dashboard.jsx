import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import '../services/auth'

const API_BASE = 'http://localhost:8000'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/analytics/dashboard`)
      .then(res => setData(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Back to Chat
        </Link>
        <div className="text-center text-slate-400 py-20">Loading dashboard...</div>
      </main>
    )
  }

  if (error || !data || data.message) {
    return (
      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
          ← Back to Chat
        </Link>
        <h1 className="text-2xl font-bold text-slate-100">Monitoring Dashboard</h1>
        <div className="bg-slate-800/60 rounded-2xl p-8 border border-slate-700/50 text-center">
          <p className="text-slate-400 text-lg">No eval metrics yet.</p>
          <p className="text-slate-500 text-sm mt-2">
            Send some messages to start collecting performance data.
          </p>
        </div>
      </main>
    )
  }

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 },
    labelStyle: { color: '#94a3b8' },
  }

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>
      <h1 className="text-2xl font-bold text-slate-100">Monitoring Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Requests" value={data.total_requests} />
        <MetricCard label="Avg Latency" value={`${data.avg_latency_ms}ms`} />
        <MetricCard label="Avg Quality" value={`${data.avg_quality_score}/10`} />
        <MetricCard
          label="Crisis Signals"
          value={data.crisis_signals}
          highlight={data.crisis_signals > 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
          <p className="text-sm text-slate-400 mb-1">Injection Attempts Blocked</p>
          <p className="text-3xl font-bold text-red-400">{data.injection_attempts}</p>
          <p className="text-xs text-slate-500 mt-2">Prompt injection attacks caught by guardrails</p>
        </div>
        <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
          <p className="text-sm text-slate-400 mb-1">Crisis Signals Detected</p>
          <p className={`text-3xl font-bold ${data.crisis_signals > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.crisis_signals}
          </p>
          <p className="text-xs text-slate-500 mt-2">Routed to crisis support resources</p>
        </div>
      </div>

      {data.latency_trend?.length > 0 && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Latency Trend (ms)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.latency_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="ms" />
              <Tooltip {...tooltipStyle} itemStyle={{ color: '#34d399' }} />
              <Line
                type="monotone"
                dataKey="avg_latency_ms"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ fill: '#34d399', r: 4 }}
                name="Avg Latency"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
        <h2 className="text-base font-semibold text-slate-200 mb-3">Quality Scores (last 200 requests)</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400">Avg Quality</p>
            <p className="text-xl font-bold text-accent-400">{data.avg_quality_score}/10</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Total Analyzed</p>
            <p className="text-xl font-bold text-accent-400">{data.total_requests}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Safety Events</p>
            <p className="text-xl font-bold text-accent-400">{data.crisis_signals + data.injection_attempts}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
        <h2 className="text-base font-semibold text-slate-200 mb-3">User Satisfaction</h2>
        {data.satisfaction_pct == null ? (
          <p className="text-slate-400 text-sm">No ratings yet — thumbs up/down buttons appear below each response in chat.</p>
        ) : (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400">Satisfaction</p>
              <p className="text-2xl font-bold text-accent-400">{data.satisfaction_pct}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Helpful</p>
              <p className="text-2xl font-bold text-green-400">👍 {data.thumbs_up}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Not Helpful</p>
              <p className="text-2xl font-bold text-red-400">👎 {data.thumbs_down}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function MetricCard({ label, value, highlight }) {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-yellow-400' : 'text-accent-400'}`}>{value}</p>
    </div>
  )
}
