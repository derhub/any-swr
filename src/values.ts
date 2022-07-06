export const SWR_CACHE_STATUS = 'x-swr-status';
export const SWR_CACHE_EXPIRED_AT = 'x-swr-cache-expired-at';
export const ORIGIN_CACHE_CONTROL = 'x-origin-cache-control';
export const CACHE_CONTROL = 'cache-control';

export enum CACHE_STATUS {
  // NONE = 'NONE',
  HIT = 'HIT',
  MISS = 'MISS',
  /**
   * Stale if error is present in header and failed to revalidate the content
   * then we will return stale content until the valid time
   */
  STALE = 'STALE',
  /**
   * Return stale response
   */
  REVALIDATED = 'REVALIDATED',
  UPDATING = 'UPDATING',
}
