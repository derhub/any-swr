import { WWSWRCacheControl, WWSWRHeader, WWSWRResponse } from './types';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  SWR_CACHE_EXPIRED_AT,
  SWR_CACHE_STATUS,
} from './values';

/**
 * Returns a new response with the headers applied
 * It will delete the header from response if the value is falsely
 */
export function setHeaders(res: WWSWRResponse, headers: WWSWRHeader) {
  let nextRes = res.clone();

  for (let headersKey in headers) {
    let headerValue = headers[headersKey];

    if (!headerValue) {
      nextRes.headers.delete(headersKey);
    } else {
      nextRes.headers.set(headersKey, String(headerValue));
    }
  }

  return nextRes;
}

/**
 * The cache should be revalidated when expired
 */
export function shouldRevalidateCache(res: WWSWRResponse) {
  let cacheStatus = res.headers.get(SWR_CACHE_STATUS);
  if (cacheStatus === CACHE_STATUS.REVALIDATED) return false;

  let cacheExpAt = res.headers.get(SWR_CACHE_EXPIRED_AT);
  if (!cacheExpAt) {
    return true;
  }

  return Date.now() > Number(cacheExpAt);
}

export function parseCacheControl(response: WWSWRResponse): WWSWRCacheControl {
  let result: WWSWRCacheControl = {
    public: undefined,
    private: undefined,
    's-maxage': undefined,
    'max-age': undefined,
    'stale-while-revalidate': undefined,
    'stale-if-error': undefined,
  };

  let strValue = response.headers.get(CACHE_CONTROL);
  if (!strValue) {
    return result;
  }

  return strValue
    .replace(/\s+/g, '')
    .split(',')
    .reduce((prev, cur) => {
      let [key, val] = cur.split('=');

      key = key.toLowerCase();
      if (key in prev) {
        prev[key] = val === undefined ? null : val;
      }

      return prev;
    }, result);
}

export function shouldStaleIfError(
  cacheControl: WWSWRCacheControl,
  response: WWSWRResponse,
) {
  let staleErr = cacheControl['stale-if-error'];

  // it's in header but no value
  if (staleErr === null) {
    return true;
  }

  let cacheAt = response.headers.get(SWR_CACHE_EXPIRED_AT);

  return Date.now() > Number(cacheAt);
}

export function clientCacheControl(cacheControl: WWSWRCacheControl) {
  if (!cacheControl['max-age']) {
    return 'private, no-store'; // prevent from caching
  }

  // let value: string[] = ['public'];

  // value.push(createCacheControlContent('max-age', cacheControl, 0));
  // value.push(createCacheControlContent('s-maxage', cacheControl, 0));
  // value.push(createCacheControlContent('stale-while-revalidate', cacheControl));
  // value.push(createCacheControlContent('stale-if-error', cacheControl));

  return 'public,' + createCacheControlContent('max-age', cacheControl, 0);
}

export function createCacheControlContent(
  key: keyof WWSWRCacheControl,
  cacheControl: WWSWRCacheControl,
  defaultValue?: string | number | null,
) {
  let value = cacheControl[key] ?? defaultValue;
  return key + `${value ? '=' + value : ''}`;
}

export function cacheExpireAt(cacheControl: WWSWRCacheControl): string {
  let maxAge = Number(cacheControl['s-maxage'] || 0);
  return String(Date.now() + maxAge * 1000);
}

export function edgeCacheControl(cacheControl: WWSWRCacheControl): string {
  return 'public,' + createCacheControlContent('s-maxage', cacheControl, 0);
}
