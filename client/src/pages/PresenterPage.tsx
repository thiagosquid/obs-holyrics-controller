import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useStageView } from '../hooks/useStageView';
import { ConnectionBadge } from '../components/ConnectionBadge';
import type { PresenterSessionInfo } from '../types';

function previewSrc(preview?: string | null) {
  if (!preview) return undefined;
  return preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`;
}

export default function PresenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl || localStorage.getItem('hwc_presenter_token') || '');
  const [inputToken, setInputToken] = useState(token);
  const [sessionInfo, setSessionInfo] = useState<PresenterSessionInfo | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [gotoValue, setGotoValue] = useState('');
  const [pending, setPending] = useState<'next' | 'previous' | null>(null);
  const [pendingError, setPendingError] = useState('');
  const pendingTimer = useRef<number | undefined>(undefined);
  const pendingStartSlide = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const errorTimer = useRef<number | undefined>(undefined);
  const { connected, state, sendCommand, commandResult } = useSocket({ token });
  const stageView = useStageView(token);

  const data = state?.data;
  const currentSlide = data?.slides?.find((s) => s.number === data?.slide_number);
  const nextSlide = data?.slides?.find((s) => s.number === (data?.slide_number ?? 0) + 1);
  const text = currentSlide?.text || currentSlide?.reference || data?.name || '(nenhum conteúdo)';

  useEffect(() => {
    if (!token) return;
    fetch(`/api/presenter/session?token=${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.status === 'ok') {
          setSessionInfo(res.session);
          setSessionError('');
          localStorage.setItem('hwc_presenter_token', token);
        } else {
          setSessionError(res.error || 'Sessão inválida');
          setSessionInfo(null);
          localStorage.removeItem('hwc_presenter_token');
        }
      });
  }, [token]);

  const connect = () => {
    setSearchParams({ token: inputToken });
    setToken(inputToken);
  };

  const hasPerm = (p: string) => sessionInfo?.permissions?.includes('expanded') || sessionInfo?.permissions?.includes(p);

  const clearPending = useCallback(() => {
    if (pendingTimer.current) {
      window.clearTimeout(pendingTimer.current);
      pendingTimer.current = undefined;
    }
    pendingRef.current = false;
    setPending(null);
  }, []);

  const showPendingError = useCallback((message: string) => {
    setPendingError(message);
    if (errorTimer.current) window.clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => {
      setPendingError('');
      errorTimer.current = undefined;
    }, 3000);
  }, []);

  const handleNav = (type: 'next' | 'previous') => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPendingError('');
    setPending(type);
    pendingStartSlide.current = data?.slide_number ?? null;
    sendCommand(type);
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => {
      pendingRef.current = false;
      setPending(null);
      pendingTimer.current = undefined;
    }, 3000);
  };

  useEffect(() => {
    if (!pending) return;
    if (!data || data.slide_number !== pendingStartSlide.current) {
      clearPending();
    }
  }, [data?.slide_number, data?.id, pending, clearPending]);

  useEffect(() => {
    if (!commandResult || !pending) return;
    if (!commandResult.success) {
      showPendingError(commandResult.error || 'Falha ao executar o comando');
      clearPending();
    } else {
      const timer = window.setTimeout(() => clearPending(), 500);
      return () => window.clearTimeout(timer);
    }
  }, [commandResult, pending, clearPending, showPendingError]);

  useEffect(() => {
    return () => {
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
      if (errorTimer.current) window.clearTimeout(errorTimer.current);
    };
  }, []);

  if (!token || sessionError) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-lg w-full max-w-sm">
          <h1 className="text-xl font-bold mb-4">Acesso do Palestrante</h1>
          {sessionError && <div className="text-red-400 text-sm mb-2">{sessionError}</div>}
          <input
            type="text"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="Token da sessão"
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-3"
          />
          <button
            onClick={connect}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2 rounded"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const navButtonClass =
    'absolute top-1/2 -translate-y-1/2 w-12 h-16 sm:w-16 sm:h-20 flex items-center justify-center bg-black/60 disabled:bg-black/20 disabled:text-slate-600 hover:bg-black/80 active:bg-black/90 text-white font-bold text-4xl rounded-lg transition';

  return (
    <div className="h-screen h-[100dvh] bg-slate-900 text-slate-100 p-2 sm:p-3 flex flex-col gap-2 overflow-hidden">
      <header className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-base sm:text-lg font-bold">Palestrante</h1>
        <ConnectionBadge connected={connected} holyricsConnected={state?.connected ?? false} />
      </header>

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex-1 flex gap-2 min-h-0">
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-0">
          {stageView.src ? (
            <img
              src={stageView.src}
              alt="Slide atual"
              className="w-full h-full object-contain"
            />
          ) : currentSlide?.preview ? (
            <img
              src={previewSrc(currentSlide.preview)}
              alt="Slide atual"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-4 text-center text-xl sm:text-2xl leading-relaxed whitespace-pre-wrap">
              {text}
            </div>
          )}

          <button
            aria-label="Retroceder"
            disabled={!hasPerm('previous') || pending !== null}
            onClick={() => handleNav('previous')}
            className={`${navButtonClass} left-2`}
          >
            {pending === 'previous' ? (
              <span className="inline-block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '‹'
            )}
          </button>

          <button
            aria-label="Avançar"
            disabled={!hasPerm('next') || pending !== null}
            onClick={() => handleNav('next')}
            className={`${navButtonClass} right-2`}
          >
            {pending === 'next' ? (
              <span className="inline-block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '›'
            )}
          </button>

          {data && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
              {data.slide_number} / {data.total_slides}
            </div>
          )}

          {pending && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/75 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {pending === 'next' ? 'Avançando...' : 'Voltando...'}
            </div>
          )}

          {!pending && pendingError && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-700/90 text-white text-sm px-3 py-1.5 rounded-full">
              {pendingError}
            </div>
          )}

          </div>

          {nextSlide?.preview && (
            <div className="hidden sm:flex flex-col w-[38%] max-w-[720px] min-w-[160px] bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-300 px-3 py-1.5 bg-slate-900/60">
                Próximo
              </div>
              <div className="flex-1 bg-black flex items-center justify-center min-h-0 p-1">
                <img
                  src={previewSrc(nextSlide.preview)}
                  alt="Próximo slide"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {nextSlide?.preview && (
          <div className="sm:hidden flex flex-col h-[22vh] max-h-[180px] min-h-[100px] flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
            <div className="text-[10px] uppercase tracking-wide text-slate-300 px-2 py-0.5 bg-slate-900/60 text-center">
              Próximo
            </div>
            <div className="flex-1 bg-black flex items-center justify-center min-h-0 p-1">
              <img
                src={previewSrc(nextSlide.preview)}
                alt="Próximo slide"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {hasPerm('goto') && data && (
          <div className="bg-slate-800 rounded-lg p-1.5 flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-400 flex-shrink-0">Ir para o slide</span>
            <input
              type="number"
              min={1}
              max={data.total_slides}
              value={gotoValue}
              onChange={(e) => setGotoValue(e.target.value)}
              className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm"
            />
            <button
              onClick={() => {
                const n = parseInt(gotoValue, 10);
                if (!isNaN(n) && n >= 1) {
                  sendCommand('gotoIndex', { index: n - 1 });
                  setGotoValue('');
                }
              }}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded text-sm"
            >
              Ir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
