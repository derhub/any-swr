import { edgeSWR } from './edge-swr';
import { WWSWROption, WWSWRResponseCache } from './types';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STATUS,
} from './values';

describe('edgeSWR', () => {
  let request = new Request('http://localhost', {
    method: 'GET',
  });
  it('should set cache-control header correctly', async () => {
    let response = new Response('', {
      status: 200,
      headers: {
        'cache-control': 'public,max-age=60,s-maxage=60,stale-while-revalidate',
      },
    });

    let { returnResponse, cacheResponse } = await expectToCache(
      request,
      response,
      null,
    );

    expect(returnResponse.headers.get(CACHE_CONTROL)).toEqual(
      'public,max-age=60',
    );

    expect(cacheResponse?.headers?.get(CACHE_CONTROL)).toEqual(
      'public,s-maxage=60',
    );

    let response2 = new Response('', {
      status: 200,
      headers: {
        'cache-control': 'public,s-maxage=60,stale-while-revalidate',
      },
    });

    let { returnResponse: returnResponse2 } = await expectToCache(
      request,
      response2,
      null,
    );

    expect(returnResponse2.headers.get(CACHE_CONTROL)).toEqual(
      'public,max-age=0,must-revalidate',
    );
  });

  describe('s-maxage=60, stale-while-revalidate', () => {
    it('should cache', async () => {
      let response = new Response('', {
        status: 200,
        headers: {
          'cache-control': 's-maxage=60, stale-while-revalidate',
        },
      });

      let { returnResponse, cacheResponse } = await expectToCache(
        request,
        response,
        null,
      );

      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.MISS,
      );
    });

    it('should revalidate when cache expires', async () => {
      let response = new Response('fresh', {
        status: 200,
        headers: {
          'cache-control': 's-maxage=60, stale-while-revalidate',
        },
      });

      let responseMatch = new Response('stale', {
        status: 200,
        headers: {
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [EDGE_CACHE_EXPIRED_AT]: String(Date.now() - 20 * 1000),
        },
      });

      let { returnResponse, cacheResponse } = await expectToStaleCache(
        request,
        response,
        responseMatch,
      );

      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );
      expect(cacheResponse?.headers?.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.HIT,
      );

      expect(await returnResponse.text()).toEqual('stale');
      expect(await cacheResponse?.text()).toEqual('fresh');
    });

    it('should return cache w/out revalidating', async () => {
      let response = new Response('cache', {
        status: 200,
        headers: {
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [EDGE_CACHE_EXPIRED_AT]: String(Date.now() + 20 * 1000),
        },
      });

      await expectToJustReturnCache(request, response);
    });

    it('should only cache GET request', async () => {
      await expectToNotCache(
        new Request('http://localhost', {
          method: 'POST',
        }),
        new Response('', {
          status: 200,
          headers: {
            'cache-control': 's-maxage=60, stale-while-revalidate',
          },
        }),
      );
    });

    it('should not cache >500 error response', async () => {
      await expectToNotCache(
        request,
        new Response('', {
          status: 500,
          headers: {
            'cache-control': 's-maxage=60, stale-while-revalidate',
          },
        }),
      );

      await expectToNotCache(
        request,
        new Response('', {
          status: 500,
          headers: {
            'cache-control': 's-maxage=60, stale-while-revalidate',
          },
        }),
        new Response('', {
          status: 200,
          headers: {
            'cache-control': 's-maxage=60, stale-while-revalidate',
          },
        }),
      );
    });
  });

  describe('s-maxage=1, stale-while-revalidate=100', () => {
    it('TODO implement stale-while-revalidate with expiration', () => {});
  });
  describe('s-maxage=60, stale-if-error', () => {
    it('should stale response', async () => {
      let responseError = new Response('', {
        status: 500,
        headers: {
          [CACHE_CONTROL]: 's-maxage=60, stale-if-error',
        },
      });

      let responseMatch = new Response('', {
        status: 200,
        headers: {
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [EDGE_CACHE_EXPIRED_AT]: String(Date.now() - 20 * 1000),
        },
      });
      let { returnResponse, cacheHistory } = await expectToStaleCache(
        request,
        responseError,
        responseMatch,
      );

      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );

      expect(cacheHistory[0].headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );

      expect(cacheHistory[1].headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.STALE,
      );
    });
  });

  describe('s-maxage=1, stale-if-error=100', () => {
    it('TODO implement stale-if-error with expiration', () => {});
  });
});

