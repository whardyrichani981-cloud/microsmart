// Microsmart Service Worker v3
// Propósito: registrar el SW para habilitar PWA install prompt
// No cachea nada para evitar problemas — la carga rápida viene del caché del navegador

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// No interceptamos fetch — dejamos que el navegador maneje todo normalmente
