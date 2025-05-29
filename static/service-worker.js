const APP_SHELL_CACHE = 'app-shell-cache-v8';
const STATIC_ASSETS_CACHE = 'static-assets-cache-v8';
const CATALOG_CACHE = 'catalog-cache-v8';
const DATASETS_CACHE = 'datasets-cache-v8'; // Cache for datasets

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
  '/manifest.json', // Assuming manifest.json is in static and linked in app.html
  '/icon-maskable.png' // New addition
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
      caches.open(STATIC_ASSETS_CACHE).then(cache => { // STATIC_ASSETS_CACHE is now v8
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
      caches.open(CATALOG_CACHE) // Open the cache for catalog.json (now v8)
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
      console.log('Service Worker (v8): Old caches cleared.');
      return self.clients.claim(); // Take control of all open clients
    }).then(() => {
      // After claiming clients, message them about the update
      console.log('Service Worker (v8): Claimed clients. Attempting to message for SW_UPDATED.');
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          console.log(`Service Worker (v8): Posting SW_UPDATED to client ${client.id}`);
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    }).catch(err => {
        console.error('Service Worker (v8): Error during activation or messaging clients:', err);
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

  // NEW: Stale-While-Revalidate for /catalog.json
  if (requestUrl.pathname === '/catalog.json') {
    console.log('Service Worker (v8): Handling request for /catalog.json (Stale-While-Revalidate)');
    event.respondWith(
      caches.open(CATALOG_CACHE).then(cache => { // CATALOG_CACHE is v8
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              console.log('Service Worker (v8): Fetched /catalog.json from network. Updating cache.');
              cache.put(event.request, networkResponse.clone());
            } else if (networkResponse) { // Network error, but not a fetch exception
                console.warn(`Service Worker (v8): Network fetch for /catalog.json failed with status: ${networkResponse.status}. Not updating cache.`);
            }
            return networkResponse; // Return network response to the event.respondWith if cache wasn't found
          }).catch(error => {
            console.warn('Service Worker (v8): Network fetch for /catalog.json failed. Error:', error);
            // If network fails, and we didn't have a cachedResponse, this will propagate the error.
            // If we did have a cachedResponse, that was already returned.
          });

          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise; 
        });
      })
    );
    return; // Ensure no other fetch logic handles this request
  }

  // Network-first, then cache for main page navigation ('/')
  if (event.request.mode === 'navigate' && requestUrl.pathname === '/') {
    console.log('Service Worker (v8): Handling navigation request for / (Network-first)');
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Check if we received a valid response
          if (networkResponse && networkResponse.ok) {
            console.log('Service Worker (v8): Fetched / from network. Caching and returning.');
            const responseToCache = networkResponse.clone();
            caches.open(APP_SHELL_CACHE) // APP_SHELL_CACHE is v8
              .then(cache => {
                cache.put(event.request, responseToCache); // Cache the new response for '/'
              });
            return networkResponse;
          }
          // If network fetch gives a non-ok response (e.g. 404, 500), treat as failure for this strategy
          console.log(`Service Worker (v8): Network fetch for / failed with status: ${networkResponse.status}. Trying cache.`);
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('/'); // Fallback, should be same as event.request here
            });
        })
        .catch(error => {
          console.log('Service Worker (v8): Network fetch for / failed. Attempting to serve from cache. Error:', error);
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If event.request was specifically for '/', this is another way to try it.
              // This also handles the case where event.request might have had query params, but we just want the base page.
              return caches.match('/'); 
            });
        })
    );
    return; // Ensure no other fetch logic handles this navigation request
  }

  // Existing Strategy for other requests (app shell, static assets, SvelteKit chunks)
  // This will now handle non-'/' navigations (if any) and all other assets except /catalog.json.
  console.log(`Service Worker (v8): Handling other request (Cache-first): ${requestUrl.pathname}`);
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // console.log('Service Worker (v8): Serving from cache:', event.request.url);
        return cachedResponse;
      }
      // console.log('Service Worker (v8): Fetching from network:', event.request.url);
      return fetch(event.request).then(networkResponse => {
        // If it's a SvelteKit generated asset (typically under /_app/) cache it dynamically.
        // '/' and '/catalog.json' are handled by their specific strategies above.
        if (requestUrl.pathname.startsWith('/_app/') &&
            networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          
          const assetUrl = requestUrl.pathname;
          // For _app assets, always use APP_SHELL_CACHE as they are core to the app shell
          const cacheToUse = APP_SHELL_CACHE; // APP_SHELL_CACHE is v8
          
          // console.log(`Service Worker (v8): Attempting to dynamically cache ${assetUrl} into ${cacheToUse}`); // Too verbose
          
          return caches.open(cacheToUse).then(cache => {
            return cache.put(event.request, networkResponse.clone())
              .then(() => {
                // console.log(`Service Worker (v8): Successfully dynamically cached ${assetUrl}`); // Too verbose
                return networkResponse; // Return the original network response after successful cache
              })
              .catch(putError => {
                console.error(`Service Worker (v8): Failed to dynamically cache ${assetUrl}. Error:`, putError);
                // Still return the original network response even if caching failed,
                // as the resource was successfully fetched.
                return networkResponse; 
              });
          }).catch(openError => {
              console.error(`Service Worker (v8): Failed to open cache ${cacheToUse} for ${assetUrl}. Error:`, openError);
              return networkResponse; // Return network response if cache open fails
          });
        }
        return networkResponse;
      }).catch(error => {
          const reqUrl = event.request.url;
          console.error(`Service Worker (v8): Network fetch failed for other request: ${reqUrl}. Error:`, error);
          if (reqUrl.includes('/_app/') && reqUrl.endsWith('.js')) {
              console.warn(`Service Worker (v8): A critical JS asset (${reqUrl}) failed to load from network. Offline functionality might be impaired if not cached.`);
          }
          // Fallback for offline navigation requests to the main app shell.
          if (event.request.mode === 'navigate') { // For any other navigation not caught by the '/' or '/catalog.json' specific handlers
            console.log(`Service Worker (v8): Serving fallback shell ('/') for failed navigation to non-root page ${reqUrl}.`);
            return caches.match('/');
          }
          // For other types of failed requests, just let the error propagate (or return a more generic offline response if desired)
      });
    })
  );
});
