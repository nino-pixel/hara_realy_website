import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  HiOutlineSparkles,
  HiOutlinePaperAirplane,
  HiOutlineUser,
  HiOutlineRefresh,
  HiOutlineMicrophone,
  HiOutlineVolumeUp,
  HiOutlineVolumeOff,
} from 'react-icons/hi'
import { 
  processAiMessage, 
  resetAiChat, 
  transcribeAudio, 
  getMessages, 
  addUiMessage, 
  speakTextNeural,
  stopSpeech,
  type Message 
} from '../../services'
import './AiAssistant.css'

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  // Clients (blue)
  ADDCLIENT:      { label: '➕ Client Added',        color: '#3b82f6' },
  UPDATECLIENT:   { label: '✏️ Client Updated',       color: '#3b82f6' },
  LISTCLIENTS:    { label: '👥 Clients Listed',       color: '#3b82f6' },
  // Properties (green)
  ADDPROPERTY:    { label: '🏠 Property Added',       color: '#10b981' },
  UPDATEPROPERTY: { label: '🏠 Property Updated',     color: '#10b981' },
  LISTPROPERTIES: { label: '🏘️ Properties Listed',    color: '#10b981' },
  // Inquiries (amber)
  ADDINQUIRY:     { label: '📋 Inquiry Created',      color: '#f59e0b' },
  UPDATELEAD:     { label: '📋 Lead Updated',         color: '#f59e0b' },
  LISTLEADS:      { label: '📋 Leads Listed',         color: '#f59e0b' },
  // Deals (purple)
  ADDDEAL:        { label: '💼 Deal Created',         color: '#8b5cf6' },
  UPDATEDEAL:     { label: '💼 Deal Updated',         color: '#8b5cf6' },
  LISTDEALS:      { label: '💼 Deals Listed',         color: '#8b5cf6' },
  // Analytics
  GETSYSTEMSTATS: { label: '📊 Stats Retrieved',      color: '#6b7280' },
}

