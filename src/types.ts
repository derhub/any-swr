export type SWRCacheControl = {
  public?: null | undefined;
  private?: null | undefined;
  's-maxage'?: number | string | null;
  'max-age'?: number | string | null;
  'stale-while-revalidate'?: number | string | null;
  'stale-if-error'?: number | string | null;
};

export type SWRHeader = Record<string, number | string | null | undefined>;
export type SWRRequest = Request;
export type SWRResponse = Response;
export type SWRResponseCache = Response | undefined | null;

export type WWSWROption = {
  debug?: boolean;
  // force disable caching
  disable?: boolean;
  // return cache key, this is where you can normalize request. ex: strip headers, url, etc...
  request: () => SWRRequest;
  // function for getting response
  handler: () => Promise<SWRResponse>;
  // get cache content
  match: (request: SWRRequest) => Promise<SWRResponse | undefined | null>;
  // store cache content
  put: (request: SWRRequest, content: SWRResponse) => Promise<void>;
  // update w/out blocking
  waitUntil: (promise: Promise<any>) => void;
};
