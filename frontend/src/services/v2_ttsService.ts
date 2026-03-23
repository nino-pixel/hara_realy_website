
const API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY || ''

// Current active audio so we can stop it if a new message comes in
let currentAudio: HTMLAudioElement | null = null

export async function speakTextNeural(text: string) {
  try {
    // 1. Stop any current audio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }

    // 2. Filter markdown for cleaner speech (already done in UI, but good to have here too)
    const cleanText = text
      .replace(/\*\*/g, '')
      .replace(/#/g, '')
      .replace(/\|/g, ', ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`[^`]+`/g, '')
      .trim()

    if (!cleanText) return

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: cleanText },
          voice: { 
            languageCode: 'en-US', 
            name: 'en-US-Studio-O', 
            ssmlGender: 'FEMALE' 
          },
          audioConfig: { 
            audioEncoding: 'MP3',
            pitch: -1.0,
            speakingRate: 0.95,
            effectsProfileId: ['small-bluetooth-speaker-class-device']
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Cloud TTS Error:', errorText)
      
      if (errorText.includes('API_KEY_SERVICE_BLOCKED') || errorText.includes('SERVICE_DISABLED')) {
        console.warn('⚠️ Cloud Text-to-Speech API is not enabled in your Google Cloud Console.')
      }
      return false
    }

    const data = await response.json()
    const audioContent = data.audioContent

    // 4. Play the audio
    const audioBlob = new Blob(
      [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
      { type: 'audio/mp3' }
    )
    const audioUrl = URL.createObjectURL(audioBlob)
    
    currentAudio = new Audio(audioUrl)
    currentAudio.play()
    
    currentAudio.onended = () => {
      URL.revokeObjectURL(audioUrl)
      currentAudio = null
    }

    return true // Success
  } catch (error) {
    console.error('TTS failed:', error)
    return false // Failure (trigger fallback)
  }
}

export function stopSpeech() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
}
