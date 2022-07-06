import {
  edgeCacheControl,
  expireAt,
  parseCacheControl,
  setHeaders,
  shouldRevalidateCache,
} from './functions';
import {
  CACHE_CONTROL,
  CACHE_STATUS,
  EDGE_CACHE_EXPIRED_AT,
  EDGE_CACHE_STATUS,
} from './values';

describe('functions', () => {
  test('parseCacheControl', () => {
    expect(
      parseCacheControl(
        new Response('', {
          headers: {
            [CACHE_CONTROL]:
              'public,max-age=1,s-maxage=1,stale-while-revalidate=1,stale-if-error=1',
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
          Object {
            "max-age": "1",
            "private": undefined,
            "public": null,
            "s-maxage": "1",
            "stale-if-error": "1",
            "stale-while-revalidate": "1",
          }
      `);

    expect(
      parseCacheControl(
        new Response('', {
          headers: {
            [CACHE_CONTROL]:
              'public,max-age=1,s-maxage=1,stale-while-revalidate,stale-if-error',
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
          Object {
            "max-age": "1",
            "private": undefined,
            "public": null,
            "s-maxage": "1",
            "stale-if-error": null,
            "stale-while-revalidate": null,
          }
      `);

    expect(parseCacheControl(new Response(''))).toMatchInlineSnapshot(`
          Object {
            "max-age": undefined,
            "private": undefined,
            "public": undefined,
            "s-maxage": undefined,
            "stale-if-error": undefined,
            "stale-while-revalidate": undefined,
          }
      `);
  });

  test('edgeCacheControl', () => {
    expect(
      edgeCacheControl({
        'max-age': '1',
        private: undefined,
        public: null,
        's-maxage': '1',
        'stale-if-error': '1',
        'stale-while-revalidate': '1',
      }),
    ).toMatchInlineSnapshot(`"public, max-age=2"`);
  });

  test('setHeaders', () => {
    let result = setHeaders(
      new Response('', {
        headers: {
          'cache-control': 'public,max-age=1',
          'this-should-removed': '12345',
        },
      }),

      {
        'this-should-removed': null,
      },
    );
    expect(Object.fromEntries(result.headers.entries())).toMatchInlineSnapshot(`
          Object {
            "cache-control": "public,max-age=1",
            "content-type": "text/plain;charset=UTF-8",
          }
      `);
  });

  test('shouldRevalidateCache', () => {
    expect(
      shouldRevalidateCache(
        new Response('', {
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.REVALIDATED,
          },
        }),
      ),
    ).toEqual(false);

    expect(
      shouldRevalidateCache(
        new Response('', {
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
            [EDGE_CACHE_EXPIRED_AT]: expireAt(100),
          },
        }),
      ),
    ).toEqual(false);

    expect(
      shouldRevalidateCache(
        new Response('', {
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
            [EDGE_CACHE_EXPIRED_AT]: expireAt(-100),
          },
        }),
      ),
    ).toEqual(true);

    expect(
      shouldRevalidateCache(
        new Response('', {
          headers: {
            [EDGE_CACHE_STATUS]: CACHE_STATUS.HIT,
          },
        }),
      ),
    ).toEqual(true);
  });
});
