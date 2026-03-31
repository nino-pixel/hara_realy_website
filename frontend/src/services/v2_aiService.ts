import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { TOOLS, executeTool } from './aiTools'

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: string[]
  isError?: boolean
  reasoning?: string       // visible chain-of-thought (optional UI display)
  confidence?: 'high' | 'medium' | 'low'
}

export interface AiResponse {
  content: string
  actions?: string[]
  reasoning?: string
  confidence?: 'high' | 'medium' | 'low'
}

// ─────────────────────────────────────────────────────────────────────────────
//  PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_UI_MESSAGES = 'chara_ai_ui_messages'
const STORAGE_KEY_CHAT_HISTORY = 'chara_ai_chat_history'

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY_UI_MESSAGES, JSON.stringify(uiMessages))
    localStorage.setItem(STORAGE_KEY_CHAT_HISTORY, JSON.stringify(chatHistory))
  } catch (err) {
    console.warn('[AiService] Failed to save conversation to localStorage:', err)
  }
}

function loadFromStorage(): void {
  try {
    const storedUi = localStorage.getItem(STORAGE_KEY_UI_MESSAGES)
    const storedChat = localStorage.getItem(STORAGE_KEY_CHAT_HISTORY)
    
    if (storedUi) {
      const parsed = JSON.parse(storedUi)
      uiMessages = parsed.map((m: Message) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }))
    }
    if (storedChat) {
      chatHistory = JSON.parse(storedChat)
    }
  } catch (err) {
    console.warn('[AiService] Failed to load conversation from localStorage:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SESSION STATE  (resets on full page refresh)
// ─────────────────────────────────────────────────────────────────────────────

interface SessionStats {
  messagesThisSession: number
  toolCallsThisSession: number
  errorsThisSession: number
  lastAction: string | null
  sessionStarted: Date
}

const sessionStats: SessionStats = {
  messagesThisSession: 0,
  toolCallsThisSession: 0,
  errorsThisSession: 0,
  lastAction: null,
  sessionStarted: new Date(),
}

// Ring-buffer of the last 5 tool actions for contextual awareness
const recentActions: string[] = []
function recordAction(name: string) {
  recentActions.push(name)
  if (recentActions.length > 5) recentActions.shift()
  sessionStats.toolCallsThisSession++
  sessionStats.lastAction = name
}

// ─────────────────────────────────────────────────────────────────────────────
//  DYNAMIC SYSTEM PROMPT BUILDER
//  Re-evaluated on every message so the AI always has the correct date/time
//  and up-to-date session context.
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemInstruction(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const sessionDurationMin = Math.round(
    (now.getTime() - sessionStats.sessionStarted.getTime()) / 60000
  )

  return `
You are Chara AI — an intelligent, analytical real estate system assistant for Chara Realty in Bulacan, Philippines.

You have full access to the company's live CRM data through function tools, and can perform actions across ALL modules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Today: ${dateStr}
- Current Time: ${timeStr} (Philippine Standard Time)
- Session Duration: ${sessionDurationMin} minutes
- Messages This Session: ${sessionStats.messagesThisSession}
- Tool Calls This Session: ${sessionStats.toolCallsThisSession}
- Recent Actions Taken: ${recentActions.length > 0 ? recentActions.join(', ') : 'None yet'}
- Location: Admin Panel — Chara Realty Management System

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW YOU THINK (REASONING PROTOCOL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before responding to any non-trivial request, reason through it step by step in your mind:

1. UNDERSTAND — What is the user actually asking for? Is there ambiguity?
2. PLAN — What tools or data do I need? What is the correct sequence of steps?
3. VALIDATE — Do I have all required fields? Are there duplicates to check?
4. EXECUTE — Perform the action in the correct order.
5. VERIFY — Did the result make sense? Is there anything anomalous?
6. RESPOND — Summarize results clearly in formal business language.

For COMPLEX requests (multi-step, analytical, or involving multiple modules):
- Break the problem into sub-tasks.
- Fetch prerequisite data before acting (e.g., check for duplicate client before creating one).
- If you are uncertain about the user's intent, ASK before acting.
- Prefer safe read-only operations first, then confirm before destructive changes.

For ANALYTICAL requests (trends, comparisons, projections):
- Pull all relevant data first.
- Calculate explicitly: show the numbers, the formula used, and the conclusion.
- Flag data anomalies (e.g., a closed deal with no final sale price).
- Compare to prior periods when data is available.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAPABILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENTS
- List and search clients (by name, email, status)
- Add new clients (name, email, phone, source, notes)
- Update client details (name, phone, email, status, notes, admin notes)
- Detect and prevent duplicate entries

PROPERTIES
- List properties (filter by status, type, or keyword)
- Add new listings (title, type, location, price, beds, baths, area, status)
- Update property details (status, price, location, notes)
- Status pipeline: draft → available → reserved → under_negotiation → processing_docs → sold

INQUIRIES / LEADS
- List leads (filter by status or keyword)
- Create new inquiries (name, email, phone, property, message, budget, timeline)
- Link inquiry to existing property automatically
- Update lead status and priority: new → contacted → qualified → converted → lost

DEALS
- List deals (filter by status)
- Create deals (client must already exist; link to property)
- Update deal status, notes, closing date, final sale price
- Pipeline: Inquiry → Negotiation → Reserved → Processing Documents → Closed | Cancelled

ANALYTICS
- System-wide statistics or per-module breakdowns
- Month-over-month comparisons, conversion rates, trend detection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS RULES & INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIRED FIELDS (never skip — request missing info before proceeding):
  - CLIENTS: Full Name, Email, Phone, Province, Municipality, Barangay
  - PROPERTIES: Title, Type, Location, Price
  - DEALS: Client Name (must exist), Property Title
  - INQUIRIES: Name, Email, Phone, Source

CALCULATIONS & METRICS:
  - Deal Conversion Rate = (Closed Deals ÷ Total Registered Clients) × 100
  - Monthly Sales Revenue = Sum of final sale prices for deals closed this calendar month
  - Active Listings = Properties with status 'available' OR 'under_negotiation'
  - Lead Response Rate = (Contacted + Qualified + Converted) ÷ Total Leads × 100
  - Average Deal Value = Total Closed Revenue ÷ Number of Closed Deals

INTELLIGENT SUGGESTIONS:
  - If a lead has been in 'new' status for more than 7 days, flag it as at-risk.
  - If a property has been 'available' for a long time with no inquiries, suggest a price review.
  - If monthly sales drop more than 20% from the prior month, proactively flag this.
  - If a client has multiple open inquiries, suggest consolidating into a single deal.

DUPLICATE DETECTION:
  - Before creating a client, search by email AND phone. Alert if a match is found.
  - Before creating a property, search by title. Alert if a similar title exists.

DESTRUCTIVE ACTION PROTOCOL:
  - For status changes to 'Cancelled', 'Lost', or 'Sold', ALWAYS confirm with the user first.
  - State exactly what will change before executing.

DATA CONSISTENCY:
  - A Deal marked 'Closed' should have a finalSalePrice. Flag if missing.
  - An Inquiry linked to a non-existent property should be flagged.
  - A Client with no associated inquiries or deals may be flagged as inactive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENCE SIGNALING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
End every substantive response with one of the following confidence signals, on its own line:
  [Confidence: High]   — Data is clear, action is complete, result is verified.
  [Confidence: Medium] — Action was taken but result could not be fully verified, or data was partial.
  [Confidence: Low]    — Uncertain about interpretation, or required data was missing/ambiguous.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESTRICTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- NO TECHNICAL LANGUAGE: Never say "calling a function," "executing a tool," "API," "parameters," "backend," or internal field names.
- NO EMOJIS.
- NO MEDIA UPLOADS: Inform the user to add images or documents manually via the details page.
- NO DELETIONS unless the user explicitly types "delete."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY & FORMATTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Tone: Business-formal, precise, and proactive.
- Use commas naturally to support text-to-speech pacing.
- Use **bold** for key values (names, amounts, statuses).
- Use tables for data comparisons or lists of 3 or more items.
- Always state the result of an action explicitly and completely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SYSTEM DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Website Developer: **Antonino Balinado Jr.** (Independent Developer)
- Developer Contact: antoninobalinado756@gmail.com
- Owner: **Celine Hara** (Chara Realty)
- Data Sources: Dashboard, Data Tables, Activity Logs
`
}

// ─────────────────────────────────────────────────────────────────────────────
//  AUDIO TRANSCRIPTION  (unchanged, just cleaned up)
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const mimeType = audioBlob.type || 'audio/webm'
  const buffer = await audioBlob.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

  const body = {
    contents: [
      {
        parts: [
          {
            text: 'Transcribe this audio recording exactly as spoken. Return only the raw transcription text — no labels, no formatting, no extra commentary.',
          },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )

  if (!res.ok) throw new Error(`Transcription failed: ${await res.text()}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

// ─────────────────────────────────────────────────────────────────────────────
//  UI MESSAGE STORE
// ─────────────────────────────────────────────────────────────────────────────

let uiMessages: Message[] = [
  {
    id: '0',
    role: 'assistant',
    content: `Welcome to the Chara Realty Administration System. I am your integrated AI assistant.

I have been configured with full reasoning capabilities to assist you across all system modules, including Clients, Properties, Inquiries, and Deals. I can search records, create entries, update statuses, and analyze performance data.

How may I assist you with your administrative tasks today?`,
    timestamp: new Date(),
  },
]

// Gemini multi-turn history
let chatHistory: Array<{ role: string; parts: Part[] }> = []

// Initialize from storage immediately
loadFromStorage()

export function getMessages(): Message[] {
  return [...uiMessages]
}

export function addUiMessage(msg: Message): void {
  uiMessages.push(msg)
  saveToStorage()
}

export function resetAiChat(): Message {
  chatHistory = []
  recentActions.length = 0
  sessionStats.messagesThisSession = 0
  sessionStats.toolCallsThisSession = 0
  sessionStats.errorsThisSession = 0
  sessionStats.lastAction = null
  sessionStats.sessionStarted = new Date()

  const welcome: Message = {
    id: Date.now().toString(),
    role: 'assistant',
    content: 'The conversation has been cleared and the session has been reset. How may I assist you next?',
    timestamp: new Date(),
  }
  uiMessages = [welcome]
  saveToStorage()
  return welcome
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIDENCE PARSER
//  Extracts the [Confidence: X] tag from the model's response.
// ─────────────────────────────────────────────────────────────────────────────

function extractConfidence(text: string): {
  cleaned: string
  confidence: 'high' | 'medium' | 'low' | undefined
} {
  const match = text.match(/\[Confidence:\s*(High|Medium|Low)\]/i)
  if (!match) return { cleaned: text, confidence: undefined }

  const confidence = match[1].toLowerCase() as 'high' | 'medium' | 'low'
  const cleaned = text.replace(match[0], '').trim()
  return { cleaned, confidence }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN MESSAGE PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

console.log('[AiService] Initialized — model: gemini-2.5-flash (enhanced reasoning mode)')

export async function processAiMessage(userMessage: string): Promise<AiResponse> {
  sessionStats.messagesThisSession++

  const genAI = new GoogleGenerativeAI(API_KEY)

  // Rebuild the system instruction on every call so date/time/session context is always fresh
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: TOOLS,
    systemInstruction: buildSystemInstruction(),
    // Enable extended thinking for deeper reasoning on complex tasks
    generationConfig: {
      temperature: 0.3,        // Lower temperature = more precise, less hallucination
      topP: 0.85,
      topK: 40,
      maxOutputTokens: 8192,   // Allow longer, more thorough responses
    } as Record<string, unknown>,
  })

  // Push user message into history
  chatHistory.push({ role: 'user', parts: [{ text: userMessage }] })

  const chat = model.startChat({
    history: chatHistory.slice(0, -1), // everything except the current user message
  })

  let response = await chat.sendMessage(userMessage)
  const actions: string[] = []

  // ── AGENTIC LOOP ──────────────────────────────────────────────────────────
  // Process tool calls up to 10 rounds. On each round:
  //   1. Collect all function calls from the model's response.
  //   2. Execute each tool and gather results.
  //   3. Feed all results back to the model in a single batch.
  //   4. Repeat if the model requests more tool calls.
  // ─────────────────────────────────────────────────────────────────────────

  let iterations = 0
  const MAX_ITERATIONS = 10

  while (response.response.functionCalls()?.length && iterations < MAX_ITERATIONS) {
    iterations++
    const calls = response.response.functionCalls()!
    const functionResults: Part[] = []

    for (const call of calls) {
      const actionName = call.name.toUpperCase()
      actions.push(actionName)
      recordAction(actionName)

      try {
        // Execute the tool — executeTool may return a promise or a value
        const rawResult = executeTool(call.name, call.args as Record<string, unknown>)
        const result = rawResult instanceof Promise ? await rawResult : rawResult

        functionResults.push({
          functionResponse: {
            name: call.name,
            response: {
              result,
              // Include metadata so the model can reason about the quality of data
              _meta: {
                executedAt: new Date().toISOString(),
                iterationNumber: iterations,
                success: true,
              },
            },
          },
        })
      } catch (toolError: unknown) {
        sessionStats.errorsThisSession++

        const errorMessage =
          toolError instanceof Error ? toolError.message : 'Unknown error during tool execution'

        console.error(`[AiService] Tool "${call.name}" failed (iteration ${iterations}):`, toolError)

        // Return a structured error to the model so it can reason about the failure
        // rather than silently stalling
        functionResults.push({
          functionResponse: {
            name: call.name,
            response: {
              error: errorMessage,
              _meta: {
                executedAt: new Date().toISOString(),
                iterationNumber: iterations,
                success: false,
              },
            },
          },
        })
      }
    }

    // Feed all results back to the model in one batch
    response = await chat.sendMessage(functionResults)
  }

  // ── SAFETY: if loop hit the cap, inject a note for the model to wrap up ──
  if (iterations >= MAX_ITERATIONS) {
    console.warn('[AiService] Max tool-call iterations reached. Requesting graceful wrap-up.')
    response = await chat.sendMessage([
      {
        text: '[SYSTEM NOTE: You have reached the maximum number of automated steps for this request. Please summarize what you have accomplished so far and inform the user of any remaining steps they may need to take manually.]',
      },
    ])
  }

  const rawText = response.response.text()

  // Parse confidence tag from response
  const { cleaned: finalText, confidence } = extractConfidence(rawText)

  // Update Gemini history with the final model response (use cleaned text)
  chatHistory.push({ role: 'model', parts: [{ text: finalText }] })

  // Cap history length to avoid token overflow (keep last 40 turns = 20 exchanges)
  if (chatHistory.length > 40) {
    chatHistory = chatHistory.slice(chatHistory.length - 40)
  }

  saveToStorage()

  return {
    content: finalText,
    actions: actions.length > 0 ? [...new Set(actions)] : undefined,
    confidence,
  }
}
