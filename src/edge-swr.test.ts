import { edgeSWR } from './edge-swr';
import { expireAt } from './functions';
import { WWSWROption, SWRResponseCache } from './types';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STALE_ERR_EXPIRE_AT,
  EDGE_CACHE_STALE_EXPIRE_AT,
  EDGE_CACHE_STATUS,
  HIDDEN_HEADER_TAGS,
  ORIGIN_ERROR_CACHE_CONTROL,
  STALE_FOREVER,
} from './values';

describe('edgeSWR', () => {
  let request = new Request('http://localhost', {
    method: 'GET',
  });

  it('should hide edge tags when debug is disabled', async () => {
    let response = new Response('', {
      status: 200,
      headers: {
        'cache-control': 's-maxage=60, stale-while-revalidate',
      },
    });

    let { cacheHistory } = await createSWRTest(
      request,
      response,
      null,
    );

    let { returnResponse } = await createSWRTest(
      request,
      response,
      cacheHistory.pop(),
      {debug: false}
    );

    for (let key in HIDDEN_HEADER_TAGS) {
      expect(returnResponse.headers.has(key)).toEqual(false);
    }
  });
  it('should set cache-control header correctly', async () => {
    let response = new Response('', {
      status: 200,
      headers: {
        'cache-control':
          'public, max-age=1, s-maxage=60, stale-while-revalidate, stale-if-error',
      },
    });

    let { returnResponse, cacheResponse: edgeCache } = await expectToCache(
      request,
      response,
      null,
    );

    expect(returnResponse.headers.get(CACHE_CONTROL)).toEqual(
      'public, max-age=1',
    );

    expect(edgeCache?.headers?.get(CACHE_CONTROL)).toEqual(
      'public, max-age=31536000',
    );

    expect(edgeCache?.headers?.get(ORIGIN_ERROR_CACHE_CONTROL)).toEqual(
      'public, max-age=31536000',
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

    it('should revalidate while stale when cache expires', async () => {
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
          [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
          [EDGE_CACHE_STALE_EXPIRE_AT]: STALE_FOREVER,
        },
      });

      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        response,
        responseMatch,
      );

      expect(cacheHistory.shift()?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );
      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );
      expect(await returnResponse.text()).toEqual('stale');
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
    it('should set header', async () => {
      jest.useFakeTimers().setSystemTime(Date.now());
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('fresh', {
          status: 200,
          headers: {
            [CACHE_CONTROL]: 's-maxage=1, stale-while-revalidate=100',
          },
        }),
      );

      let lastUpdate = cacheHistory.pop();

      expect(lastUpdate?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.HIT,
      );
      expect(lastUpdate?.headers.get(EDGE_CACHE_STALE_EXPIRE_AT)).toEqual(
        expireAt(100),
      );
      expect(lastUpdate?.headers.get(EDGE_CACHE_STALE_ERR_EXPIRE_AT)).toEqual(
        expireAt(undefined),
      );
    });
    it('should stale until expired', async () => {
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('fresh', {
          status: 200,
          headers: {
            [CACHE_CONTROL]: 's-maxage=1, stale-while-revalidate=100',
          },
        }),
        new Response('stale', {
          status: 200,
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
            [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
            [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(100),
          },
        }),
      );

      expect(await returnResponse.text()).toEqual('stale');
      expect(cacheHistory.shift()?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );
      expect(cacheHistory.shift()?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.HIT,
      );
      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.REVALIDATED,
      );
    });

    it('miss when stale is expired', async () => {
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('fresh', {
          status: 200,
          headers: {
            [CACHE_CONTROL]: 's-maxage=1, stale-while-revalidate=100',
          },
        }),
        new Response('stale', {
          status: 200,
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
            [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
            [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(-100),
          },
        }),
      );

      expect(await returnResponse.text()).toEqual('fresh');
      expect(cacheHistory.shift()?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.HIT,
      );
      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.MISS,
      );
    });
  });

  describe('s-maxage=60, stale-if-error', () => {
    it('should set headers', async () => {
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('', {
          status: 200,
          headers: {
            [CACHE_CONTROL]: 's-maxage=60, stale-if-error',
          },
        }),
      );

      let lastResponse = cacheHistory.pop();
      expect(lastResponse?.headers.get(EDGE_CACHE_STALE_ERR_EXPIRE_AT)).toEqual(
        STALE_FOREVER,
      );
      expect(lastResponse?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.HIT,
      );
      expect(returnResponse?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.MISS,
      );
    });

    it('should stale forever', async () => {
      let { returnResponse: res2, cacheHistory: cacheHistory2 } =
        await createSWRTest(
          request,
          new Response('fresh', {
            status: 500,
            headers: {
              [CACHE_CONTROL]: 's-maxage=60, stale-while-revalidate',
            },
          }),
          new Response('stale', {
            headers: {
              [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
              [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: STALE_FOREVER,
              [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(-100), // expired stale
              [EDGE_CACHE_EXPIRED_AT]: expireAt(-100), // expired max age
            },
          }),
        );

      let lastResponse = cacheHistory2.pop();
      expect(lastResponse?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.STALE,
      );
      expect(await res2.text()).toEqual('stale');
    });
    it('should stale response', async () => {
      let responseError = new Response('fresh', {
        status: 500,
        headers: {
          [CACHE_CONTROL]: 's-maxage=60, stale-if-error',
        },
      });

      let responseMatch = new Response('stale', {
        status: 200,
        headers: {
          [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
          [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: STALE_FOREVER,
        },
      });
      let { returnResponse, cacheHistory, options } = await createSWRTest(
        request,
        responseError,
        responseMatch,
      );

      expect(cacheHistory.shift()?.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.STALE,
      );

      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.STALE,
      );

      expect(await returnResponse.text()).toEqual('stale');
    });
  });

  describe('s-maxage=1, stale-if-error=100', () => {
    it('should set headers', async () => {
      jest.useFakeTimers().setSystemTime(Date.now());
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('', {
          status: 200,
          headers: {
            [CACHE_CONTROL]: 's-maxage=60, stale-if-error=100',
          },
        }),
      );

      let lastResponse = cacheHistory.pop();
      expect(lastResponse?.headers.get(EDGE_CACHE_STALE_ERR_EXPIRE_AT)).toEqual(
        expireAt(100),
      );
    });

    it('miss when stale error is expired', async () => {
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('fresh', {
          status: 500,
          headers: {
            [CACHE_CONTROL]: 's-maxage=60, stale-if-error=100',
          },
        }),
        new Response('stale', {
          status: 200,
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.STALE,
            [EDGE_CACHE_EXPIRED_AT]: expireAt(-60),
            [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(100),
            [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: expireAt(-100),
          },
        }),
      );

      expect(await returnResponse.text()).toEqual('fresh');
      expect(returnResponse.headers.get(EDGE_CACHE_STATUS)).toEqual(
        CACHE_STATUS.MISS,
      );
    });

    it('should stale until expired', async () => {
      let { returnResponse, cacheHistory } = await createSWRTest(
        request,
        new Response('fresh', {
          status: 500,
          headers: {
            [CACHE_CONTROL]: 's-maxage=60, stale-if-error=100',
          },
        }),
        // cache response is stale, expired cache, expired stale cache, and not expire stale if error
        new Response('stale', {
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.STALE,
            [EDGE_CACHE_STALE_ERR_EXPIRE_AT]: expireAt(100),
            [EDGE_CACHE_STALE_EXPIRE_AT]: expireAt(-100),
            [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
          },
        }),
      );

      expect(await returnResponse.text()).toEqual('stale');
      expect(cacheHistory.length).toEqual(0);
    });
  });
});

