import { HeadersFunction } from '@remix-run/cloudflare';

export const headers: HeadersFunction = () => {
  return {
    'Cache-Control': 'public, s-maxage=1, stale-while-revalidate',
  };
};

export const loader = async () => {
  await (new Promise<number>((resolve) => {

    setTimeout(() => {
      resolve(0)
    }, 500);

  }))
  return {test: 1}
}
export default function Index() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.4' }}>
      <h1>Welcome to Remix</h1>
      <ul>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/blog"
            rel="noreferrer"
          >
            15m Quickstart Blog Tutorial
          </a>
        </li>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/jokes"
            rel="noreferrer"
          >
            Deep Dive Jokes App Tutorial
          </a>
        </li>
        <li>
          <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
            Remix Docs
          </a>
        </li>
      </ul>
    </div>
  );
}
