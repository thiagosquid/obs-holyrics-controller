import { useEffect, useRef, useState } from 'react';

interface StageViewState {
  src?: string;
  available: boolean;
  error?: string;
}

export function useStageView(token?: string): StageViewState {
  const [src, setSrc] = useState<string>();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string>();
  const etagRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let currentUrl: string | undefined;

    const poll = async () => {
      if (cancelled) return;
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      let nextDelay = 500;

      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers['If-None-Match'] = etagRef.current;
        const response = await fetch(`/api/stage-view/frame${query}`, { headers });

        if (response.status === 204) {
          // Stage view indisponível: não é erro e não adianta consultar rápido.
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
            currentUrl = undefined;
          }
          etagRef.current = '';
          setSrc(undefined);
          setAvailable(false);
          setError(undefined);
          nextDelay = 10000;
        } else if (response.status === 304) {
          setAvailable(true);
          setError(undefined);
        } else if (response.ok) {
          const etag = response.headers.get('ETag') || '';
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          currentUrl = objectUrl;
          etagRef.current = etag;
          setSrc(objectUrl);
          setAvailable(true);
          setError(undefined);
        } else {
          setAvailable(false);
          setError(`HTTP ${response.status}`);
          nextDelay = 10000;
        }
      } catch {
        setAvailable(false);
        setError('Servidor indisponível');
        nextDelay = 5000;
      }

      if (!cancelled) timer = window.setTimeout(poll, nextDelay);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [token]);

  return { src, available, error };
}
