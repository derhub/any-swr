export type WWSWRCacheControl = {
  public?: null;
  private?: null;
  's-maxage'?: number | string | null;
  'max-age'?: number | string | null;
  'stale-while-revalidate'?: number | string | null;
  'stale-if-error'?: number | string | null;
};

export type WWSWRHeader = Record<string, number | string | null | undefined>;
export type WWSWRCacheKey = Request;
export type WWSWRResponse = Response;
export type WebWorkerSwrRequest = Request;
export type WWSWRResponseCache = Response | undefined | null;

export type WWSWROption = {
  debug?: boolean;
  request: WebWorkerSwrRequest;
  // return cache key, this is where you can normalize request. ex: strip headers, url, etc...
  cacheKey: (request: WebWorkerSwrRequest) => WWSWRCacheKey;
  // function for getting response
  handler: () => Promise<WWSWRResponse>;
  // get cache content
  match: (cacheKey: WWSWRCacheKey) => Promise<WWSWRResponse | undefined | null>;
  // store cache content
  put: (cacheKey: WWSWRCacheKey, content: WWSWRResponse) => Promise<void>;
  // update w/out blocking
  waitUntil: (promise: Promise<any>) => void;
};
