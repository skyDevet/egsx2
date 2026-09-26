cat > install_agig.sh << 'SCRIPT_EOF'
#!/bin/bash

# AGIG - Advanced Government Intelligence Gateway
# Complete Termux Installation Script (Fixed Dependencies)

set -e

echo "🚀 Starting AGIG Installation on Termux..."
echo "=============================================="

# Update and install dependencies
echo "📦 Installing system dependencies..."
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts python git curl wget

# Create project directory
echo "📁 Creating project directory..."
mkdir -p ~/AGIG/{src,public,src/components,src/services,src/styles,src/utils}
cd ~/AGIG

# Initialize npm project with fixed dependencies
echo "📦 Initializing npm project..."
cat > package.json << 'EOF'
{
  "name": "agig",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "idb": "^8.0.3",
    "preact": "^10.19.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.8.0",
    "vite": "^5.4.0"
  }
}
EOF

# Create vite.config.js
echo "⚙️ Creating Vite configuration..."
cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  build: { outDir: 'dist', sourcemap: true },
  server: { host: '0.0.0.0', port: 5173 }
})
EOF
# Create index.html
echo "📄 Creating HTML entry point..."
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
  <meta name="theme-color" content="#1a73e8" />
  <title>AGIG - Advanced Government Intelligence Gateway</title>
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
EOF

# Create main entry point
echo "🎯 Creating main application entry..."
cat > src/main.jsx << 'EOF'
import { render } from 'preact'
import { App } from './App.jsx'
import './styles/app.css'

render(<App />, document.getElementById('app'))
EOF

# Create App.jsx (Main Component)
echo "🖥️ Creating main App component..."
cat > src/App.jsx << 'EOF'
import { useState, useEffect } from 'preact/hooks'
import { ChatUI } from './components/ChatUI.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { AuthModal } from './components/AuthModal.jsx'
import { db } from './services/database.js'
import { nlpProcessor } from './services/nlpProcessor.js'
import { useLanguage } from './utils/constants.js'

