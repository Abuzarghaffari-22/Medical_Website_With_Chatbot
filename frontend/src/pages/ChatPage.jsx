import { useState, useEffect, useRef, useCallback } from 'react'
import { chatAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { UrgencyAlert, EmptyState, Spinner } from '../components/common'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const QUICK_STARTERS = [
  'What are your clinic hours?',
  'Where is the clinic located?',
  'I have a headache and mild fever',
  'Book an appointment',
  'What services do you offer?',
]

// Escape HTML special chars then apply light markdown: **bold**, *italic*, newlines
const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const formatMessage = (text) => {
  if (!text) return ''
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

export default function ChatPage() {
  const { user } = useAuth()
  const [sessions, setSessions]         = useState([])
  const [sessionId, setSessionId]       = useState(null)
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [sessionsLoading, setSessLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hello ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm **MediBot**, your AI health assistant.\n\nHow can I help you today?`,
        createdAt: new Date().toISOString(),
        isWelcome: true,
      }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSessions = async () => {
    setSessLoading(true)
    try {
      const res = await chatAPI.getSessions({ limit: 20 })
      setSessions(res.data.sessions || [])
    } catch {}
    finally { setSessLoading(false) }
  }

  const startNewSession = async () => {
    try {
      const res = await chatAPI.newSession()
      setSessionId(res.data.sessionId)
      setSidebarOpen(false)
      setMessages([{
        role: 'assistant',
        content: `Hello ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm MediBot, your AI health assistant for **${import.meta.env.VITE_CLINIC_NAME || 'MediCare Clinic'}**.\n\nI can help with:\n🕐 **Clinic hours & location**\n📅 **Appointment booking**\n🩺 **Symptom assessment**\n❓ **Health FAQs**\n\nHow can I assist you today?`,
        createdAt: new Date().toISOString(),
        isWelcome: true,
      }])
    } catch {
      toast.error('Could not start new chat session')
    }
  }

  const loadSession = async (sid) => {
    try {
      const res = await chatAPI.getSession(sid)
      setSessionId(sid)
      setMessages(res.data.session?.messages || [])
      setSidebarOpen(false)
    } catch {
      toast.error('Could not load session')
    }
  }

  const deleteSession = async (sid, e) => {
    e.stopPropagation()
    try {
      await chatAPI.deleteSession(sid)
      setSessions(s => s.filter(x => x.sessionId !== sid))
      if (sessionId === sid) { setSessionId(null); setMessages([]) }
      toast.success('Session deleted')
    } catch {
      toast.error('Could not delete session')
    }
  }

  const sendMessage = useCallback(async (text = null) => {
    const msgText = (text || input).trim()
    if (!msgText || loading) return

    // Auto-start session if none active
    let activeSession = sessionId
    if (!activeSession) {
      try {
        const res = await chatAPI.newSession()
        activeSession = res.data.sessionId
        setSessionId(activeSession)
      } catch {
        toast.error('Could not start session')
        return
      }
    }

    setInput('')
    setLoading(true)

    // Optimistic user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: msgText,
      createdAt: new Date().toISOString(),
    }])

    try {
      const res = await chatAPI.sendMessage(msgText, activeSession)
      const d   = res.data
      setMessages(prev => [...prev, {
        role:            'assistant',
        content:         d.response,
        intent:          d.intent,
        symptomAnalysis: d.symptomAnalysis,
        disclaimer:      d.disclaimer,
        quickReplies:    d.quickReplies,
        createdAt:       new Date().toISOString(),
      }])
      loadSessions()
    } catch (err) {
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   err.response?.data?.message || '❌ I encountered an error. Please try again or contact the clinic.',
        createdAt: new Date().toISOString(),
        isError:   true,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, sessionId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const hasUserMessages = messages.some(m => m.role === 'user')

  return (
    <div className="h-full flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 bg-white flex flex-col h-full shadow-2xl">
            <SessionSidebar
              sessions={sessions} loading={sessionsLoading} activeId={sessionId}
              onNew={startNewSession} onLoad={loadSession} onDelete={deleteSession}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 flex-shrink-0 bg-white border-r border-slate-200 flex-col">
        <SessionSidebar
          sessions={sessions} loading={sessionsLoading} activeId={sessionId}
          onNew={startNewSession} onLoad={loadSession} onDelete={deleteSession}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Top bar */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-slate-200 bg-white flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white text-sm">🤖</div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">MediBot AI</p>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Online
            </p>
          </div>
          <button onClick={startNewSession} className="btn-sm btn-secondary ml-auto text-xs">+ New Chat</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-teal-100 flex items-center justify-center text-sm flex-shrink-0 mt-1">🤖</div>
              )}

              <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="chat-bubble-user">{msg.content}</div>
                ) : (
                  <div className={`chat-bubble-ai ${msg.isError ? 'border-red-200 bg-red-50' : ''}`}>
                    <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  </div>
                )}

                {/* Urgency alert */}
                {msg.symptomAnalysis?.urgencyLevel && msg.symptomAnalysis.urgencyLevel !== 'unknown' && (
                  <div className="max-w-[82%]">
                    <UrgencyAlert
                      level={msg.symptomAnalysis.urgencyLevel}
                      message={`Triage Score: ${msg.symptomAnalysis.triageScore}/10 · ${msg.symptomAnalysis.urgencyLevel.replace(/_/g, ' ')}`}
                    />
                  </div>
                )}

                {/* Disclaimer */}
                {msg.disclaimer && (
                  <p className="text-[11px] text-slate-400 max-w-[82%] leading-relaxed">
                    {msg.disclaimer.replace(/⚠️|🚨/g, '').trim()}
                  </p>
                )}

                {/* Quick reply chips */}
                {msg.quickReplies?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.quickReplies.map((qr, qi) => (
                      <button key={qi} onClick={() => sendMessage(qr)}
                        className="badge badge-blue cursor-pointer hover:bg-primary-100 transition-colors text-xs py-1 px-2.5">
                        {qr}
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-slate-300">
                  {format(new Date(msg.createdAt || Date.now()), 'h:mm a')}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-teal-400 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-1">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-teal-100 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
              <div className="chat-bubble-ai flex items-center gap-1 py-4 px-5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick starter suggestions */}
        {!hasUserMessages && (
          <div className="px-4 pb-3">
            <p className="text-xs text-slate-400 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="badge badge-slate hover:bg-slate-200 cursor-pointer transition-colors text-xs py-1.5 px-3">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message… (Enter to send)"
              className="input flex-1 resize-none leading-relaxed max-h-32 overflow-y-auto"
              disabled={loading}
              style={{ minHeight: '44px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="btn-md btn-primary flex-shrink-0 disabled:opacity-40"
            >
              {loading ? <Spinner size="sm" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            MediBot is not a substitute for professional medical advice. For emergencies, call 911.
          </p>
        </div>
      </div>
    </div>
  )
}

function SessionSidebar({ sessions, loading, activeId, onNew, onLoad, onDelete, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 text-sm">Chat History</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-3">
        <button onClick={onNew} className="btn-sm btn-primary w-full">+ New Chat</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-6"><Spinner size="sm" /></div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No chat history yet</p>
        ) : (
          sessions.map(s => (
            <div key={s.sessionId}
              onClick={() => onLoad(s.sessionId)}
              className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer group transition-all duration-150
                ${activeId === s.sessionId ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{s.title || 'Conversation'}</p>
                <p className="text-[10px] text-slate-400">{s.messageCount} messages</p>
              </div>
              <button onClick={(e) => onDelete(s.sessionId, e)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}