const CACHE_NAME      = 'agig-v1.0.05'
const MODEL_CACHE     = 'agig-bert-models'   // separate cache for large model files

const APP_URLS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0/dist/transformers.min.js'
]

// Hosts whose responses go into the MODEL_CACHE (large files, cache-first)
const MODEL_HOSTS = [
  'cdn.jsdelivr.net',           // transformers.js CDN
  'huggingface.co',             // model weights
  'huggingface.co/resolve',
]

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_URLS))
  )
  self.skipWaiting()
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          // Delete old app cache versions but keep model cache
          if (key !== CACHE_NAME && key !== MODEL_CACHE) {
            console.log('[SW] Deleting old cache:', key)
            return caches.delete(key)
          }
        })
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // 1. BERT / transformers.js model files → cache-first, long-lived
  const isModelRequest = MODEL_HOSTS.some(h => url.hostname.includes(h.split('/')[0]))
  if (isModelRequest) {
    event.respondWith(cacheFirstWithNetwork(event.request, MODEL_CACHE))
    return
  }

  // 2. App shell → network-first (fresh updates), fall back to cache
  event.respondWith(networkFirstWithCache(event.request, CACHE_NAME))
})

// Cache-first: great for large immutable model files
async function cacheFirstWithNetwork(request, cacheName) {
  const cache    = await caches.open(cacheName)
  const cached   = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())   // store for next time
    }
    return response
  } catch {
    return new Response('Offline — model file not cached yet', { status: 503 })
  }
}

// Network-first: keeps app shell fresh, falls back to cache when offline
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || new Response('Offline', { status: 503 })
  }
}

// ─── Compromise NLP in SW (original message handler preserved) ───────────────
self.addEventListener('message', function(e) {
  importScripts('https://unpkg.com/compromise@14.12.1/builds/compromise.min.js')
  const doc = self.nlp(e.data)
  const m   = doc.places()
  self.postMessage(m.json({ count: true, unique: true }))
}, false)