function getActionLabel(action: string): { label: string; color: string } {
  const key = action.replace(/_/g, '').toUpperCase()
  return ACTION_LABELS[key] ?? { label: action, color: '#6b7280' }
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>(getMessages())
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isProcessing = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop()
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []

      // Pick the best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks so the mic indicator disappears
        stream.getTracks().forEach(t => t.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setIsTranscribing(true)
        try {
          const text = await transcribeAudio(audioBlob)
          if (text) {
            setInput(prev => {
              const sep = prev && !prev.endsWith(' ') ? ' ' : ''
              return prev + sep + text
            })
          }
        } catch (err) {
          console.error('Transcription error:', err)
          alert('Transcription failed. Please try again.')
        } finally {
          setIsTranscribing(false)
          setTimeout(() => inputRef.current?.focus(), 100)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsListening(true)
    } catch (err) {
      console.error('Microphone access error:', err)
      alert('Could not access microphone. Please allow microphone permissions and try again.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsListening(false)
  }

  const toggleListen = () => {
    if (isListening) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const speakText = async (text: string) => {
    // Attempt high-quality neural voice first
    console.log('[AiAssistant] Attempting Neural Studio Voice...')
    const success = await speakTextNeural(text)
    
    if (success) {
      console.log('[AiAssistant] Neural Studio Voice active ✅')
      return
    }

    console.warn('[AiAssistant] Neural Voice failed or API not configured. Falling back to Browser TTS ⚠️')
    if (!('speechSynthesis' in window)) return

    // Stop any current speech
    window.speechSynthesis.cancel()

    // Filter markdown for cleaner speech
    const cleanText = text
      .replace(/\*\*/g, '') // remove bold
      .replace(/#/g, '')    // remove headers
      .replace(/\|/g, ', ') // change table bars to commas for natural pauses
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links, keep text
      .replace(/`[^`]+`/g, '') // remove code blocks
      .trim()

    const utterance = new SpeechSynthesisUtterance(cleanText)

    // Voice Personality Settings
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(v => 
      v.name.includes('Google US English') || 
      v.name.includes('Natural') ||
      v.name.includes('Samantha') ||
      v.name.includes('Microsoft Zira')
    ) || voices[0]
    
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.rate = 0.95 // Slightly slower for clarity & professionalism
    utterance.pitch = 1.05 // Slightly higher for a friendly/clear tone
    utterance.volume = 1.0

    window.speechSynthesis.speak(utterance)
  }

  const toggleVoice = () => {
    const newState = !isVoiceEnabled
    setIsVoiceEnabled(newState)
    if (!newState) {
      stopSpeech() // Stop neural audio
      window.speechSynthesis.cancel() // Stop browser audio
    }
  }

  const handleReset = () => {
    const welcome = resetAiChat()
    setMessages([welcome])
    stopSpeech()
    window.speechSynthesis.cancel()
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping || isProcessing.current) return

    isProcessing.current = true
    if (isListening) stopRecording()

    const currentInput = input
    setInput('')

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    addUiMessage(userMessage)
    setIsTyping(true)

    try {
      const response = await processAiMessage(currentInput)
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        actions: response.actions,
      }
      setMessages(prev => [...prev, assistantMsg])
      addUiMessage(assistantMsg)
      if (isVoiceEnabled) speakText(assistantMsg.content)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**Error:** ${errMsg}`,
        timestamp: new Date(),
        isError: true,
      }
      setMessages(prev => [...prev, errorMsg])
      addUiMessage(errorMsg)
    } finally {
      isProcessing.current = false
      setIsTyping(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const micLabel = isTranscribing
    ? 'Transcribing…'
    : isListening
    ? 'Stop recording'
    : 'Dictate message'

  return (
    <div className="ai-assistant-container">
      <header className="ai-assistant-header">
        <div className="ai-header-info">
          <div className="ai-avatar-glow">
            <HiOutlineSparkles className="ai-sparkle-icon" />
          </div>
          <div>
            <h1>Chara AI</h1>
            <p className="ai-status-dot ai-status-dot--active">
              ● Online — Ready to help
            </p>
          </div>
        </div>
        <div className="ai-header-actions">
          <button 
            className={`ai-header-btn ${isVoiceEnabled ? 'ai-header-btn--active' : ''}`} 
            onClick={toggleVoice} 
            title={isVoiceEnabled ? 'Disable voice' : 'Enable voice'}
          >
            {isVoiceEnabled ? <HiOutlineVolumeUp /> : <HiOutlineVolumeOff />}
          </button>
          <button className="ai-header-btn" onClick={handleReset} title="Clear conversation">
            <HiOutlineRefresh />
          </button>
        </div>
      </header>


      <div className="ai-chat-window">
        <div className="ai-messages-list">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-message-wrapper ai-message--${msg.role}`}>
              <div className="ai-message-avatar">
                {msg.role === 'assistant' ? <HiOutlineSparkles /> : <HiOutlineUser />}
              </div>
              <div className={`ai-message-bubble ${msg.isError ? 'ai-message-bubble--error' : ''}`}>
                <div className="ai-message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="ai-message-actions">
                    {msg.actions.map((action, i) => {
                      const { label, color } = getActionLabel(action)
                      return (
                        <span key={i} className="ai-action-tag" style={{ borderColor: color + '44', color }}>
                          {label}
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="ai-message-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-message-wrapper ai-message--assistant">
              <div className="ai-message-avatar"><HiOutlineSparkles /></div>
              <div className="ai-message-bubble ai-typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="ai-input-area">
          <div className={`ai-input-container ${isListening ? 'ai-input-container--listening' : ''}`}>
            <button
              className={`ai-dictate-button ${isListening ? 'ai-dictate-button--active' : ''} ${isTranscribing ? 'ai-dictate-button--transcribing' : ''}`}
              onClick={toggleListen}
              disabled={isTranscribing}
              title={micLabel}
            >
              <HiOutlineMicrophone />
            </button>
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              placeholder={
                isTranscribing
                  ? 'Transcribing your voice…'
                  : isListening
                  ? 'Recording… click mic to stop'
                  : 'Ask anything or give a command… (Enter to send)'
              }
              value={input}
              disabled={isTyping || isTranscribing}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              className="ai-send-button"
              onClick={handleSend}
              disabled={!input.trim() || isTyping || isTranscribing}
            >
              <HiOutlinePaperAirplane />
            </button>
          </div>
          <p className="ai-input-hint">
            Enter to send · Shift+Enter for newline · Click mic to record voice
          </p>
        </div>
      </div>
    </div>
  )
}
