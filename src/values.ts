export const EDGE_CACHE_STATUS = 'x-edge-cache-status';
export const EDGE_CACHE_EXPIRED_AT = 'x-edge-cache-expired-at';
export const ORIGIN_CACHE_CONTROL = 'x-origin-cache-control';
export const CACHE_CONTROL = 'cache-control';

export enum CACHE_STATUS {
  HIT = 'HIT',
  MISS = 'MISS',
  /**
   * used when stale-if-error is present in header and failed to revalidate the content
   * then we will return stale content until the valid time
   */
  STALE = 'STALE',
  /**
   * Return stale response
   */
  REVALIDATED = 'REVALIDATED',
}
