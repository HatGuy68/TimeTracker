const CACHE = 'timetracker-v8'

const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './site.config.json',
  './script.js',
  './tailwind.min.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './src/lib/services/timeTrackingService.js',
  './src/lib/services/settingsService.js',
  './src/lib/db/db.js',
  './src/lib/models/settings.js',
  './scripts/generate-uuid.js',
]

async function precacheAssets(cache) {
  await Promise.all(
    PRECACHE.map(async (url) => {
      try {
        await cache.add(url)
      } catch (error) {
        console.warn('[sw] precache failed:', url, error)
      }
    })
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => precacheAssets(cache)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response
        }

        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return response
      })
    })
  )
})
