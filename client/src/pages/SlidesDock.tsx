import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useStageView } from '../hooks/useStageView';
import { DockHeader } from '../components/DockHeader';
import type { MediaPlaylistItem } from '../types';

const TYPE_LABEL: Record<string, string> = {
  song: 'Música',
  verse: 'Versículo',
  text: 'Texto',
  audio: 'Áudio',
  video: 'Vídeo',
  image: 'Imagem',
  file: 'Arquivo',
  announcement: 'Anúncio',
  automatic_presentation: 'Apresentação automática',
  countdown: 'Contagem regressiva',
  uri: 'URL',
};

export default function SlidesDock() {
  const { connected, state, sendCommand, commandResult } = useSocket({});
  const stageView = useStageView();
  const [gotoValue, setGotoValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [playlist, setPlaylist] = useState<MediaPlaylistItem[]>([]);
  const [playlistError, setPlaylistError] = useState('');
  const [playlistOpen, setPlaylistOpen] = useState(true);
  const data = state?.data;

  useEffect(() => {
    if (!commandResult) return;
    setFeedback(commandResult.success ? 'Comando executado' : `Falha: ${commandResult.error || 'erro'}`);
    const timer = setTimeout(() => setFeedback(''), 2500);
    return () => clearTimeout(timer);
  }, [commandResult]);

  const loadPlaylist = useCallback(async () => {
    try {
      const res = await fetch('/api/playlists/media');
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

  const currentSlide = data?.slides?.find((s) => s.number === data?.slide_number);
  const prevSlide = data?.slides?.find((s) => s.number === (data?.slide_number ?? 0) - 1);
  const nextSlide = data?.slides?.find((s) => s.number === (data?.slide_number ?? 0) + 1);

  const previewUrl = (preview?: string | null) => {
    if (!preview) return undefined;
    return preview.startsWith('data:') ? preview : `data:image/jpeg;base64,${preview}`;
  };

  const buttonClass =
    'flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white font-semibold py-2 px-1 rounded text-xs transition';

  const handleGoto = () => {
    const idx = parseInt(gotoValue, 10);
    if (!isNaN(idx) && data) {
      sendCommand('gotoIndex', { index: idx - 1 });
      setGotoValue('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 flex flex-col gap-3">
      <DockHeader
        icon="🖼️"
        title="Slides"
        subtitle="Playlist de mídia"
        accent="bg-sky-600"
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
          <span>Playlist de mídia ({playlist.length})</span>
          <span>{playlistOpen ? '▲' : '▼'}</span>
        </button>
        {playlistOpen && (
          <div className="px-2 pb-2 max-h-40 overflow-auto space-y-1">
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
                  <div className="text-sm font-medium truncate">{item.name || '(sem nome)'}</div>
                  <div className="text-xs text-slate-500">{TYPE_LABEL[item.type] || item.type}</div>
                </div>
                <button
                  onClick={() => sendCommand('showMedia', { id: item.id })}
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
            <p className="text-[10px] leading-tight text-slate-500 px-1">
              Arquivos externos (PPT/ODP) podem abrir em outro programa e não ser controláveis pela API.
            </p>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400">
        {data ? `${data.name || data.type} • ${data.slide_number}/${data.total_slides}` : '—'}
      </div>

      <div className="flex-1 bg-slate-800 rounded p-2 flex flex-col items-center justify-center gap-2">
        {stageView.src ? (
          <img
            src={stageView.src}
            alt="Prévia do Holyrics"
            className="max-w-full max-h-48 rounded border border-slate-600"
          />
        ) : currentSlide?.preview ? (
          <img
            src={previewUrl(currentSlide.preview)}
            alt="Slide atual"
            className="max-w-full max-h-48 rounded border border-slate-600"
          />
        ) : (
          <div className="text-slate-400 text-sm">Sem prévia disponível</div>
        )}

        <div className="text-[10px] text-slate-500">
          {stageView.src
            ? 'Prévia do Holyrics (stage view, 1280x720)'
            : stageView.error
              ? `Stage view: ${stageView.error}`
              : 'Prévia da API do Holyrics'}
        </div>

        <div className="flex gap-2 w-full justify-center">
          {prevSlide?.preview && (
            <img
              src={previewUrl(prevSlide.preview)}
              alt="Anterior"
              className="h-16 rounded border border-slate-600 opacity-70"
            />
          )}
          {nextSlide?.preview && (
            <img
              src={previewUrl(nextSlide.preview)}
              alt="Próximo"
              className="h-16 rounded border border-slate-600 opacity-70"
            />
          )}
        </div>
      </div>

      <div className="h-4 text-xs text-center">
        {feedback && (
          <span className={feedback.startsWith('Falha') ? 'text-red-400' : 'text-green-400'}>{feedback}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded"
          onClick={() => sendCommand('toggleF9')}
        >
          Tela vazia
        </button>
        <button
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded"
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

      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={gotoValue}
          onChange={(e) => setGotoValue(e.target.value)}
          placeholder="Ir para slide"
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
        />
        <button className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded text-sm" onClick={handleGoto}>
          Ir
        </button>
      </div>
    </div>
  );
}
