import { useEffect, useState } from 'react';
import { useStageView } from '../hooks/useStageView';
import { useSocket } from '../hooks/useSocket';
import { DockHeader } from '../components/DockHeader';
import type { BibleBook, BibleVersion } from '../types';

export default function BibleDock() {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [version, setVersion] = useState('');
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookId, setBookId] = useState('');
  const [chapter, setChapter] = useState('1');
  const [verse, setVerse] = useState('1');
  const [verseEnd, setVerseEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const stageView = useStageView();
  const { connected, state } = useSocket({});

  const loadBooks = async (language: string) => {
    if (!language) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bible/books?language=${encodeURIComponent(language)}`);
      const json = await res.json();
      if (json.status === 'ok') {
        const list: BibleBook[] = json.books || [];
        setBooks(list);
        if (list.length > 0) setBookId(String(list[0].id));
      } else {
        setBooks([]);
        setMessage(json.error || 'Erro ao carregar livros.');
      }
    } catch {
      setBooks([]);
      setMessage('Servidor indisponível.');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bible/versions');
      const json = await res.json();
      if (json.status !== 'ok') {
        setMessage(json.error || 'Erro ao carregar versões.');
        return;
      }
      const list: BibleVersion[] = json.versions || [];
      setVersions(list);
      const defaultKey = json.defaultVersion || list[0]?.key || '';
      setVersion(defaultKey);
      const selected = list.find((v) => v.key === defaultKey);
      const language =
        selected?.language?.iso || selected?.language?.id || String(defaultKey).split('_')[0];
      if (language) await loadBooks(language);
    } catch {
      setMessage('Servidor indisponível.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeVersion = (key: string) => {
    setVersion(key);
    const selected = versions.find((v) => v.key === key);
    const language = selected?.language?.iso || selected?.language?.id || key.split('_')[0];
    if (language) loadBooks(language);
  };

  const buildReference = () => {
    const book = books.find((b) => String(b.id) === bookId);
    const chapterNumber = parseInt(chapter, 10);
    const verseNumber = parseInt(verse, 10);
    if (!book || !chapterNumber || !verseNumber) return '';
    const end = parseInt(verseEnd, 10);
    const range = end && end >= verseNumber ? `-${end}` : '';
    return `${book.name} ${chapterNumber}:${verseNumber}${range}`;
  };

  const showVerse = async () => {
    const references = buildReference();
    if (!references) {
      setMessage('Selecione livro, capítulo e versículo.');
      return;
    }
    setBusy(true);
    setMessage('Abrindo versículo...');
    try {
      const res = await fetch('/api/bible/show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references,
          version: version || undefined,
          quick: true,
        }),
      });
      const json = await res.json();
      setMessage(
        json.status === 'ok'
          ? `${references} aberto em modo rápido. O PPT continua por baixo.`
          : json.error || 'Erro ao abrir versículo.'
      );
    } catch {
      setMessage('Servidor indisponível.');
    } finally {
      setBusy(false);
    }
  };

  const closeQuick = async () => {
    setBusy(true);
    setMessage('Fechando versículo rápido...');
    try {
      const res = await fetch('/api/bible/quick/close', { method: 'POST' });
      const json = await res.json();
      setMessage(
        json.status === 'ok'
          ? 'Versículo fechado. A apresentação anterior voltou.'
          : json.error || 'Nenhum versículo rápido ativo.'
      );
    } catch {
      setMessage('Servidor indisponível.');
    } finally {
      setBusy(false);
    }
  };

  const navigate = async (direction: 'next' | 'previous') => {
    setBusy(true);
    setMessage(direction === 'next' ? 'Próximo versículo...' : 'Versículo anterior...');
    try {
      const res = await fetch(`/api/bible/${direction}`, { method: 'POST' });
      const json = await res.json();
      setMessage(
        json.status === 'ok'
          ? direction === 'next'
            ? 'Avançou um versículo.'
            : 'Voltou um versículo.'
          : json.error || 'Nenhum versículo rápido ativo.'
      );
    } catch {
      setMessage('Servidor indisponível.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100';
  const labelClass = 'block text-[11px] uppercase tracking-wide text-slate-400 mb-1';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 flex flex-col gap-3">
      <DockHeader
        icon="📖"
        title="Bíblia"
        subtitle="Versículo rápido"
        accent="bg-amber-600"
        connected={connected}
        holyricsConnected={state?.connected ?? false}
        version={__APP_VERSION__}
      />

      <div className="relative bg-black rounded-lg overflow-hidden border border-slate-700 aspect-video max-h-44 flex items-center justify-center">
        {stageView.src ? (
          <img
            src={stageView.src}
            alt="Prévia atual"
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-slate-500">Prévia indisponível</span>
        )}
      </div>
      <div className="text-[10px] text-slate-500 -mt-2">Prévia atual</div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => navigate('previous')}
          disabled={busy}
          className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2 rounded text-sm"
        >
          ⏮ Anterior
        </button>
        <button
          onClick={() => navigate('next')}
          disabled={busy}
          className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2 rounded text-sm"
        >
          Próximo ⏭
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className={labelClass}>Versão</label>
          <select
            className={inputClass}
            value={version}
            onChange={(e) => changeVersion(e.target.value)}
            disabled={loading || versions.length === 0}
          >
            {versions.map((v) => (
              <option key={v.key} value={v.key}>
                {v.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Livro</label>
          <select
            className={inputClass}
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            disabled={loading || books.length === 0}
          >
            {books.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Capítulo</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Versículo</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={verse}
              onChange={(e) => setVerse(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Até (opcional)</label>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={verseEnd}
              onChange={(e) => setVerseEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Referência:{' '}
          <span className="text-slate-200">{buildReference() || '—'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mt-auto">
        <button
          onClick={showVerse}
          disabled={busy || loading}
          className="bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold py-2.5 rounded"
        >
          Exibir versículo
        </button>
        <button
          onClick={closeQuick}
          disabled={busy}
          className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold py-2 rounded"
        >
          Fechar versículo rápido
        </button>
      </div>

      <div className="min-h-[2.5rem] text-xs text-slate-300">
        {message}
      </div>
    </div>
  );
}