async function expectToCache(
  request: Request,
  handlerResponse: Response,
  matchResponse: SWRResponseCache,
  overrideOptions: Partial<WWSWROption> = {}
) {
  let cacheResponse: Response | undefined = undefined;
  let options: WWSWROption = {
    request: () => {
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
    ...overrideOptions,
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

async function createSWRTest(
  request: Request,
  handlerResponse: Response,
  matchResponse?: SWRResponseCache,
  overrideOptions?: Partial<WWSWROption>
) {
  let promises: Promise<any>[] = [];
  let cacheHistory: Response[] = [];
  let options: WWSWROption = {
    debug: true,
    request: () => {
      return new Request(request.url, { method: request.method });
    },
    match: jest.fn((request) => Promise.resolve(matchResponse)),
    handler: jest.fn(() => Promise.resolve(handlerResponse)),
    waitUntil: jest.fn((promise) => {
      promises.push(promise);
    }),
    put: jest.fn((cacheKey, content) => {
      cacheHistory.push(content);
      return Promise.resolve();
    }),
    ...(overrideOptions ?? {})
  };

  let swrRes = await edgeSWR(options);
  await Promise.all(promises);
  await flushWaitUntil();

  return {
    options,
    returnResponse: swrRes,
    cacheHistory,
  };
}

async function expectToStaleCache(
  request: Request,
  handlerResponse: Response,
  matchResponse: Response,
) {
  let {
    options,
    cacheHistory,
    returnResponse: swrRes,
  } = await createSWRTest(request, handlerResponse, matchResponse);

  expect(options.match).toBeCalled();
  expect(options.waitUntil).toBeCalled();
  expect(options.handler).toBeCalled();
  expect(options.put).toBeCalled();

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
  let {
    options,
    cacheHistory,
    returnResponse: swrRes,
  } = await createSWRTest(request, new Response('fresh'), matchResponse);

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
  matchResponse?: SWRResponseCache,
) {
  let {
    options,
    cacheHistory,
    returnResponse: swrRes,
  } = await createSWRTest(request, response, matchResponse);

  if (!matchResponse) {
    expect(options.put).not.toBeCalled();
    expect(options.waitUntil).not.toBeCalled();
  }

  expect(options.handler).toBeCalled();

  return {
    returnResponse: swrRes,
    cacheResponse: cacheHistory[0],
  };
}

let scheduler = typeof setImmediate === 'function' ? setImmediate : setTimeout;

function flushWaitUntil() {
  return new Promise(function (resolve) {
    scheduler(resolve);
  });
}
