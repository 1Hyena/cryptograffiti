// COMPILE_TIME variable is expected to be injected by the compile script.

var CACHE_PREFIX = "cg-sw-cache-";
var CACHE_NAME = CACHE_PREFIX+COMPILE_TIME;
var CACHE_URLS = [ "./" ];

self.addEventListener(
    "install",
    function(event) {
        event.waitUntil(
            caches.open(CACHE_NAME).then(
                function(cache) {
                    return cache.addAll(CACHE_URLS);
                }
            )
        );
    }
);

self.addEventListener(
    "fetch",
    function (event) {
        event.respondWith(
            fetch(event.request).catch(
                function() {
                    return caches.match(event.request);
                }
            )
        );
    }
);

self.addEventListener(
    "activate",
    function(event) {
        event.waitUntil(
            caches.keys().then(
                function(cacheNames) {
                    return Promise.all(
                        cacheNames.map(
                            function(cache_name) {
                                if (CACHE_NAME !== cache_name
                                && cache_name.startsWith(CACHE_PREFIX)) {
                                    return caches.delete(cache_name);
                                }
                            }
                        )
                    );
                }
            )
        );
    }
);