export function App() {
  const [initialized, setInitialized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [sessions, setSessions] = useState([])
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    initializeApp()
    loadSessions()
  }, [])

  const initializeApp = async () => {
    try {
      console.log('🚀 Starting AGIG App Initialization...')
      await db.init()
      console.log('✅ Database initialized')
      await nlpProcessor.init()
      console.log('✅ NLP Processor initialized')
      setInitialized(true)
      console.log('🎉 AGIG initialized successfully!')
    } catch (error) {
      console.error('💥 App initialization failed:', error)
      setInitialized(true)
    }
  }

  const loadSessions = async () => {
    try {
      const history = await db.getChatHistory(200)
      const groupedSessions = groupMessagesBySession(history)
      setSessions(groupedSessions)
      if (groupedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(groupedSessions[0].sessionId)
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  const groupMessagesBySession = (messages) => {
    const sessionsMap = new Map()
    messages.forEach(message => {
      const sessionId = message.sessionId || 'default'
      if (!sessionsMap.has(sessionId)) {
        sessionsMap.set(sessionId, { sessionId, messages: [], timestamp: message.timestamp, preview: '' })
      }
      const session = sessionsMap.get(sessionId)
      session.messages.push(message)
      if (!session.preview && message.type === 'user') {
        session.preview = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
      }
    })
    return Array.from(sessionsMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  const generateSessionId = () => 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

  const startNewChat = () => {
    const newSessionId = generateSessionId()
    setCurrentSessionId(newSessionId)
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const toggleAuthModal = () => setAuthModalOpen(!authModalOpen)

  if (!initialized) {
    return (
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Initializing AGIG...</p>
      </div>
    )
  }

  return (
    <div class="app">
      <header class="header-bar">
        <div class="header-content">
          <button class="logo-btn" onClick={toggleSidebar}>
            <span class="app-name">AGIG</span>
          </button>
          <div class="header-actions">
            <select class="language-selector" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="am">አማርኛ</option>
            </select>
            <button class="auth-btn" onClick={toggleAuthModal}>
              <span class="material-symbols-rounded">account_circle</span>
              <span class="auth-text">Sign In</span>
            </button>
          </div>
        </div>
      </header>
      <Sidebar isOpen={sidebarOpen} onClose={toggleSidebar} currentSessionId={currentSessionId}
        onSessionChange={setCurrentSessionId} onNewChat={startNewChat} sessions={sessions} />
      <AuthModal isOpen={authModalOpen} onClose={toggleAuthModal} />
      <div class="container">
        <header class="app-header">
          <h1 class="heading">AGIG</h1>
          <h4 class="sub-heading">{t.welcomeDescription}</h4>
        </header>
        <ChatUI currentSessionId={currentSessionId} onNewSession={startNewChat} language={language} />
      </div>
    </div>
  )
}
EOF

# Create ChatUI Component
echo "💬 Creating ChatUI component..."
cat > src/components/ChatUI.jsx << 'EOF'
import { useState, useEffect, useRef } from 'preact/hooks'
import { db } from '../services/database.js'
import { nlpProcessor } from '../services/nlpProcessor.js'
import { useLanguage } from '../utils/constants.js'

export function ChatUI(props) {
  const [state, setState] = useState({ messages: [], inputText: '', isProcessing: false, isTyping: false })
  const chatContainerRef = useRef(null)
  const { t } = useLanguage()

  useEffect(() => {
    loadSessionMessages()
  }, [props.currentSessionId])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [state.messages])

  const loadSessionMessages = async () => {
    if (!props.currentSessionId) {
      setState(prev => ({ ...prev, messages: [] }))
      return
    }
    try {
      const allMessages = await db.getAllChatHistory()
      const sessionMessages = allMessages.filter(msg => msg.sessionId === props.currentSessionId && msg.type !== 'system')
      setState(prev => ({ ...prev, messages: sessionMessages }))
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { inputText, isProcessing } = state
    if (!inputText.trim() || isProcessing) return

    if (!props.currentSessionId && props.onNewSession) {
      props.onNewSession()
      setTimeout(() => {
        sendMessage(inputText, 'user')
        setState(prev => ({ ...prev, inputText: '' }))
        setTimeout(() => generateAIResponse(inputText), 500)
      }, 100)
    } else {
      await sendMessage(inputText, 'user')
      setState(prev => ({ ...prev, inputText: '' }))
      setTimeout(() => generateAIResponse(inputText), 500)
    }
  }

  const sendMessage = async (content, type) => {
    const sessionId = props.currentSessionId
    if (!sessionId) return
    const message = { type, content, timestamp: new Date().toISOString(), sessionId }
    setState(prev => ({ ...prev, messages: [...prev.messages, message], isProcessing: type === 'user' }))
    await db.saveChatMessage(message)
  }

  const generateAIResponse = async (userMessage) => {
    try {
      const response = await nlpProcessor.chat(userMessage)
      await typeMessage(typeof response === 'string' ? response : response.text || "How can I help you?", 'bot')
    } catch (error) {
      console.error('Error:', error)
      await typeMessage("I'm sorry, I encountered an error.", 'bot')
    }
  }

  const typeMessage = async (content, type) => {
    const message = { type, content: '', timestamp: new Date().toISOString(), sessionId: props.currentSessionId }
    setState(prev => ({ ...prev, messages: [...prev.messages, message], isTyping: true }))

    for (let i = 0; i <= content.length; i++) {
      await new Promise(r => setTimeout(r, 15))
      setState(prev => {
        const messages = [...prev.messages]
        if (messages.length > 0) messages[messages.length - 1].content = content.substring(0, i)
        return { ...prev, messages }
      })
    }
    setState(prev => ({ ...prev, isProcessing: false, isTyping: false }))
    await db.saveChatMessage({ type, content, timestamp: new Date().toISOString(), sessionId: props.currentSessionId })
  }

  const handleSuggestionClick = async (text) => {
    await sendMessage(text, 'user')
    setTimeout(() => generateAIResponse(text), 500)
  }

  const renderSuggestions = () => {
    const suggestions = [
      '🚚 Integrated Freight Transport License (IFTMS)',
      '📄 Analyze a research paper',
      '✅ Verify government document',
      '📜 Review legal document',
      '🎬 Create advertisement video from photos',
      '🔄 Renew business license'
    ]
    return (
      <div class="suggestions-container">
        <ul class="suggestions">
          {suggestions.map((text, idx) => (
            <li key={idx} class="suggestions-item" onClick={() => handleSuggestionClick(text)}>
              <div class="suggestion-content"><p class="text">{text}</p></div>
              <span class="arrow-icon material-symbols-rounded">arrow_forward</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div class="chat-ui">
      {state.messages.length === 0 && renderSuggestions()}
      <div class="chats-container" ref={chatContainerRef}>
        {state.messages.map((message, idx) => (
          <div key={idx} class={`message ${message.type}-message`}>
            {message.type === 'bot' && <div class="avatar">🤖</div>}
            <div class="message-content">
              <div class="message-text">{message.content}</div>
            </div>
          </div>
        ))}
        {state.isTyping && (
          <div class="message bot-message">
            <div class="avatar">🤖</div>
            <div class="typing-indicator"><span></span><span></span><span></span></div>
          </div>
        )}
      </div>
      <div class="prompt-container">
        <form class="prompt-form" onSubmit={handleSubmit}>
          <input type="text" placeholder={t.typeMessage} class="prompt-input"
            value={state.inputText} onInput={(e) => setState(prev => ({ ...prev, inputText: e.target.value }))}
            disabled={state.isProcessing} />
          <button type="submit" class="material-symbols-rounded" disabled={state.isProcessing || !state.inputText.trim()}>
            arrow_upward
          </button>
        </form>
        <p class="disclaimer-text">Advanced Government Services powered by AI</p>
      </div>
    </div>
  )
}
EOF

# Create Sidebar Component
echo "📋 Creating Sidebar component..."
cat > src/components/Sidebar.jsx << 'EOF'
export function Sidebar({ isOpen, onClose, currentSessionId, onSessionChange, onNewChat, sessions }) {
  return (
    <>
      <div class={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}></div>
      <div class={`sidebar ${isOpen ? 'open' : ''}`}>
        <div class="sidebar-header">
          <h3>Chat History</h3>
          <button class="close-btn material-symbols-rounded" onClick={onClose}>close</button>
        </div>
        <div class="sidebar-content">
          <button class="new-chat-btn" onClick={onNewChat}>
            <span class="material-symbols-rounded">add</span> New Chat
          </button>
          <div class="chat-history-list">
            {sessions.length === 0 && <p style={{ textAlign: 'center', opacity: 0.7 }}>No chats yet. Start a new conversation!</p>}
            {sessions.map(session => (
              <div key={session.sessionId} class={`chat-session-item ${currentSessionId === session.sessionId ? 'active' : ''}`}
                onClick={() => onSessionChange(session.sessionId)}>
                <div class="session-preview">{session.preview || 'New Chat'}</div>
                <div class="session-date">{new Date(session.timestamp).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
EOF

# Create AuthModal Component
echo "🔐 Creating AuthModal component..."
cat > src/components/AuthModal.jsx << 'EOF'
export function AuthModal({ isOpen, onClose }) {
  if (!isOpen) return null
  
  const handleGoogleLogin = () => {
    alert('Google authentication will be available soon!')
    onClose()
  }
  
  const handleFaydaLogin = () => {
    alert('Fayda ID authentication will be available soon!')
    onClose()
  }
  
  const handleEmailSubmit = (e) => {
    e.preventDefault()
    const email = e.target.email.value
    if (email) {
      alert(`Login link sent to ${email}`)
      onClose()
    }
  }
  
  return (
    <div class="oauth-modal active">
      <div class="oauth-modal-content">
        <button class="close-oauth-btn material-symbols-rounded" onClick={onClose}>close</button>
        <div class="oauth-header">
          <h2>Welcome to AGIG</h2>
          <p>Sign in to access government services</p>
        </div>
        <div class="oauth-options">
          <button class="oauth-btn google-btn" onClick={handleGoogleLogin}>
            <span class="oauth-icon">G</span> Continue with Google
          </button>
          <button class="oauth-btn fayda-btn" onClick={handleFaydaLogin}>
            <span class="oauth-icon">F</span> Continue with Fayda
          </button>
          <div class="divider"><span>or</span></div>
          <form class="email-form" onSubmit={handleEmailSubmit}>
            <input type="email" name="email" placeholder="Enter your email" class="email-input" required />
            <button type="submit" class="email-btn">Continue with Email</button>
          </form>
        </div>
        <div class="oauth-footer">
          <p>By continuing, you agree to our <a href="#">Terms of Service</a></p>
        </div>
      </div>
    </div>
  )
}
EOF

# Create Database Service
echo "🗄️ Creating Database service..."
cat > src/services/database.js << 'EOF'
import { openDB } from 'idb'

const DB_NAME = 'AGIGDB'
const DB_VERSION = 1
const STORE_NAME = 'chatHistory'

class Database {
  constructor() { this.db = null }

  async init() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
          store.createIndex('timestamp', 'timestamp')
          store.createIndex('sessionId', 'sessionId')
        }
      }
    })
    return this.db
  }

  async saveChatMessage(messageData) {
    const message = { ...messageData, timestamp: new Date().toISOString() }
    return await this.db.add(STORE_NAME, message)
  }

  async getChatHistory(limit = 100) {
    const tx = this.db.transaction(STORE_NAME, 'readonly')
    const index = tx.objectStore(STORE_NAME).index('timestamp')
    let cursor = await index.openCursor(null, 'prev')
    const results = []
    while (cursor && results.length < limit) {
      results.push(cursor.value)
      cursor = await cursor.continue()
    }
    return results
  }

  async getAllChatHistory() { 
    return await this.db.getAll(STORE_NAME) 
  }
  
  async clearChatHistory() {
    const tx = this.db.transaction(STORE_NAME, 'readwrite')
    await tx.objectStore(STORE_NAME).clear()
    return tx.done
  }
}

export const db = new Database()
EOF

# Create NLP Processor Service
echo "🧠 Creating NLP Processor service..."
cat > src/services/nlpProcessor.js << 'EOF'
let initialized = false

export async function initNLPProcessor() {
  if (initialized) return
  console.log('🔄 Initializing NLP Processor...')
  await new Promise(r => setTimeout(r, 500))
  initialized = true
  console.log('✅ NLP Processor initialized')
}

export async function chat(message, file) {
  await initNLPProcessor()
  
  if (file) {
    return `📄 File "${file.name}" (${(file.size / 1024).toFixed(2)} KB) uploaded successfully! Analysis will be processed shortly.`
  }
  
  const lowerMsg = message.toLowerCase()
  
  // IFTMS - Freight Transport
  if (lowerMsg.includes('freight') || lowerMsg.includes('transport') || lowerMsg.includes('iftms') || 
      lowerMsg.includes('integrated freight') || lowerMsg.includes('motl')) {
    return `🚚 **Integrated Freight Transport Management System (IFTMS)**

Welcome to the IFTMS service! Let's begin the registration process.

**Step 1: Business License Verification**
Please provide your business license number in this format: **14/668/5068/2004** or upload your license certificate.

Documents required:
- Business License Certificate
- Tax Clearance Certificate
- Vehicle Registration Documents

What would you like to do?
1️⃣ Enter license number manually
2️⃣ Upload license document`
  }
  
  // Document Analysis
  if (lowerMsg.includes('analyze') || lowerMsg.includes('research') || lowerMsg.includes('paper')) {
    return `📊 **Document Analysis Service**

I can analyze various document types:
- **Research Papers** - Methodology, findings, conclusions
- **Legal Documents** - Clauses, parties, obligations  
- **Government IDs** - Verification, data extraction
- **Financial Records** - Invoices, statements, receipts

Please upload your document (PDF or image) and I'll provide a detailed analysis including:
• Document classification
• Key information extraction
• Summary generation
• Confidence scoring

Ready to get started? Upload your document now!`
  }
  
  // Document Verification
  if (lowerMsg.includes('verify') || lowerMsg.includes('government') || lowerMsg.includes('id') || 
      lowerMsg.includes('license') || lowerMsg.includes('certificate')) {
    return `✅ **Government Document Verification**

I can verify the following document types:
- Business License
- National ID / Fayda ID  
- Driver's License
- Vehicle Registration
- Tax Certificate

**To verify your document:**
1. Upload a clear photo or PDF
2. I'll extract and validate the information
3. Receive verification status within seconds

Please upload your document to begin verification.`
  }
  
  // Legal Documents
  if (lowerMsg.includes('legal') || lowerMsg.includes('contract') || lowerMsg.includes('agreement')) {
    return `⚖️ **Legal Document Analysis**

I specialize in analyzing legal documents including:
- Contracts and Agreements
- Terms of Service
- NDAs (Non-Disclosure Agreements)
- Leases and Tenancy Agreements

**What I'll extract:**
• Key parties involved
• Important dates and deadlines
• Obligations and responsibilities
• Termination clauses
• Liability limitations

Upload your legal document for a comprehensive review.`
  }
  
  // Video Generation
  if (lowerMsg.includes('video') || lowerMsg.includes('advert') || lowerMsg.includes('slide')) {
    return `🎬 **AI Video Ad Generator**

Create professional advertisement videos from your photos!

**How it works:**
1. Upload 3-10 photos
2. Provide a title for your video
3. Choose a theme (Modern, Classic, Corporate)
4. AI generates a slideshow video with transitions and music

**Features:**
✨ Smooth transitions between images
🎵 Background music
📝 Text overlays
🎨 Multiple themes available

Ready to create? Upload your photos to get started!`
  }
  
  // License Renewal
  if (lowerMsg.includes('renew') || lowerMsg.includes('update license')) {
    return `🔄 **Business License Renewal Service**

I can help you renew your business license online!

**Information needed:**
• Current license number
• Tax clearance certificate
• Updated business information
• Payment for renewal fees

**Process:**
1. Verify existing license
2. Upload required documents
3. Make payment
4. Download renewed license

Let's start by entering your license number or uploading your current certificate.`
  }
  
  // Greetings
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') || lowerMsg.includes('good morning')) {
    return `👋 **Welcome to AGIG!** 

I'm your AI assistant for Ethiopian government services. I can help you with:
- 🚚 Freight Transport License (IFTMS)
- 📄 Document Analysis & Verification
- ⚖️ Legal Document Review
- 🎬 AI Video Ad Generation
- 🔄 License Renewals

What would you like assistance with today?`
  }
  
  // Help
  if (lowerMsg.includes('help') || lowerMsg.includes('what can you do') || lowerMsg.includes('capabilities')) {
    return `🆘 **AGIG Service Guide**

**Available Services:**

1️⃣ **IFTMS** - Freight Transport License Registration
   - Business license verification
   - Vehicle registration
   - Driver information
   - License issuance

2️⃣ **Document Analysis**
   - Research papers analysis
   - Legal document review
   - Government ID verification
   - Financial document processing

3️⃣ **Business License Renewal**
   - Online renewal process
   - Document submission
   - Payment processing

4️⃣ **Video Ad Generator**
   - Create slideshow videos from photos
   - Professional transitions & music

**Just type what you need or upload a document to get started!**`
  }
  
  // Thanks
  if (lowerMsg.includes('thank')) {
    return `🙏 You're very welcome! I'm glad I could help.

Is there anything else you'd like assistance with today? I'm here 24/7 to help with government services and document processing.`
  }
  
  // Default response
  return `🤖 **AGIG Assistant**

I understand you're looking for assistance with government services. 

Please choose from one of these services:
- **IFTMS** - Freight transport license
- **Document Analysis** - Research, legal, government docs
- **License Renewal** - Business license updates  
- **Video Ad Generator** - Create promotional videos

Or simply describe what you need help with, and I'll guide you through the process!

*You can also upload documents for instant analysis.*`
}

export const nlpProcessor = { init: initNLPProcessor, chat }
EOF

# Create Constants and Language Support
echo "🌐 Creating constants and language support..."
cat > src/utils/constants.js << 'EOF'
import { useState, useEffect } from 'preact/hooks'

const translations = {
  en: {
    welcome: 'Welcome to AGIG',
    welcomeDescription: 'Advanced Government Intelligence Gateway',
    welcomeMessage: 'Hello! How can I help you today?',
    typeMessage: 'Request AGIG services...',
    send: 'Send'
  },
  am: {
    welcome: 'እንኳን ወደ AGIG በደህና መጡ',
    welcomeDescription: 'የላቀ የመንግስት እውቀት መግቢያ',
    welcomeMessage: 'ሰላም! ዛሬ እንዴት ልረዳዎት እችላለሁ?',
    typeMessage: 'የAGIG አገልግሎቶችን ይጠይቁ...',
    send: 'ላክ'
  }
}

export function useLanguage() {
  const [language, setLanguage] = useState('en')
  useEffect(() => {
    const savedLang = localStorage.getItem('agig-language')
    if (savedLang) setLanguage(savedLang)
  }, [])
  const updateLanguage = (lang) => {
    setLanguage(lang)
    localStorage.setItem('agig-language', lang)
  }
  return { language, setLanguage: updateLanguage, t: translations[language] }
}
EOF

# Create CSS Styles
echo "🎨 Creating CSS styles..."
cat > src/styles/app.css << 'EOF'
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap");

* { margin: 0; padding: 0; box-sizing: border-box; font-family: "Poppins", sans-serif; }

:root {
  --text-color: #edf3ff;
  --subheading-color: #97a7ca;
  --placeholder-color: #c3cdde;
  --primary-color: #101623;
  --secondary-color: #283045;
  --secondary-hover-color: #333e58;
  --scrollbar-color: #626a7f;
}

body { color: var(--text-color); background: var(--primary-color); }

.container { overflow-y: auto; padding: 32px 0; height: calc(100vh - 227px); scrollbar-color: var(--scrollbar-color) transparent; }
.container :where(.app-header, .suggestions, .prompt-wrapper) { margin: 0 auto; width: 100%; padding: 0 20px; max-width: 990px; }
.container .app-header { margin-top: 3vh; }
.app-header .heading { width: fit-content; font-size: 3rem; background: linear-gradient(to right, #1d7efd, #8f6fff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.app-header .sub-heading { font-size: 1.5rem; margin-top: -5px; color: var(--subheading-color); }

.suggestions { width: 100%; list-style: none; display: flex; gap: 15px; margin-top: 5vh; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.suggestions .suggestions-item { cursor: pointer; padding: 18px; width: 260px; flex-shrink: 0; display: flex; scroll-snap-align: center; flex-direction: column; border-radius: 12px; background: var(--secondary-color); transition: 0.3s ease; }
.suggestions .suggestions-item:hover { background: var(--secondary-hover-color); transform: translateY(-2px); }
.suggestions .suggestions-item .text { font-size: 0.95rem; margin-bottom: 12px; }
.suggestions .suggestions-item .arrow-icon { align-self: flex-end; opacity: 0.7; }

.chats-container { display: flex; gap: 20px; flex-direction: column; margin-bottom: 20px; }
.chats-container .message { display: flex; gap: 11px; align-items: flex-start; }
.chats-container .message .avatar { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: #1d7efd; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.chats-container .user-message { flex-direction: row-reverse; }
.chats-container .user-message .message-content { max-width: 80%; }
.chats-container .user-message .message-text { padding: 10px 16px; background: var(--secondary-color); border-radius: 18px 18px 4px 18px; }
.chats-container .bot-message .message-text { padding: 10px 16px; background: var(--secondary-hover-color); border-radius: 18px 18px 18px 4px; white-space: pre-wrap; }

.prompt-container { position: fixed; width: 100%; left: 0; bottom: 0; padding: 16px 0; background: var(--primary-color); border-top: 1px solid var(--secondary-color); }
.prompt-form { display: flex; gap: 12px; height: 56px; align-items: center; border-radius: 130px; background: var(--secondary-color); margin: 0 auto; width: 100%; max-width: 990px; padding: 0 20px; }
.prompt-input { width: 100%; height: 100%; background: none; outline: none; border: none; font-size: 1rem; color: var(--text-color); padding-left: 24px; }
.prompt-input::placeholder { color: var(--placeholder-color); }
.prompt-form button { width: 48px; height: 48px; flex-shrink: 0; cursor: pointer; border-radius: 50%; font-size: 1.4rem; border: none; color: var(--text-color); background: var(--secondary-hover-color); transition: 0.3s ease; display: flex; align-items: center; justify-content: center; }
.prompt-form button:hover:not(:disabled) { background: #1d7efd; transform: scale(1.02); }
.prompt-form button:disabled { opacity: 0.5; cursor: not-allowed; }
.disclaimer-text { font-size: 0.7rem; text-align: center; padding: 12px 20px 0; color: var(--placeholder-color); opacity: 0.7; }

.typing-indicator { display: flex; align-items: center; gap: 4px; padding: 10px 16px; background: var(--secondary-hover-color); border-radius: 18px; }
.typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background: var(--text-color); animation: typing 1.4s infinite ease-in-out; }
.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
@keyframes typing { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.6; } 40% { transform: scale(1); opacity: 1; } }

.loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
.spinner { width: 50px; height: 50px; border: 4px solid var(--secondary-color); border-left: 4px solid #1d7efd; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.header-bar { position: fixed; top: 0; left: 0; right: 0; background: var(--primary-color); border-bottom: 1px solid var(--secondary-color); z-index: 1000; padding: 0 20px; }
.header-content { display: flex; justify-content: space-between; align-items: center; height: 60px; max-width: 1200px; margin: 0 auto; }
.logo-btn { background: none; border: none; color: var(--text-color); cursor: pointer; font-size: 1.3rem; font-weight: 700; background: linear-gradient(to right, #1d7efd, #8f6fff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header-actions { display: flex; gap: 12px; align-items: center; }
.auth-btn { display: flex; align-items: center; gap: 8px; background: var(--secondary-color); border: none; color: var(--text-color); padding: 8px 16px; border-radius: 20px; cursor: pointer; transition: 0.3s ease; }
.auth-btn:hover { background: var(--secondary-hover-color); }
.language-selector { padding: 6px 12px; border-radius: 20px; border: 1px solid var(--secondary-color); background: var(--primary-color); color: var(--text-color); cursor: pointer; }

.sidebar { position: fixed; top: 0; left: -350px; width: 320px; height: 100vh; background: var(--primary-color); border-right: 1px solid var(--secondary-color); z-index: 1001; transition: left 0.3s ease; display: flex; flex-direction: column; }
.sidebar.open { left: 0; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--secondary-color); }
.sidebar-header h3 { margin: 0; }
.close-btn { background: none; border: none; color: var(--text-color); cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.sidebar-content { flex: 1; padding: 20px; overflow-y: auto; }
.new-chat-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--secondary-color); border: none; color: var(--text-color); padding: 12px 16px; border-radius: 12px; cursor: pointer; margin-bottom: 20px; transition: 0.3s ease; }
.new-chat-btn:hover { background: var(--secondary-hover-color); }
.chat-session-item { padding: 12px; background: var(--secondary-color); border-radius: 10px; margin-bottom: 8px; cursor: pointer; transition: 0.3s ease; }
.chat-session-item:hover { background: var(--secondary-hover-color); }
.chat-session-item.active { background: #1d7efd; }
.session-preview { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.session-date { font-size: 0.7rem; opacity: 0.7; }
.sidebar-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 1000; display: none; }
.sidebar-overlay.active { display: block; }

.oauth-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); z-index: 1002; display: none; align-items: center; justify-content: center; }
.oauth-modal.active { display: flex; }
.oauth-modal-content { background: var(--primary-color); border-radius: 20px; padding: 30px; max-width: 400px; width: 90%; position: relative; border: 1px solid var(--secondary-color); }
.close-oauth-btn { position: absolute; top: 15px; right: 15px; background: none; border: none; color: var(--text-color); cursor: pointer; padding: 4px; border-radius: 50%; }
.oauth-header { text-align: center; margin-bottom: 30px; }
.oauth-header h2 { margin-bottom: 8px; }
.oauth-header p { color: var(--subheading-color); }
.oauth-options { display: flex; flex-direction: column; gap: 12px; }
.oauth-btn { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; padding: 12px 16px; border: 1px solid var(--secondary-color); border-radius: 12px; background: var(--primary-color); color: var(--text-color); cursor: pointer; transition: 0.3s ease; }
.oauth-btn:hover { background: var(--secondary-color); }
.oauth-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; background: #fff; color: #333; border-radius: 50%; }
.divider { display: flex; align-items: center; text-align: center; margin: 20px 0; color: var(--subheading-color); }
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--secondary-color); }
.divider span { padding: 0 16px; }
.email-input { width: 100%; padding: 12px 16px; border: 1px solid var(--secondary-color); border-radius: 12px; background: var(--primary-color); color: var(--text-color); margin-bottom: 12px; font-size: 1rem; }
.email-input:focus { outline: none; border-color: #1d7efd; }
.email-btn { width: 100%; padding: 12px 16px; border: none; border-radius: 12px; background: #1d7efd; color: white; cursor: pointer; font-size: 1rem; transition: 0.3s ease; }
.email-btn:hover { background: #0264e3; }
.oauth-footer { margin-top: 20px; text-align: center; font-size: 0.75rem; color: var(--subheading-color); }
.oauth-footer a { color: #1d7efd; text-decoration: none; }

@media (max-width: 768px) {
  .container { padding: 20px 0 100px; height: calc(100vh - 200px); }
  .app-header .heading { font-size: 2rem; }
  .app-header .sub-heading { font-size: 1.2rem; }
  .suggestions .suggestions-item { width: 220px; padding: 14px; }
  .sidebar { width: 100%; left: -100%; }
  .prompt-form { padding: 0 16px; }
  .header-content { padding: 0 10px; }
  .auth-btn span:last-child { display: none; }
  .auth-btn { padding: 8px 12px; }
}
EOF

# Install dependencies
echo "📦 Installing npm dependencies (this may take a few minutes)..."
npm install --legacy-peer-deps

echo ""
echo "=============================================="
echo "✅ AGIG Installation Complete!"
echo "=============================================="
echo ""
echo "🚀 To start the application:"
echo "   cd ~/AGIG && npm run dev"
echo ""
echo "📱 The app will be available at:"
echo "   http://localhost:5173"
echo ""
echo "🌐 To expose to the internet (share with others):"
echo "   pip install flaredantic"
echo "   cd ~/AGIG && npm run dev &"
echo "   flare --port 5173 -v"
echo ""
echo "=============================================="

# Ask if user wants to start now
echo ""
read -p "Start AGIG now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🚀 Starting AGIG..."
  npm run dev
fi
SCRIPT_EOF