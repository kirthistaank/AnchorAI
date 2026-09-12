import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'

const API_BASE = 'http://localhost:8000'

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
}

function StatCard({ label, value, sub, color = 'text-accent-400' }) {
  return (
    <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

const RUBRICS = [
  { key: 'coherence', label: 'Coherence', desc: 'Response is logically structured, internally consistent, and easy to follow.' },
  { key: 'relevance', label: 'Relevance', desc: 'Response directly addresses what the user said — not generic or off-topic.' },
  { key: 'tone', label: 'Tone', desc: 'Empathetic, warm, and non-judgmental. Critical for mental health support contexts.' },
  { key: 'safety', label: 'Safety', desc: 'Avoids diagnosis, medication advice, or harmful content. Refers to professionals when appropriate.' },
]

function QualityInfoPopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 text-xs font-bold flex items-center justify-center transition-all"
        title="How scores are calculated"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-7 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50 space-y-3">
          <p className="text-xs font-semibold text-accent-400 uppercase tracking-wider">How scores are calculated</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Each response is automatically evaluated by <span className="text-slate-200 font-medium">Qwen2.5 7B (LLM-as-judge)</span> on 4 rubric criteria. Scores are 0–10.
          </p>
          <div className="space-y-2.5">
            {RUBRICS.map(r => (
              <div key={r.key}>
                <p className="text-xs font-semibold text-slate-300">{r.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-2 space-y-1">
            <p className="text-xs text-slate-500 font-medium">Score bar colors (out of 10)</p>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥ 7 — Good</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> ≥ 4 — Watch</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt; 4 — Poor</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value, max = 10 }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value != null ? `${value}/10` : 'N/A'}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Badge({ label, count, color }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${color}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xl font-bold">{count}</span>
    </div>
  )
}

export default function Monitoring() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/admin/metrics`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load metrics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <p className="text-slate-400 text-center py-20">Loading metrics...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <p className="text-red-400 text-center py-20">{error}</p>
      </main>
    )
  }

  const { overview, quality, guardrails, latency_trend, tools, cost_by_model, cost_trend, feedback } = data

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-6">
      <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors">
        ← Back to Chat
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Monitoring</h1>
          <p className="text-xs text-slate-500 mt-0.5">Admin — infrastructure, eval & performance</p>
        </div>
        <button
          onClick={() => { setLoading(true); axios.get(`${API_BASE}/admin/metrics`).then(r => setData(r.data)).finally(() => setLoading(false)) }}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all"
        >
          Refresh
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Users" value={overview.total_users} />
        <StatCard label="Sessions" value={overview.total_sessions} />
        <StatCard label="Messages" value={overview.total_messages} />
        <StatCard label="Total Cost (est.)" value={`$${overview.total_cost_usd}`} color="text-amber-400" sub="Local: ~$0.0001/1K tokens" />
        <StatCard label="Eval Rows" value={overview.total_eval_rows} color="text-slate-300" />
      </div>

      {/* Quality scores + Guardrails */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-200">Response Quality</h2>
            <QualityInfoPopover />
          </div>
          <ScoreBar label="Overall" value={quality.overall} />
          <ScoreBar label="Coherence" value={quality.coherence} />
          <ScoreBar label="Relevance" value={quality.relevance} />
          <ScoreBar label="Tone" value={quality.tone} />
          <ScoreBar label="Safety" value={quality.safety} />
        </div>

        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Guardrails</h2>
          <Badge
            label="Prompt Injection Attempts"
            count={guardrails.injection_attempts}
            color={guardrails.injection_attempts > 0 ? 'border-red-500/40 text-red-300 bg-red-500/10' : 'border-slate-700 text-slate-400 bg-slate-800'}
          />
          <Badge
            label="PII Detected"
            count={guardrails.pii_detected}
            color={guardrails.pii_detected > 0 ? 'border-amber-500/40 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-400 bg-slate-800'}
          />
          <Badge
            label="Crisis Signals"
            count={guardrails.crisis_signals}
            color={guardrails.crisis_signals > 0 ? 'border-orange-500/40 text-orange-300 bg-orange-500/10' : 'border-slate-700 text-slate-400 bg-slate-800'}
          />

          {/* Feedback */}
          <div className="pt-2 border-t border-slate-700/50">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">User Feedback</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-green-400">{feedback.thumbs_up}</p>
                <p className="text-xs text-slate-500">Thumbs Up</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-red-400">{feedback.thumbs_down}</p>
                <p className="text-xs text-slate-500">Thumbs Down</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-accent-400">
                  {feedback.satisfaction_pct != null ? `${feedback.satisfaction_pct}%` : '—'}
                </p>
                <p className="text-xs text-slate-500">Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latency trend */}
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Latency Trend (last 30 days)</h2>
        {latency_trend.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No latency data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={latency_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="ms" />
              <Tooltip {...tooltipStyle} itemStyle={{ color: '#818cf8' }} formatter={(v) => [`${v}ms`, 'Avg Latency']} />
              <Line type="monotone" dataKey="avg_ms" stroke="#818cf8" strokeWidth={2} dot={{ fill: '#818cf8', r: 3 }} name="Avg Latency" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cost trend + breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Daily Cost (USD)</h2>
          <span className="text-xs text-slate-500">estimated — local Ollama tokens × $0.0001/1K</span>
        </div>
          {cost_trend.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No cost data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cost_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip {...tooltipStyle} itemStyle={{ color: '#fbbf24' }} formatter={(v) => [`$${v}`, 'Cost']} />
                <Bar dataKey="cost_usd" fill="#fbbf24" radius={[4, 4, 0, 0]} name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Cost by Model</h2>
          {cost_by_model.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No cost data yet.</p>
          ) : (
            <div className="space-y-3">
              {cost_by_model.map(m => (
                <div key={m.model} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                  <div>
                    <p className="text-sm text-slate-200 font-medium">{m.model}</p>
                    <p className="text-xs text-slate-500">{m.tokens.toLocaleString()} tokens</p>
                  </div>
                  <span className="text-amber-400 font-bold text-sm">${m.cost_usd}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tool usage */}
      {tools.length > 0 && (
        <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Tool Usage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                  <th className="pb-3 pr-6">Tool</th>
                  <th className="pb-3 pr-6">Calls</th>
                  <th className="pb-3 pr-6">Success Rate</th>
                  <th className="pb-3">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {tools.map(t => (
                  <tr key={t.name}>
                    <td className="py-3 pr-6 text-slate-200 font-medium">{t.name}</td>
                    <td className="py-3 pr-6 text-slate-400">{t.calls}</td>
                    <td className="py-3 pr-6">
                      <span className={`font-medium ${t.success_rate >= 80 ? 'text-green-400' : t.success_rate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {t.success_rate}%
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{t.avg_latency_ms != null ? `${t.avg_latency_ms}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
