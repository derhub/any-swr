import {
  cacheExpireAt,
  clientCacheControl,
  edgeCacheControl,
  expireAt,
  isStaleExpired,
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
  CLIENT_CACHE_CONTROL,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STALE_ERR_EXPIRE_AT,
  EDGE_CACHE_STALE_EXPIRE_AT,
  EDGE_CACHE_STATUS,
  HIDDEN_HEADER_TAGS,
  ORIGIN_CACHE_CONTROL,
  ORIGIN_ERROR_CACHE_CONTROL,
} from './values';

export async function edgeSWR(options: WWSWROption) {
  let {
    request,
    cacheKey,
    match,
    put,
    waitUntil,
    handler,
    debug = false,
  } = options;
  if (request.method !== 'GET') {
    return handler();
  }

  let requestKey = cacheKey(request);
  let lastResponse = await match(requestKey);

  // no cache or stale content is expired
  if (!lastResponse) {
    return execHandler(options, requestKey);
  }

  let status = lastResponse.headers.get(EDGE_CACHE_STATUS) || CACHE_STATUS.MISS;

  // handle expired stale-if-error
  if (status === CACHE_STATUS.STALE && isStaleExpired(lastResponse, 'error')) {
    return execHandler(options, requestKey, lastResponse);
  }

  if (shouldRevalidateCache(lastResponse)) {
    // handle expired stale-while-revalidate
    if (
      status === CACHE_STATUS.HIT &&
      isStaleExpired(lastResponse, 'success')
    ) {
      return execHandler(options, requestKey, lastResponse);
    }

    // this will keep content stale until success or stale is not expired
    if (status !== CACHE_STATUS.STALE) {
      status = CACHE_STATUS.REVALIDATED;

      await put(
        requestKey,
        setHeaders(lastResponse, {
          [EDGE_CACHE_STATUS]: CACHE_STATUS.REVALIDATED,
        }),
      );
    }

    waitUntil(execHandler(options, requestKey, lastResponse));
  }

  let headers = {
    [EDGE_CACHE_STATUS]: status,
    [CACHE_CONTROL]: lastResponse.headers.get(CLIENT_CACHE_CONTROL),
  };

  if (!debug) {
    // hide all custom header tags
    headers = { ...headers, ...HIDDEN_HEADER_TAGS };
  }

  return setHeaders(lastResponse, headers);
}

async function execHandler(
  options: WWSWROption,
  requestKey: WWSWRCacheKey,
  lastResponse?: WWSWRResponseCache,
) {
  let { handler, request, put, waitUntil, debug = false } = options;

  let response = await handler();
  let cacheControl = parseCacheControl(response);

  // example: https://datatracker.ietf.org/doc/html/rfc5861#section-4.1
  if (
    response.status >= 500 &&
    lastResponse &&
    !isStaleExpired(lastResponse, 'error')
  ) {
    // update: revalidated -> stale
    // override response to use cache if stale-if-error is in origin cache control
    if (shouldStaleIfError(lastResponse)) {
      let status = lastResponse.headers.get(EDGE_CACHE_STATUS);
      let staleResponse = setHeaders(lastResponse, {
        [EDGE_CACHE_STATUS]: CACHE_STATUS.STALE,
        [CACHE_CONTROL]: lastResponse.headers.get(ORIGIN_ERROR_CACHE_CONTROL),
      });

      if (status !== CACHE_STATUS.STALE) {
        waitUntil(put(requestKey, staleResponse));
      }

      return setHeaders(staleResponse, debug ? HIDDEN_HEADER_TAGS : {});
    }
  }

  let headers: WWSWRHeader = {
    [ORIGIN_CACHE_CONTROL]: edgeCacheControl(cacheControl, 'success'),
    [ORIGIN_ERROR_CACHE_CONTROL]: edgeCacheControl(cacheControl, 'error'),
    [CLIENT_CACHE_CONTROL]: clientCacheControl(cacheControl),

    [EDGE_CACHE_EXPIRED_AT]: cacheExpireAt(cacheControl),

    [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: expireAt(cacheControl['stale-if-error']),
    [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(
      cacheControl['stale-while-revalidate'],
    ),
  };

  if (response.status < 500 && cacheControl['s-maxage']) {
    // status is considered as success and edge cache is enabled
    // we will update the cache w/out blocking the request
    waitUntil(
      put(
        requestKey,
        setHeaders(response, {
          ...headers,
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [CACHE_CONTROL]: headers[ORIGIN_CACHE_CONTROL],
          'set-cookie': null,
        }),
      ),
    );
  }

  return setHeaders(response, {
    ...headers,
    [EDGE_CACHE_STATUS]: CACHE_STATUS.MISS,
    [CACHE_CONTROL]: headers[CLIENT_CACHE_CONTROL],
    ...(debug ? HIDDEN_HEADER_TAGS : {}),
  });
}
