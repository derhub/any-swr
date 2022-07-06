import { edgeCacheControl, parseCacheControl } from './functions';
import { CACHE_CONTROL } from './values';

test('parseCacheControl', () => {
  let result = parseCacheControl(
    new Response('', {
      headers: {
        [CACHE_CONTROL]:
          'public,max-age=1,s-maxage=1,stale-while-revalidate=1,stale-if-error=1',
      },
    }),
  );

  expect(result).toMatchInlineSnapshot(`
    Object {
      "max-age": "1",
      "private": undefined,
      "public": null,
      "s-maxage": "1",
      "stale-if-error": "1",
      "stale-while-revalidate": "1",
    }
  `);

  result = parseCacheControl(
    new Response('', {
      headers: {
        [CACHE_CONTROL]:
          'public,max-age=1,s-maxage=1,stale-while-revalidate,stale-if-error',
      },
    }),
  );

  expect(result).toMatchInlineSnapshot(`
    Object {
      "max-age": "1",
      "private": undefined,
      "public": null,
      "s-maxage": "1",
      "stale-if-error": null,
      "stale-while-revalidate": null,
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
  ).toMatchInlineSnapshot(`"public,s-maxage=1"`);
});