async function expectToCache(
  request: Request,
  handlerResponse: Response,
  matchResponse: WWSWRResponseCache,
) {
  let cacheResponse: Response | undefined = undefined;
  let options: WWSWROption = {
    request,
    cacheKey: (request) => {
      return new Request(request.url, { method: request.method });
    },
    match: jest.fn((request) => Promise.resolve(matchResponse)),
    handler: jest.fn(() => Promise.resolve(handlerResponse)),
    waitUntil: jest.fn(async (promise) => {
      await promise;
    }),
    put: jest.fn((_, res) => {
      cacheResponse = res;
      return Promise.resolve();
    }),
  };

  let swrRes = await edgeSWR(options);
  await flushWaitUntil();

  expect(options.match).toBeCalled();
  expect(options.waitUntil).toBeCalled();
  expect(options.handler).toBeCalled();
  expect(options.put).toBeCalled();

  let res = cacheResponse as Response | undefined;

  expect(res?.headers?.get(EDGE_CACHE_STATUS)).toEqual(CACHE_STATUS.HIT);

  return {
    returnResponse: swrRes,
    cacheResponse: res,
  };
}

async function expectToStaleCache(
  request: Request,
  handlerResponse: Response,
  matchResponse: Response,
) {
  let cacheHistory: Response[] = [];
  let options: WWSWROption = {
    request,
    cacheKey: (request) => {
      return new Request(request.url, { method: request.method });
    },
    match: jest.fn((request) => Promise.resolve(matchResponse)),
    handler: jest.fn(() => Promise.resolve(handlerResponse)),
    waitUntil: jest.fn(async (promise) => {
      await promise;
    }),
    put: jest.fn((cacheKey, content) => {
      cacheHistory.push(content);
      return Promise.resolve();
    }),
  };

  let swrRes = await edgeSWR(options);
  await flushWaitUntil();

  expect(options.match).toBeCalled();
  expect(options.waitUntil).toBeCalled();
  expect(options.handler).toBeCalled();
  expect(options.put).toBeCalled();

  expect(cacheHistory[0].headers.get(EDGE_CACHE_STATUS)).toEqual(
    CACHE_STATUS.REVALIDATED,
  );

  return {
    cacheResponse: cacheHistory[cacheHistory.length - 1],
    returnResponse: swrRes,
    cacheHistory,
  };
}

async function expectToJustReturnCache(
  request: Request,
  matchResponse: Response,
) {
  let options: WWSWROption = {
    request,
    cacheKey: (request) => {
      return new Request(request.url, { method: request.method });
    },
    match: jest.fn((request) => Promise.resolve(matchResponse)),
    handler: jest.fn(),
    waitUntil: jest.fn(async (promise) => {
      await promise;
    }),
    put: jest.fn((cacheKey, content) => {
      return Promise.resolve();
    }),
  };

  let swrRes = await edgeSWR(options);

  expect(options.handler).not.toBeCalled();
  expect(options.put).not.toBeCalled();
  expect(options.match).toBeCalled();

  expect(swrRes.headers.get(EDGE_CACHE_STATUS)).toEqual(
    matchResponse.headers.get(EDGE_CACHE_STATUS),
  );
  expect(await swrRes.text()).toEqual(await matchResponse.text());
}

async function expectToNotCache(
  request: Request,
  response: Response,
  matchResponse?: WWSWRResponseCache,
) {
  let lastResponse: Response | undefined = undefined;
  let options: WWSWROption = {
    request,
    cacheKey: (request) => {
      return new Request(request.url, { method: request.method });
    },
    match: jest.fn((request) => Promise.resolve(matchResponse)),
    handler: jest.fn(() => Promise.resolve(response)),
    waitUntil: jest.fn(async (promise) => {
      await promise;
    }),
    put: jest.fn((cacheKey, content) => {
      lastResponse = content;
      return Promise.resolve();
    }),
  };

  let swrRes = await edgeSWR(options);
  await flushWaitUntil();

  if (!matchResponse) {
    expect(options.put).not.toBeCalled();
    expect(options.waitUntil).not.toBeCalled();
  }

  expect(options.handler).toBeCalled();

  return {
    returnResponse: swrRes,
    cacheResponse: lastResponse as Response | undefined,
  };
}

let scheduler = typeof setImmediate === 'function' ? setImmediate : setTimeout;

function flushWaitUntil() {
  return new Promise(function (resolve) {
    scheduler(resolve);
  });
}
