const APP_SHELL_CACHE = 'app-shell-cache-v2';
const STATIC_ASSETS_CACHE = 'static-assets-cache-v2';
const CATALOG_CACHE = 'catalog-cache-v2';
const DATASETS_CACHE = 'datasets-cache-v2'; // Cache for datasets

const ALL_CACHES = [
  APP_SHELL_CACHE,
  STATIC_ASSETS_CACHE,
  CATALOG_CACHE,
  DATASETS_CACHE
];

// Assets to cache on installation
const APP_SHELL_FILES = [
  '/', // Main HTML (SvelteKit will ensure JS/CSS bundles are referenced)
  '/app.css',
  '/app.html'
];

const STATIC_ASSETS_FILES = [
  '/favicon.png',
  '/manifest.json' // Assuming manifest.json is in static and linked in app.html
];

const CATALOG_FILES = [
  '/catalog.json' // Catalog file
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(APP_SHELL_CACHE).then(cache => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(APP_SHELL_FILES);
      }),
      caches.open(STATIC_ASSETS_CACHE).then(cache => {
        console.log('Service Worker: Caching Static Assets');
        return cache.addAll(STATIC_ASSETS_FILES);
      }),
      caches.open(CATALOG_CACHE).then(cache => {
        console.log('Service Worker: Caching Catalog');
        return cache.addAll(CATALOG_FILES);
      }),
      // Pre-cache all datasets from catalog.json
      fetch('/catalog.json')
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch catalog.json for pre-caching datasets');
          }
          return response.json();
        })
        .then(catalogEntries => {
          const datasetFilesToCache = catalogEntries.map(entry => entry.filePath);
          if (datasetFilesToCache.length > 0) {
            console.log('Service Worker: Caching all datasets from catalog:', datasetFilesToCache);
            return caches.open(DATASETS_CACHE).then(cache => {
              return cache.addAll(datasetFilesToCache)
                .then(() => console.log(`Service Worker: Successfully pre-cached ${datasetFilesToCache.length} datasets.`));
            });
          } else {
            console.log('Service Worker: No datasets found in catalog to pre-cache.');
            return Promise.resolve(); // Nothing to cache
          }
        })
        .catch(error => {
          console.error('Service Worker: Error pre-caching datasets from catalog:', error);
          // Optionally re-throw or handle to decide if SW install should fail
          // For now, we let it proceed without failing the entire SW installation for this.
          return Promise.resolve(); // Resolve to not block other caching
        })
    ]).then(() => {
      console.log('Service Worker: All initial assets and datasets pre-caching routines complete.');
      return self.skipWaiting(); // Activate the new service worker immediately
    }).catch(error => {
        console.error('Service Worker: Failed to cache initial assets or pre-cache datasets:', error);
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!ALL_CACHES.includes(cacheName)) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Old caches cleared.');
      return self.clients.claim(); // Take control of all open clients
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Strategy for datasets: Cache-first, then network
  if (requestUrl.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.open(DATASETS_CACHE).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('Service Worker: Serving from dataset cache:', event.request.url);
            return cachedResponse;
          }
          console.log('Service Worker: Fetching from network and caching dataset:', event.request.url);
          return fetch(event.request).then(networkResponse => {
            // Check if we received a valid response
            if (networkResponse && networkResponse.status === 200) {
                 cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            console.error('Service Worker: Error fetching and caching dataset:', error);
            // Optionally, return a fallback response here
          });
        });
      })
    );
    return; // Ensure no other fetch logic handles this
  }

  // Strategy for other requests (app shell, static assets, catalog, SvelteKit chunks)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // console.log('Service Worker: Serving from cache v2:', event.request.url);
        return cachedResponse;
      }
      // console.log('Service Worker: Fetching from network v2:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        // If it's a SvelteKit generated asset (typically under /_app/) or other important root paths, cache it dynamically.
        if ((requestUrl.pathname.startsWith('/_app/') || requestUrl.pathname === '/') &&
            networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          // console.log('Service Worker: Dynamically caching asset v2:', event.request.url);
          // Decide which cache: APP_SHELL_CACHE for core stuff, STATIC_ASSETS_CACHE for others if desired.
          // For simplicity, let's use APP_SHELL_CACHE for SvelteKit's own assets.
          const cacheName = requestUrl.pathname.startsWith('/_app/') ? APP_SHELL_CACHE : STATIC_ASSETS_CACHE; // These are v2 names now
          return caches.open(cacheName).then(cache => {
            // console.log(`Service Worker: Adding to ${cacheName} (v2): ${event.request.url}`);
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(error => {
          console.error('Service Worker: Error fetching resource:', error, event.request.url);
          // Fallback for offline navigation requests to the main app shell.
          if (event.request.mode === 'navigate') {
            // console.log('Service Worker: Serving fallback shell for navigation error.');
            return caches.match('/');
          }
          // For other types of failed requests, just let the error propagate.
      });
    })
  );
});
