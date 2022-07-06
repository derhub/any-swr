import { WWSWRCacheControl, WWSWRHeader, WWSWRResponse } from './types';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STALE_ERR_EXPIRE_AT,
  EDGE_CACHE_STALE_EXPIRE_AT,
  EDGE_CACHE_STATUS,
  STALE_FOREVER,
} from './values';

/**
 * Returns a new response with the headers applied
 * It will delete the header from response if the value is falsely
 */
export function setHeaders(res: WWSWRResponse, headers: WWSWRHeader) {
  let nextRes = res.clone();

  for (let headersKey in headers) {
    let headerValue = headers[headersKey];

    if (headerValue === undefined || headerValue === null) {
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
  let cacheStatus = res.headers.get(EDGE_CACHE_STATUS);
  if (cacheStatus === CACHE_STATUS.REVALIDATED) return false;

  let cacheExpAt = res.headers.get(EDGE_CACHE_EXPIRED_AT);
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

export function shouldStaleIfError(response: WWSWRResponse) {
  let cacheAt = response.headers.get(EDGE_CACHE_EXPIRED_AT) || 0;

  return Date.now() > Number(cacheAt);
}

export function clientCacheControl(cacheControl: WWSWRCacheControl) {
  if (!cacheControl['max-age']) {
    return 'public,max-age=0,must-revalidate'; // prevent client caching
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
  let maxAge =
    cacheControl['s-maxage'] === undefined
      ? cacheControl['max-age']
      : cacheControl['s-maxage'];
  return expireAt(maxAge, '0');
}

/**
 * It returns A string that is the current time plus the expiration time in seconds
 * if the expiration is null it will return foreverValue
 * if the expiration is undefined it will return 0
 */
export function expireAt(
  expiration: unknown,
  nullValue: string = STALE_FOREVER,
): string {
  if (expiration === undefined) return '0';
  if (expiration === null) return nullValue;

  return String(Date.now() + Number(expiration) * 1000);
}

export function edgeCacheControl(cacheControl: WWSWRCacheControl): string {
  return 'public,' + createCacheControlContent('s-maxage', cacheControl, 0);
}

export function isStaleExpired(
  res: Response,
  type: 'error' | 'success' = 'success',
) {
  let cacheAt =
    res.headers.get(
      type === 'success'
        ? EDGE_CACHE_STALE_EXPIRE_AT
        : EDGE_CACHE_STALE_ERR_EXPIRE_AT,
    ) || 0;

  if (cacheAt === STALE_FOREVER) {
    return false;
  }

  return Date.now() > Number(cacheAt);
}
