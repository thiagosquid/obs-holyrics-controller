import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { DockHeader } from '../components/DockHeader';
import type { LyricsPlaylistItem } from '../types';

export default function LyricsDock() {
  const { connected, state, sendCommand, commandResult } = useSocket({});
  const [feedback, setFeedback] = useState('');
  const [playlist, setPlaylist] = useState<LyricsPlaylistItem[]>([]);
  const [playlistError, setPlaylistError] = useState('');
  const [playlistOpen, setPlaylistOpen] = useState(true);

  const data = state?.data;
  const currentSlide = data?.slides?.find((s) => s.number === data?.slide_number);
  const text = currentSlide?.text || currentSlide?.reference || data?.name || '(nenhum conteúdo)';

  const loadPlaylist = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists/lyrics');
      const json = await res.json();
      if (json.status === 'ok') {
        setPlaylist(json.items || []);
        setPlaylistError('');
      } else {
        setPlaylistError(json.error || 'Erro ao carregar playlist');
      }
    } catch {
      setPlaylistError('Servidor indisponível');
    }
  }, []);

  useEffect(() => {
    loadPlaylist();
    const timer = setInterval(loadPlaylist, 10000);
    return () => clearInterval(timer);
  }, [loadPlaylist]);

  useEffect(() => {
    if (!commandResult) return;
    setFeedback(commandResult.success ? 'Comando executado' : `Falha: ${commandResult.error || 'erro'}`);
    const timer = setTimeout(() => setFeedback(''), 2500);
    return () => clearTimeout(timer);
  }, [commandResult]);

  const buttonClass =
    'flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold py-3 px-2 rounded transition';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 flex flex-col gap-3">
      <DockHeader
        icon="🎤"
        title="Letras"
        subtitle="Playlist de letras"
        accent="bg-emerald-600"
        connected={connected}
        holyricsConnected={state?.connected ?? false}
        version={__APP_VERSION__}
      />

      <div className="bg-slate-800 rounded">
        <button
          type="button"
          onClick={() => setPlaylistOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-slate-300"
        >
          <span>Playlist de letras ({playlist.length})</span>
          <span>{playlistOpen ? '▲' : '▼'}</span>
        </button>
        {playlistOpen && (
          <div className="px-2 pb-2 max-h-48 overflow-auto space-y-1">
            {playlistError && <div className="text-xs text-red-400 px-1">{playlistError}</div>}
            {playlist.length === 0 && !playlistError && (
              <div className="text-xs text-slate-500 px-1">Playlist vazia.</div>
            )}
            {playlist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 bg-slate-900 rounded px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.title || '(sem título)'}</div>
                  <div className="text-xs text-slate-500 truncate">{item.artist || ''}</div>
                </div>
                <button
                  onClick={() => sendCommand('showLyrics', { id: item.id })}
                  className="flex-shrink-0 bg-green-700 hover:bg-green-600 px-2 py-1 rounded text-xs"
                >
                  Exibir
                </button>
              </div>
            ))}
            <button
              onClick={loadPlaylist}
              className="w-full text-xs text-slate-400 hover:text-slate-200 py-1"
            >
              Atualizar playlist
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 bg-slate-800 rounded p-3 overflow-auto">
        <div className="text-xs text-slate-400 mb-1">
          {data ? `${data.name || data.type} • ${data.slide_number}/${data.total_slides}` : '—'}
        </div>
        <div className="text-lg leading-relaxed whitespace-pre-wrap">{text}</div>
      </div>

      <div className="h-5 text-xs text-center">
        {feedback && (
          <span className={feedback.startsWith('Falha') ? 'text-red-400' : 'text-green-400'}>{feedback}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 rounded"
          onClick={() => sendCommand('toggleF9')}
        >
          Tela vazia
        </button>
        <button
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-2 rounded"
          onClick={() => sendCommand('toggleF10')}
        >
          Tela preta
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button className={buttonClass} onClick={() => sendCommand('previous')}>
          ⏮ Anterior
        </button>
        <button className={buttonClass} onClick={() => sendCommand('close')}>
          ✕ Fechar
        </button>
        <button className={buttonClass} onClick={() => sendCommand('next')}>
          Próximo ⏭
        </button>
      </div>
    </div>
  );
}
