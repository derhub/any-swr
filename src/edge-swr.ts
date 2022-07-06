import {
  cacheExpireAt,
  clientCacheControl,
  edgeCacheControl,
  parseCacheControl,
  setHeaders,
  shouldRevalidateCache,
  shouldStaleIfError,
} from './functions';
import {
  WWSWRCacheKey,
  WWSWRHeader,
  WWSWROption,
  WWSWRResponseCache,
} from './types';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STATUS,
  ORIGIN_CACHE_CONTROL,
} from './values';

export async function edgeSWR(options: WWSWROption) {
  let { request, cacheKey, match, put, waitUntil, handler } = options;
  if (request.method !== 'GET') {
    return handler();
  }

  let requestKey = cacheKey(request);
  let lastResponse = await match(requestKey);
  if (!lastResponse) {
    return execHandler(options, requestKey);
  }

  let status = lastResponse.headers.get(EDGE_CACHE_STATUS) || CACHE_STATUS.MISS;

  //TODO: implement stale-while-revalidate expiration
  if (shouldRevalidateCache(lastResponse)) {
    status = CACHE_STATUS.REVALIDATED;

    await put(
      requestKey,
      setHeaders(lastResponse, {
        [EDGE_CACHE_STATUS]: CACHE_STATUS.REVALIDATED,
      }),
    );

    waitUntil(execHandler(options, requestKey, lastResponse));
  }

  return setHeaders(lastResponse, {
    [EDGE_CACHE_STATUS]: status,
    [CACHE_CONTROL]:
      lastResponse.headers.get(CACHE_CONTROL) || 'private, no-store',
  });
}

async function execHandler(
  options: WWSWROption,
  requestKey: WWSWRCacheKey,
  lastResponse?: WWSWRResponseCache,
) {
  let { handler, request, put, waitUntil } = options;

  let response = await handler();
  let cacheControl = parseCacheControl(response);

  if (response.status >= 500) {
    // update: revalidated -> stale
    // override response to use cache if stale-if-error is in cache control
    //TODO: implement stale-if-error expiration
    if (lastResponse && shouldStaleIfError(cacheControl, response)) {
      let stale = setHeaders(lastResponse, {
        [EDGE_CACHE_STATUS]: CACHE_STATUS.STALE,
      });

      waitUntil(put(requestKey, stale));

      return stale;
    }
  }

  let headers: WWSWRHeader = {
    [CACHE_CONTROL]: clientCacheControl(cacheControl),
    [ORIGIN_CACHE_CONTROL]: response.headers.get(CACHE_CONTROL) || '',
    [EDGE_CACHE_EXPIRED_AT]: cacheExpireAt(cacheControl),
    [EDGE_CACHE_STATUS]: CACHE_STATUS.MISS,
  };

  if (response.status < 500 && cacheControl['s-maxage']) {
    // status is considered as status and cache is enabled
    // we will update the cache w/out blocking the request
    waitUntil(
      put(
        requestKey,
        setHeaders(response, {
          ...headers,
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [CACHE_CONTROL]: edgeCacheControl(cacheControl),
          'set-cookie': null,
        }),
      ),
    );
  }

  return setHeaders(response, headers);
}
