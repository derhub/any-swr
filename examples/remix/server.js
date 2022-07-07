import * as build from '@remix-run/dev/server-build';
import {
  createRequestHandler,
  handleAsset,
} from '@remix-run/cloudflare-workers';
import edgeSWR from "edge-swr";

function createEventHandler(event) {
  let { build, getLoadContext, mode } = event;
  let handleRequest = withSWRHandler(
    createRequestHandler({
      build,
      getLoadContext,
      mode,
    }),
  );

  let handleEvent = async (event) => {
    let response = await handleAsset(event, build);

    if (!response) {
      response = await handleRequest(event);
    }

    return response;
  };

  return (event) => {
    try {
      event.respondWith(handleEvent(event));
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        event.respondWith(
          new Response(e.message || e.toString(), {
            status: 500,
          }),
        );
        return;
      }

      event.respondWith(
        new Response('Internal Error', {
          status: 500,
        }),
      );
    }
  };
}

function withSWRHandler(handler) {
  return async (event) => {
    let cache = await caches.open('swr_cache');
    return edgeSWR({
      debug: true,
      request() {
        return new Request(event.request.url, { method: event.request.method });
      },
      handler: () => handler(event),
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
  };
}

addEventListener(
  'fetch',
  createEventHandler({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext: (ctx) => {
      return ctx;
    },
  }),
);
