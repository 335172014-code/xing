var CACHE_NAME = 'xing-cache-v2';
var PRE_CACHE_URLS = [
  'index.html',
  'jobs_data.json'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[xing-sw] Pre-caching', PRE_CACHE_URLS);
      return cache.addAll(PRE_CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // tokens.json 始终走网络，不使用缓存（确保动态 Token 实时同步）
  if (event.request.url.indexOf('tokens.json') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }
  // index.html（及页面导航请求）走 Network-First 策略：优先从网络获取最新版本，失败时回退缓存。
  // 修复原先 Cache-First 导致用户始终看到旧版本（如「复制」按钮缺失）的问题。
  // 注意：GitHub Pages 根路径导航的 URL 不含 "index.html"，故同时匹配 navigation 模式。
  var isHtmlNavigation = event.request.mode === 'navigate' ||
      event.request.url.indexOf('index.html') !== -1;
  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // 网络请求失败（离线等），回退到缓存版本
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('index.html');
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(function() {
        // Offline fallback
        return caches.match('index.html');
      });
    })
  );
});
