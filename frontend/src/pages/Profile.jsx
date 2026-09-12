import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { authApi, getUserId } from '../services/auth'

const API_BASE = 'http://localhost:8000'

function utcToLocalHHMM(utcHHMM) {
  if (!utcHHMM) return '09:00'
  const [h, m] = utcHHMM.split(':').map(Number)
  const d = new Date()
  d.setUTCHours(h, m, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function localToUtcHHMM(localHHMM) {
  if (!localHHMM) return '09:00'
  const [h, m] = localHHMM.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

async function getVapidKey() {
  const res = await axios.get(`${API_BASE}/notifications/vapid-public-key`)
  return res.data.vapid_public_key
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [healthGoals, setHealthGoals] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [memories, setMemories] = useState([])
  const [memoriesLoading, setMemoriesLoading] = useState(true)

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({ reminder_enabled: false, reminder_time: '09:00', email_notifications: false })
  const [localReminderTime, setLocalReminderTime] = useState('09:00')
  const [notifSaved, setNotifSaved] = useState(false)
  const [pushStatus, setPushStatus] = useState('idle') // idle | subscribing | subscribed | error
  const [exportLoading, setExportLoading] = useState(false)
  const avatarInputRef = useRef(null)
  const userId = getUserId()
  const [avatarSrc, setAvatarSrc] = useState(() => localStorage.getItem(`avatar_${userId}`) || null)

  useEffect(() => {
    // Run all three fetches in parallel; profile loading gate always resolves
    authApi.getProfile()
      .then((res) => {
        setProfile(res.data)
        setHealthGoals(res.data.health_goals || '')
      })
      .catch((err) => console.error('Profile fetch failed:', err))
      .finally(() => setLoading(false))

    fetchMemories()
    fetchNotifPrefs()
  }, [])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      localStorage.setItem(`avatar_${userId}`, dataUrl)
      setAvatarSrc(dataUrl)
      window.dispatchEvent(new Event('avatar-updated'))
    }
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    localStorage.removeItem(`avatar_${userId}`)
    setAvatarSrc(null)
    window.dispatchEvent(new Event('avatar-updated'))
  }

  const fetchNotifPrefs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications/prefs`)
      setNotifPrefs(res.data)
      setLocalReminderTime(utcToLocalHHMM(res.data.reminder_time))
      if (res.data.push_subscribed) setPushStatus('subscribed')
    } catch {}
  }

  const saveNotifPrefs = async () => {
    try {
      const payload = { ...notifPrefs, reminder_time: localToUtcHHMM(localReminderTime) }
      await axios.put(`${API_BASE}/notifications/prefs`, payload)
      setNotifPrefs(payload)
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const subscribePush = async () => {
    setPushStatus('subscribing')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const vapidKey = await getVapidKey()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const subJson = sub.toJSON()
      await axios.post(`${API_BASE}/notifications/push/subscribe`, {
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      })
      setPushStatus('subscribed')
    } catch (err) {
      console.error(err)
      setPushStatus('error')
    }
  }

  const testPush = async () => {
    try {
      await axios.post(`${API_BASE}/notifications/push/test`)
      alert('Test notification sent!')
    } catch {
      alert('Could not send test — check VAPID keys in backend .env')
    }
  }

  const exportJournal = async () => {
    setExportLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/export/journal`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'journal_export.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
    } finally {
      setExportLoading(false)
    }
  }

  const fetchMemories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/memory`)
      setMemories(res.data)
    } catch (err) {
      console.error('Failed to fetch memories:', err)
    } finally {
      setMemoriesLoading(false)
    }
  }

  const deleteMemory = async (id) => {
    try {
      await axios.delete(`${API_BASE}/memory/${id}`)
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      console.error('Failed to delete memory:', err)
    }
  }

  const handleSave = async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    await authApi.updateProfile({ health_goals: healthGoals, timezone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Loading profile...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100">Your Profile</h2>
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-accent-400 transition-colors"
        >
          ← Back to Chat
        </Link>
      </div>

      {/* Profile details */}
      <div className="bg-slate-800/60 backdrop-blur-xl border border-accent-500/20 rounded-2xl p-6 space-y-5">
        {/* Avatar section */}
        <div className="flex items-center gap-5 pb-4 border-b border-slate-700/50">
          <div className="relative group">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile.username}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-accent-500/60"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center ring-2 ring-accent-500/40">
                <span className="text-white text-3xl font-bold select-none">
                  {(profile.username?.[0] || '?').toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <span className="text-white text-xs font-medium">Change</span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-slate-100 font-semibold text-lg">{profile.username}</p>
            <p className="text-slate-400 text-sm">{profile.email}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs text-accent-400 hover:text-accent-300 border border-accent-500/30 px-3 py-1 rounded-lg transition-colors"
              >
                Upload photo
              </button>
              {avatarSrc && (
                <button
                  onClick={removeAvatar}
                  className="text-xs text-slate-500 hover:text-red-400 border border-slate-700 px-3 py-1 rounded-lg transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Username</label>
            <p className="text-slate-100 font-medium mt-1">{profile.username}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Email</label>
            <p className="text-slate-100 font-medium mt-1">{profile.email}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Member since</label>
            <p className="text-slate-100 font-medium mt-1">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Last login</label>
            <p className="text-slate-100 font-medium mt-1">
              {profile.last_login ? new Date(profile.last_login).toLocaleString() : 'Now'}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-2">Health Goals</label>
          <textarea
            value={healthGoals}
            onChange={(e) => setHealthGoals(e.target.value)}
            placeholder="e.g., Reduce anxiety, improve sleep quality, manage anger better"
            rows={3}
            className="w-full px-4 py-3 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 focus:ring-2 focus:ring-accent-500/20 transition-all resize-none"
          />
        </div>

        {profile.preferred_strategies?.length > 0 && (
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Preferred Coping Strategies
              <span className="text-slate-500 text-xs ml-2">(auto-suggested from your conversations)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {profile.preferred_strategies.map((s) => (
                <span
                  key={s}
                  className="bg-accent-500/20 text-accent-300 border border-accent-500/30 px-3 py-1 rounded-full text-sm"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-accent-500/50 transition-all duration-200"
        >
          {saved ? '✅ Saved!' : 'Save Profile'}
        </button>
      </div>

      {/* Notification settings */}
      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Reminders & Notifications</h3>
          <p className="text-xs text-slate-500 mt-1">Daily check-in reminders via email and browser push.</p>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-slate-200 text-sm font-medium">Daily reminder</p>
              <p className="text-slate-500 text-xs">Get a daily nudge to check in</p>
            </div>
            <div
              onClick={() => setNotifPrefs(p => ({ ...p, reminder_enabled: !p.reminder_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${notifPrefs.reminder_enabled ? 'bg-accent-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs.reminder_enabled ? 'translate-x-5' : ''}`} />
            </div>
          </label>

          {notifPrefs.reminder_enabled && (
            <div>
              <label className="text-slate-400 text-xs block mb-1">
                Reminder time <span className="text-slate-500">(your local time)</span>
              </label>
              <input
                type="time" value={localReminderTime}
                onChange={e => setLocalReminderTime(e.target.value)}
                className="px-3 py-2 bg-slate-700/60 border border-slate-600/50 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-accent-500/80"
              />
              <p className="text-slate-500 text-xs mt-1">
                = {localToUtcHHMM(localReminderTime)} UTC (what the server uses)
              </p>
            </div>
          )}

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-slate-200 text-sm font-medium">Email notifications</p>
              <p className="text-slate-500 text-xs">Reminder + weekly summary emails</p>
            </div>
            <div
              onClick={() => setNotifPrefs(p => ({ ...p, email_notifications: !p.email_notifications }))}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${notifPrefs.email_notifications ? 'bg-accent-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs.email_notifications ? 'translate-x-5' : ''}`} />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={saveNotifPrefs}
            className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-5 py-2 rounded-xl text-sm font-semibold"
          >
            {notifSaved ? '✅ Saved!' : 'Save preferences'}
          </button>
          {'Notification' in window && (
            pushStatus === 'subscribed' ? (
              <button onClick={testPush} className="px-5 py-2 border border-green-500/40 text-green-300 rounded-xl text-sm hover:border-green-400 transition-colors">
                Send test notification
              </button>
            ) : (
              <button
                onClick={subscribePush}
                disabled={pushStatus === 'subscribing'}
                className="px-5 py-2 border border-accent-500/40 text-accent-300 rounded-xl text-sm hover:border-accent-400 transition-colors disabled:opacity-50"
              >
                {pushStatus === 'subscribing' ? 'Subscribing…' : pushStatus === 'error' ? '⚠ Try again' : '🔔 Enable browser push'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Export */}
      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-slate-100 font-semibold">Export Journal</h3>
          <p className="text-slate-500 text-xs mt-0.5">Download all your conversations and mood logs as JSON</p>
        </div>
        <button
          onClick={exportJournal}
          disabled={exportLoading}
          className="px-4 py-2 border border-slate-600 text-slate-300 rounded-xl text-sm hover:border-slate-400 transition-colors disabled:opacity-50"
        >
          {exportLoading ? 'Exporting…' : '⬇ Export'}
        </button>
      </div>

      {/* AI Memory section */}
      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">What the AI Remembers About You</h3>
          <p className="text-xs text-slate-500 mt-1">
            Facts learned from your conversations — used to personalise responses across sessions.
            You can delete any entry.
          </p>
        </div>

        {memoriesLoading ? (
          <p className="text-slate-400 text-sm">Loading memories...</p>
        ) : memories.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">No memories stored yet.</p>
            <p className="text-slate-500 text-xs mt-1">
              The AI will learn about you as you chat — things like your job, challenges, or goals.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {memories.map(m => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 bg-slate-700/40 rounded-xl px-4 py-3 border border-slate-600/30"
              >
                <p className="text-slate-200 text-sm leading-relaxed">{m.content}</p>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 text-lg leading-none"
                  title="Forget this"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
