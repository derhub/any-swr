export const EDGE_CACHE_STATUS = 'x-edge-cache-status';
export const EDGE_CACHE_EXPIRED_AT = 'x-edge-cache-expired-at';

export const EDGE_CACHE_STALE_EXPIRE_AT = 'x-edge-cache-stale-expired-at';
export const EDGE_CACHE_STALE_ERR_EXPIRE_AT = 'x-edge-cache-stale-err-expired-at';

export const ORIGIN_CACHE_CONTROL = 'x-origin-cache-control';
export const ORIGIN_ERROR_CACHE_CONTROL = 'x-origin-error-cache-control';
export const CLIENT_CACHE_CONTROL = 'x-client-cache-control';
export const CACHE_CONTROL = 'cache-control';

export const STALE_FOREVER = '-1';

// list of tags to hide when debug options is false
export const HIDDEN_HEADER_TAGS = {
  [CLIENT_CACHE_CONTROL]: null,
  [EDGE_CACHE_EXPIRED_AT]: null,
  [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: null,
  [EDGE_CACHE_STALE_EXPIRE_AT]: null,
  [ORIGIN_CACHE_CONTROL]: null,
  [ORIGIN_ERROR_CACHE_CONTROL]: null,
};

export enum CACHE_STATUS {
  /**
   * used response is cached
   */
  HIT = 'HIT',
  /**
   * used when content is not cache
   */
  MISS = 'MISS',
  /**
   * used when stale-if-error is present in header and failed to revalidate response
   */
  STALE = 'STALE',
  /**
   * used when stale-while-revalidate is present in header and revalidating response
   */
  REVALIDATED = 'REVALIDATED',
}
