const APP_SHELL_CACHE = 'app-shell-cache-v4';
const STATIC_ASSETS_CACHE = 'static-assets-cache-v4';
const CATALOG_CACHE = 'catalog-cache-v4';
const DATASETS_CACHE = 'datasets-cache-v4'; // Cache for datasets

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
      // Aggressively cache manifest and favicon as a separate step
      caches.open(STATIC_ASSETS_CACHE).then(cache => { // STATIC_ASSETS_CACHE is now v4
        console.log('Service Worker: Aggressively caching manifest and favicon.');
        return cache.add('/manifest.json')
          .then(() => cache.add('/favicon.png'))
          .then(() => console.log('Service Worker: Manifest and favicon aggressively cached.'))
          .catch(error => {
            console.error('Service Worker: Error aggressively caching manifest or favicon:', error);
            return Promise.resolve(); // Still resolve to not break Promise.all
          });
      }),
      // Pre-cache all datasets from catalog.json, sourcing catalog.json from its cache
      caches.open(CATALOG_CACHE) // Open the cache for catalog.json (now v4)
        .then(catalogCache => {
          return catalogCache.match('/catalog.json')
            .then(response => {
              if (!response) {
                console.error('Service Worker: Could not find /catalog.json in CATALOG_CACHE for pre-caching datasets. Skipping dataset pre-caching.');
                return Promise.resolve(); // Gracefully skip if catalog not cached
              }
              return response.json();
            })
            .then(catalogEntries => {
              if (!catalogEntries) { // Will be undefined if response.json() wasn't called due to catalog not found
                // Error already logged, just ensure we resolve.
                return Promise.resolve();
              }

              // Ensure catalogEntries is an array before trying to map over it
              if (!Array.isArray(catalogEntries)) {
                  console.error('Service Worker: Catalog data from cache is not an array. Skipping dataset pre-caching.', catalogEntries);
                  return Promise.resolve();
              }

              const datasetFilesToCache = catalogEntries
                .map(entry => entry.filePath)
                .filter(filePath => typeof filePath === 'string'); // Ensure filePath is a string

              if (datasetFilesToCache.length > 0) {
                console.log('Service Worker: Caching all datasets from catalog (via cached catalog.json):', datasetFilesToCache);
                return caches.open(DATASETS_CACHE) // Open the cache for datasets
                  .then(datasetsCache => {
                    return datasetsCache.addAll(datasetFilesToCache)
                      .then(() => console.log(`Service Worker: Successfully pre-cached ${datasetFilesToCache.length} datasets.`))
                      .catch(error => {
                        console.error(`Service Worker: Error adding datasets to ${DATASETS_CACHE}:`, error, datasetFilesToCache);
                        // If addAll fails, we still want to resolve to not break SW install.
                        // Individual file caching errors within addAll are handled by addAll itself.
                        return Promise.resolve(); 
                      });
                  });
              } else {
                console.log('Service Worker: No valid dataset filePaths found in cached catalog to pre-cache.');
                return Promise.resolve();
              }
            });
        })
        .catch(error => {
          console.error('Service Worker: Error pre-caching datasets using cached catalog:', error);
          return Promise.resolve(); // Resolve to not block other caching operations
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
        // console.log('Service Worker: Serving from cache v4:', event.request.url);
        return cachedResponse;
      }
      // console.log('Service Worker: Fetching from network v4:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        // If it's a SvelteKit generated asset (typically under /_app/) or other important root paths, cache it dynamically.
        if ((requestUrl.pathname.startsWith('/_app/') || requestUrl.pathname === '/') &&
            networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          // If it's the root path or an _app asset, use APP_SHELL_CACHE.
          // Otherwise, for any other unforeseen static assets that might be caught here,
          // STATIC_ASSETS_CACHE could be a fallback, though ideally all static assets are predefined.
          const cacheToUse = (requestUrl.pathname.startsWith('/_app/') || requestUrl.pathname === '/') 
                             ? APP_SHELL_CACHE 
                             : STATIC_ASSETS_CACHE; // Fallback, though less likely to be hit by non-_app non-/ paths
          console.log(`Service Worker: Dynamically caching ${requestUrl.pathname} into ${cacheToUse}`); // This is a v4 cache name now
          return caches.open(cacheToUse).then(cache => {
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
