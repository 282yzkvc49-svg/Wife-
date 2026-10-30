import { useEffect, useState } from 'react';

export interface Route { path: string[]; query: URLSearchParams; raw: string }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q] = raw.split('?');
  return { path: (p || '').split('/').filter(Boolean), query: new URLSearchParams(q || ''), raw };
}

export function useRoute(): Route {
  const [r, setR] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => { setR(parseHash(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string) {
  const h = path.startsWith('#') ? path : '#/' + path.replace(/^\//, '');
  if (location.hash !== h) location.hash = h;
}
