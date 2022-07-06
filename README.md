# edgeSWR

Stale while revalidate for web worker environment

**installation**
```shell
npm i edge-swr
```

**usage example cloudflare worker:**

```ts
import edgeSWR from "edge-swr";

const html = `<!DOCTYPE html>
<body>
    <h1>Hello World</h1>
</body>`;

async function handleRequest(request) {
  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  });
}

async function withSWRHandler(
  event: FetchEvent,
  requestHandler: () => Promise<Response>
) {
  let cache = await caches.open('swr_cache_example');

  return edgeSWR({
    request: event.request,
    cacheKey(request) {
      return new Request(request.url, {method: request.method});
    },
    handler: requestHandler,
    match(cacheKey) {
      return cache.match(cacheKey);
    },
    put(cacheKey, content) {
      return cache.put(cacheKey, content);
    },
    waitUntil(promise) {
      event.waitUntil(promise);
    },
  });
}

addEventListener('fetch', event => {
  return event.respondWith(withSWRHandler(event, () => handleRequest(event.request)));
});



```
