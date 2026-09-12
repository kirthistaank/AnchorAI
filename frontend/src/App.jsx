import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import axios from 'axios'

import Widgets from './components/Widgets'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'
import Trends from './pages/Trends'
import Dashboard from './pages/Dashboard'
import Emotions from './pages/Emotions'
import Habits from './pages/Habits'
import Goals from './pages/Goals'
import Exercises from './pages/Exercises'
import Monitoring from './pages/Monitoring'
import ThoughtRecord from './pages/exercises/ThoughtRecord'
import Breathing from './pages/exercises/Breathing'
import Grounding from './pages/exercises/Grounding'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ClosingRitual from './components/ClosingRitual'
import { initTheme } from './components/ThemePicker'
import { getUserId, getToken } from './services/auth'
import './App.css'

initTheme()

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function Chat() {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [moodScale, setMoodScale] = useState(5)
  const [feedback, setFeedback] = useState({})
  const [recording, setRecording] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [voiceStatus, setVoiceStatus] = useState({ stt_available: false, tts_available: false })
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [moodAtStart, setMoodAtStart] = useState(null)
  const [showClosingRitual, setShowClosingRitual] = useState(false)
  const [sessionSummary, setSessionSummary] = useState(null)
  const messagesEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioRef = useRef(null)
  const userId = getUserId()

  useEffect(() => { initializeSession() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    fetch(`${API_BASE}/voice/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(setVoiceStatus).catch(() => {})
  }, [])

  const initializeSession = async () => {
    try {
      const savedId = sessionStorage.getItem('anchor_session_id')
      if (savedId) {
        // Resume existing session — reload messages from DB
        const resp = await fetch(`${API_BASE}/session/${savedId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (resp.ok) {
          const data = await resp.json()
          setSessionId(savedId)
          setSessionStartTime(new Date())
          setMoodAtStart(moodScale)
          setMessages(data.messages.length > 0 ? data.messages : [{
            role: 'assistant',
            content: "Welcome back! I'm here to listen and support you. What's on your mind today?",
          }])
          return
        }
        // Session expired or not found — fall through to create new
        sessionStorage.removeItem('anchor_session_id')
      }
      const response = await axios.post(`${API_BASE}/start-session`)
      sessionStorage.setItem('anchor_session_id', response.data.session_id)
      setSessionId(response.data.session_id)
      setSessionStartTime(new Date())
      setMoodAtStart(moodScale)
      setMessages([{
        role: 'assistant',
        content: "Welcome back! I'm here to listen and support you. What's on your mind today?",
      }])
    } catch (error) {
      console.error('Error starting session:', error)
    }
  }

  const startNewSession = async () => {
    sessionStorage.removeItem('anchor_session_id')
    setMessages([])
    setSessionId(null)
    setInput('')
    setShowClosingRitual(false)
    setSessionSummary(null)
    try {
      const response = await axios.post(`${API_BASE}/start-session`)
      sessionStorage.setItem('anchor_session_id', response.data.session_id)
      setSessionId(response.data.session_id)
      setSessionStartTime(new Date())
      setMoodAtStart(moodScale)
      setMessages([{
        role: 'assistant',
        content: "Hi! I'm here to listen and support you. What's on your mind today?",
      }])
    } catch (error) {
      console.error('Error starting new session:', error)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || !sessionId || loading) return

    const userMessage = input.trim()
    setInput('')
    const now = new Date().toISOString()
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: now }])
    setLoading(true)

    // Add placeholder assistant message that streams in
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date().toISOString() }])

    try {
      const response = await fetch(`${API_BASE}/message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ session_id: sessionId, user_id: userId, message: userMessage }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + data.content,
                }
                return updated
              })
            } else if (data.type === 'done') {
              setMessages(prev => {
                const updated = [...prev]
                const prev_msg = updated[updated.length - 1]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: data.full_response || prev_msg.content,
                  timestamp: prev_msg.timestamp,
                  intent: data.intent,
                  latency: data.latency_ms,
                  messageId: data.message_id || null,
                  suggestedExercise: data.suggested_exercise || null,
                }
                return updated
              })
            } else if (data.type === 'error') {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: data.content }
                return updated
              })
            }
          } catch {}
        }
      }

    } catch (error) {
      const errorMsg = error.message || 'Failed to send message.'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${errorMsg}` }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const logMood = async (e) => {
    e.preventDefault()
    if (!sessionId) return
    setLoading(true)
    try {
      await axios.post(`${API_BASE}/log-mood`, {
        session_id: sessionId,
        scale: moodScale,
        emotional_words: [],
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I've noted your mood level of ${moodScale}/10. Thank you for sharing. Your feelings are valid and temporary. 💙`,
      }])
    } catch (error) {
      console.error('Error logging mood:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendFeedback = async (messageId, rating) => {
    if (!messageId) return
    setFeedback(prev => ({ ...prev, [messageId]: rating }))
    try {
      await axios.post(`${API_BASE}/feedback/${messageId}`, { rating })
    } catch (err) {
      console.error('Feedback failed:', err)
    }
  }

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('file', blob, 'audio.webm')
        try {
          const resp = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: form,
          })
          if (resp.ok) {
            const { text } = await resp.json()
            if (text) setInput(prev => prev ? prev + ' ' + text : text)
          }
        } catch (e) {
          console.error('Transcribe error:', e)
        }
        setRecording(false)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e) {
      console.error('Mic access denied:', e)
    }
  }

  const playMessage = async (content, msgIdx) => {
    // Stop if same button clicked again
    if (playingId === msgIdx) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingId(null)
      return
    }
    // Stop any currently playing audio
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingId(msgIdx)
    try {
      const resp = await fetch(`${API_BASE}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: content }),
      })
      if (!resp.ok) throw new Error('TTS unavailable')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPlayingId(null); audioRef.current = null; URL.revokeObjectURL(url) }
      audio.onerror = () => { setPlayingId(null); audioRef.current = null }
      audio.play()
    } catch (e) {
      console.error('TTS error:', e)
      setPlayingId(null)
    }
  }

  const getMoodEmoji = (scale) => {
    if (scale <= 2) return '😔'
    if (scale <= 4) return '😟'
    if (scale <= 6) return '😐'
    if (scale <= 8) return '🙂'
    return '😄'
  }

  const endSession = async () => {
    if (!sessionId) return
    try {
      const response = await fetch(`${API_BASE}/session/${sessionId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          mood_end: moodScale,
          duration_minutes: sessionStartTime ? Math.round((new Date() - sessionStartTime) / 60000) : 0,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setSessionSummary({
          summary: data.summary || 'You had a meaningful session today.',
          affirmation: data.affirmation || 'You showed up for yourself.',
          moodStart: moodAtStart,
          moodEnd: moodScale,
        })
        setShowClosingRitual(true)
      }
    } catch (error) {
      console.error('Error ending session:', error)
      setShowClosingRitual(true)
      setSessionSummary({ summary: 'Session complete.', affirmation: 'Great work today.' })
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top area: chat + widgets */}
      <div className="flex-1 min-h-0 px-4 pt-4 flex gap-4 items-start overflow-hidden">
      {/* Chat column */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-slate-800/80 to-slate-700/80 backdrop-blur-xl rounded-3xl border border-accent-500/20 shadow-2xl overflow-hidden">
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-600/40 bg-slate-800/80 flex-shrink-0 gap-4">
          <span className="text-xs font-medium text-slate-300 tracking-wide">Current Session</span>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={endSession}
              disabled={loading || !sessionId}
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-all disabled:opacity-50 whitespace-nowrap shadow-md"
              title="End this session and start closing ritual"
            >
              ✓ End Session
            </button>
            <button
              onClick={startNewSession}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 whitespace-nowrap shadow-md"
              title="Start a new chat session"
            >
              + New Chat
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-slideIn`}>
              <div className={`max-w-xs lg:max-w-md px-5 py-3.5 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-accent-500 to-accent-600 text-white rounded-br-none shadow-lg'
                  : 'bg-slate-700/80 text-slate-100 rounded-bl-none border border-slate-600/50'
              }`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                {msg.latency && (
                  <p className="text-xs opacity-60 mt-2 text-slate-300">⚡ {msg.latency.toFixed(0)}ms</p>
                )}
              </div>
              {msg.timestamp && (
                <span className="text-xs text-slate-500 mt-0.5 px-1">
                  {formatTimestamp(msg.timestamp)}
                </span>
              )}
              {msg.role === 'assistant' && msg.content && (
                <div className="flex flex-wrap gap-2 mt-1 ml-1 items-center">
                  {voiceStatus.tts_available && (
                    <button
                      onClick={() => playMessage(msg.content, i)}
                      title={playingId === i ? 'Stop' : 'Listen'}
                      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-all ${
                        playingId === i
                          ? 'bg-accent-500/30 text-accent-300 animate-pulse border border-accent-500/40'
                          : 'bg-accent-500/20 border border-accent-500/40 text-accent-300 hover:bg-accent-500/30 hover:border-accent-500/60 shadow-sm shadow-accent-500/20'
                      }`}
                    >
                      {playingId === i
                        ? <><span>⏹</span><span>Stop</span></>
                        : <><span>▶</span><span>Listen</span></>}
                    </button>
                  )}
                </div>
              )}
              {msg.role === 'assistant' && (msg.messageId || msg.suggestedExercise) && (
                <div className="flex flex-wrap gap-2 mt-1 ml-1 items-center">
                  {msg.messageId && (
                    <>
                      <button
                        onClick={() => sendFeedback(msg.messageId, 1)}
                        title="Helpful"
                        className={`text-lg transition-all hover:scale-110 ${
                          feedback[msg.messageId] === 1 ? 'opacity-100' : 'opacity-30 hover:opacity-70'
                        }`}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => sendFeedback(msg.messageId, -1)}
                        title="Not helpful"
                        className={`text-lg transition-all hover:scale-110 ${
                          feedback[msg.messageId] === -1 ? 'opacity-100' : 'opacity-30 hover:opacity-70'
                        }`}
                      >
                        👎
                      </button>
                    </>
                  )}
                  {msg.suggestedExercise && (
                    <Link
                      to={`/exercises/${msg.suggestedExercise}`}
                      className="text-xs bg-accent-500/20 text-accent-300 border border-accent-500/30 px-3 py-1 rounded-full hover:bg-accent-500/30 transition-all"
                    >
                      Try: {msg.suggestedExercise === 'thought_record' ? '📝 Thought Record' : msg.suggestedExercise === 'breathing' ? '🌬️ Box Breathing' : '🌿 Grounding'} →
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start animate-slideIn">
              <div className="bg-slate-700/80 text-slate-300 px-5 py-4 rounded-2xl rounded-bl-none border border-slate-600/50">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-accent-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-accent-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-accent-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-slate-700/40 border-t border-slate-600/50 p-5">
          <form onSubmit={sendMessage} className="flex gap-2">
            <button
              type="button"
              onClick={voiceStatus.stt_available ? toggleRecording : undefined}
              title={!voiceStatus.stt_available ? 'Voice not available' : recording ? 'Stop recording' : 'Start recording'}
              className={`px-3 py-3 rounded-2xl transition-all flex-shrink-0 flex items-center gap-1.5 ${
                !voiceStatus.stt_available
                  ? 'bg-slate-700/40 border border-slate-600/40 text-slate-500 cursor-not-allowed'
                  : recording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                    : 'bg-accent-500/20 border border-accent-500/40 text-accent-300 hover:bg-accent-500/30 hover:border-accent-500/60 shadow-sm shadow-accent-500/20'
              }`}
            >
              {recording
                ? <><span className="w-2 h-2 bg-white rounded-full animate-pulse" /><span className="text-xs font-medium">Stop</span></>
                : <span className="text-base">🎤</span>}
            </button>
            <input
              type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
              placeholder={recording ? '🔴 Recording… click Stop when done' : 'Share your thoughts or ask for support…'}
              disabled={loading}
              className="flex-1 px-5 py-3 bg-slate-700/60 border border-slate-600/50 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-500/80 focus:ring-2 focus:ring-accent-500/20 transition-all disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit" disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-6 py-3 rounded-2xl hover:shadow-lg hover:shadow-accent-500/50 disabled:opacity-50 transition-all font-semibold min-w-16"
            >
              {loading
                ? <span className="flex gap-1 items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                : <span>↵</span>}
            </button>
          </form>
        </div>
      </div>

      {/* Mood bar — bottom of chat column only */}
      <div className="flex-shrink-0 border-t border-slate-700/50 py-3">
        <form onSubmit={logMood} className="flex gap-3 items-center">
          <label className="text-xs font-semibold text-slate-400 whitespace-nowrap">How are you feeling?</label>
          <div className="flex-1 relative h-0.5 rounded-full" style={{ background: 'linear-gradient(to right, #f87171, #facc15, #4ade80)' }}>
            <input
              type="range" min="1" max="10" value={moodScale}
              onChange={(e) => setMoodScale(parseInt(e.target.value))}
              className="absolute w-full opacity-0 cursor-pointer"
              style={{ top: '-10px', height: '20px', WebkitAppearance: 'none' }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md border border-slate-300 pointer-events-none transition-all"
              style={{ left: `calc(${((moodScale - 1) / 9) * 100}% - 6px)` }}
            />
          </div>
          <span className="text-xl">{getMoodEmoji(moodScale)}</span>
          <button
            type="submit" disabled={loading}
            className="bg-gradient-to-r from-accent-500 to-accent-600 text-white px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all whitespace-nowrap"
          >
            Log Mood
          </button>
        </form>
      </div>
      </div>{/* end chat column */}

      {/* Widgets sidebar — fixed width so it never shifts */}
      <div className="hidden xl:block flex-shrink-0 w-72">
        <Widgets />
      </div>
      </div>{/* end top area */}

      {/* Closing Ritual Modal */}
      {showClosingRitual && sessionSummary && (
        <ClosingRitual
          sessionData={sessionSummary}
          onComplete={() => {
            setShowClosingRitual(false)
            startNewSession()
          }}
        />
      )}
    </div>
  )
}

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<ProtectedLayout><Chat /></ProtectedLayout>} />
        <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
        <Route path="/emotions" element={<ProtectedLayout><Emotions /></ProtectedLayout>} />
        <Route path="/trends" element={<ProtectedLayout><Trends /></ProtectedLayout>} />
        <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/habits" element={<ProtectedLayout><Habits /></ProtectedLayout>} />
        <Route path="/goals" element={<ProtectedLayout><Goals /></ProtectedLayout>} />
        <Route path="/exercises" element={<ProtectedLayout><Exercises /></ProtectedLayout>} />
        <Route path="/exercises/thought_record" element={<ProtectedLayout><ThoughtRecord /></ProtectedLayout>} />
        <Route path="/exercises/breathing" element={<ProtectedLayout><Breathing /></ProtectedLayout>} />
        <Route path="/exercises/grounding" element={<ProtectedLayout><Grounding /></ProtectedLayout>} />
        <Route path="/monitoring" element={<ProtectedLayout><Monitoring /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
