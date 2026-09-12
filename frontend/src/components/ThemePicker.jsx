import { useState, useRef, useEffect } from 'react'

const THEMES = [
  { id: 'violet', label: 'Violet', swatch: '#8b5cf6',
    vars: { 'accent-50':'245 243 255','accent-100':'237 233 254','accent-200':'221 214 254','accent-300':'196 181 253','accent-400':'167 139 250','accent-500':'139 92 246','accent-600':'124 58 237','accent-700':'109 40 217','accent-800':'91 33 182','accent-900':'76 29 149' }},
  { id: 'blue', label: 'Blue', swatch: '#3b82f6',
    vars: { 'accent-50':'239 246 255','accent-100':'219 234 254','accent-200':'191 219 254','accent-300':'147 197 253','accent-400':'96 165 250','accent-500':'59 130 246','accent-600':'37 99 235','accent-700':'29 78 216','accent-800':'30 64 175','accent-900':'30 58 138' }},
  { id: 'emerald', label: 'Emerald', swatch: '#10b981',
    vars: { 'accent-50':'236 253 245','accent-100':'209 250 229','accent-200':'167 243 208','accent-300':'110 231 183','accent-400':'52 211 153','accent-500':'16 185 129','accent-600':'5 150 105','accent-700':'4 120 87','accent-800':'6 95 70','accent-900':'6 78 59' }},
  { id: 'rose', label: 'Rose', swatch: '#f43f5e',
    vars: { 'accent-50':'255 241 242','accent-100':'255 228 230','accent-200':'254 205 211','accent-300':'253 164 175','accent-400':'251 113 133','accent-500':'244 63 94','accent-600':'225 29 72','accent-700':'190 18 60','accent-800':'159 18 57','accent-900':'136 19 55' }},
  { id: 'amber', label: 'Amber', swatch: '#f59e0b',
    vars: { 'accent-50':'255 251 235','accent-100':'254 243 199','accent-200':'253 230 138','accent-300':'252 211 77','accent-400':'251 191 36','accent-500':'245 158 11','accent-600':'217 119 6','accent-700':'180 83 9','accent-800':'146 64 14','accent-900':'120 53 15' }},
  { id: 'teal', label: 'Teal', swatch: '#14b8a6',
    vars: { 'accent-50':'240 253 250','accent-100':'204 251 241','accent-200':'153 246 228','accent-300':'94 234 212','accent-400':'45 212 191','accent-500':'20 184 166','accent-600':'13 148 136','accent-700':'15 118 110','accent-800':'17 94 89','accent-900':'19 78 74' }},
]

function setVars(vars) {
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v))
}

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]
  setVars(theme.vars)
  localStorage.setItem('mc-theme', themeId)
}

export function initTheme() {
  const saved = localStorage.getItem('mc-theme') || 'violet'
  applyTheme(saved)
}

export default function ThemePicker() {
  const [active, setActive] = useState(() => localStorage.getItem('mc-theme') || 'violet')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (id) => {
    applyTheme(id)
    setActive(id)
    setOpen(false)
  }

  const current = THEMES.find(t => t.id === active)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Change theme colour"
        className="w-7 h-7 rounded-full border-2 border-white/30 hover:border-white/70 transition-all shadow-md"
        style={{ background: current?.swatch }}
      />
      {open && (
        <div className="absolute right-0 top-9 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl p-2.5 flex gap-2 z-[100]">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              title={t.label}
              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${active === t.id ? 'border-white scale-110' : 'border-transparent hover:border-white/50'}`}
              style={{ background: t.swatch }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
