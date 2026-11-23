import { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { useSocket } from '../hooks/useSocket';
import { ConnectionBadge } from '../components/ConnectionBadge';
import type {
  AppSettings,
  BibleBook,
  BibleVersion,
  CompatibilityFeature,
  ConnectedClient,
  PresenterSession,
  ServerInfo,
  ServerStatus,
} from '../types';

const PERMISSIONS = [
  { key: 'view', label: 'Visualizar' },
  { key: 'next', label: 'Avançar' },
  { key: 'previous', label: 'Retroceder' },
  { key: 'goto', label: 'Ir para slide' },
  { key: 'expanded', label: 'Controle ampliado' },
];

const CLIENT_TYPE_LABEL: Record<ConnectedClient['type'], string> = {
  admin: 'Administrador',
  dock: 'Dock OBS',
  presenter: 'Palestrante',
};

const COMPAT_STATUS: Record<
  CompatibilityFeature['status'],
  { label: string; className: string }
> = {
  available: { label: 'Disponível', className: 'bg-green-800' },
  unavailable: { label: 'Indisponível', className: 'bg-red-800' },
  unverified: { label: 'Não verificado', className: 'bg-yellow-800' },
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [password, setPassword] = useState(localStorage.getItem('hwc_admin_password') || '');
  const [inputPassword, setInputPassword] = useState(password);
  const [loggedIn, setLoggedIn] = useState(false);

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [stageViewStatus, setStageViewStatus] = useState<{
    enabled: boolean;
    available: boolean;
    error?: string;
    lastUpdate?: string;
  } | null>(null);
  const [sessions, setSessions] = useState<PresenterSession[]>([]);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityFeature[]>([]);
  const [compatibilityVersion, setCompatibilityVersion] = useState<string | null>(null);
  const [compatOpen, setCompatOpen] = useState(false);

  const [settingsForm, setSettingsForm] = useState<AppSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const [newSessionName, setNewSessionName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['view', 'next', 'previous']);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [qrLink, setQrLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [libraryTab, setLibraryTab] = useState<'songs' | 'verse' | 'texts'>('songs');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryResults, setLibraryResults] = useState<
    Array<{ id: string; title: string; artist?: string; folder?: string }>
  >([]);
  const [libraryMessage, setLibraryMessage] = useState('');

  const [bibleVersions, setBibleVersions] = useState<BibleVersion[]>([]);
  const [bibleVersion, setBibleVersion] = useState('');
  const [bibleBooks, setBibleBooks] = useState<BibleBook[]>([]);
  const [bibleBookId, setBibleBookId] = useState('');
  const [bibleChapter, setBibleChapter] = useState('1');
  const [bibleVerse, setBibleVerse] = useState('1');
  const [bibleVerseEnd, setBibleVerseEnd] = useState('');
  const [bibleLoading, setBibleLoading] = useState(false);
  const [verseQuick, setVerseQuick] = useState(true);
  const [quickMessage, setQuickMessage] = useState('');

  const { connected, state, sendCommand } = useSocket({ adminPassword: password });

  const api = async (path: string, method = 'GET', body?: unknown) => {
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const presenterBase = serverInfo
    ? `http://${serverInfo.lanIp}:${serverInfo.port}`
    : window.location.origin;

  const presenterUrl = (token: string) => `${presenterBase}/presenter?token=${token}`;

  const compatAvailable = compatibility.filter((f) => f.status === 'available').length;
  const compatUnverified = compatibility.filter((f) => f.status === 'unverified').length;
  const compatUnavailable = compatibility.filter((f) => f.status === 'unavailable').length;

  const refresh = async () => {
    const [s, sess, c, l, compat, stage] = await Promise.all([
      api('/status'),
      api('/admin/sessions'),
      api('/admin/clients'),
      api('/admin/logs'),
      api('/admin/compatibility'),
      api('/admin/stage-view/status'),
    ]);
    setStatus(s);
    setSessions(sess.sessions || []);
    setClients(c.clients || []);
    setLogs(l.logs || []);
    if (compat.status === 'ok') {
      setCompatibility(compat.features || []);
      setCompatibilityVersion(compat.version);
    }
    if (stage.status === 'ok') setStageViewStatus(stage);
  };

  const loadSettings = async () => {
    const res = await api('/admin/settings');
    if (res.status === 'ok') setSettingsForm(res.settings);
  };

  useEffect(() => {
    if (!loggedIn) return;
    fetch('/api/server-info')
      .then((r) => r.json())
      .then((res) => {
        if (res.status === 'ok') setServerInfo({ lanIp: res.lanIp, port: res.port });
      })
      .catch(() => {});
    loadSettings();
    loadBibleVersions();
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: inputPassword }),
    });
    if (res.ok) {
      setPassword(inputPassword);
      localStorage.setItem('hwc_admin_password', inputPassword);
      setLoggedIn(true);
    } else {
      alert('Senha inválida');
    }
  };

  const saveSettings = async () => {
    if (!settingsForm) return;
    setSettingsMessage('Salvando...');
    const res = await api('/admin/settings', 'POST', settingsForm);
    if (res.status === 'ok') {
      setSettingsMessage(
        res.restartRequired
          ? 'Configurações salvas. A porta do servidor só muda após reiniciar o controller.'
          : 'Configurações salvas.'
      );
      const updated = await api('/admin/settings');
      if (updated.status === 'ok') setSettingsForm(updated.settings);
      refresh();
    } else {
      setSettingsMessage('Erro ao salvar configurações.');
    }
  };

  const testConnection = async () => {
    const res = await api('/admin/test-connection', 'POST');
    setTestResult(res);
    refresh();
  };

  const createSession = async () => {
    const res = await api('/admin/sessions', 'POST', {
      name: newSessionName || 'Palestrante',
      permissions: selectedPerms,
    });
    if (res.status === 'ok') {
      setNewSessionName('');
      await refresh();
      openQr(res.session);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revogar esta sessão? O palestrante será desconectado.')) return;
    await api(`/admin/sessions/${id}/revoke`, 'POST');
    refresh();
  };

  const toggleBlock = async (session: PresenterSession) => {
    const action = session.blocked ? 'unblock' : 'block';
    await api(`/admin/sessions/${session.id}/${action}`, 'POST');
    refresh();
  };

  const startEditPerms = (session: PresenterSession) => {
    setEditingSession(session.id);
    setEditPerms([...session.permissions]);
  };

  const savePerms = async (id: string) => {
    await api(`/admin/sessions/${id}/permissions`, 'POST', { permissions: editPerms });
    setEditingSession(null);
    refresh();
  };

  const openQr = async (session: PresenterSession) => {
    const link = presenterUrl(session.token);
    const dataUrl = await QRCode.toDataURL(link, {
      width: 512,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
    setQrLink(link);
    setQrImage(dataUrl);
    setCopied(false);
    setQrOpen(true);
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(link);
    }
  };

  const exportLog = async (type: 'server' | 'error') => {
    const res = await fetch(`/api/admin/logs/export/${type}`, {
      headers: { 'X-Admin-Password': password },
    });
    if (!res.ok) {
      alert('Arquivo de log não encontrado.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const searchLibrary = async () => {
    if (libraryTab === 'verse') return;
    setLibraryMessage('Buscando...');
    const res = await api(
      `/admin/library/${libraryTab}?q=${encodeURIComponent(libraryQuery.trim())}`
    );
    if (res.status === 'ok') {
      setLibraryResults(res.items || []);
      setLibraryMessage(res.items?.length ? '' : 'Nada encontrado.');
    } else {
      setLibraryResults([]);
      setLibraryMessage(res.error || 'Erro na busca.');
    }
  };

  const showSong = async (id: string) => {
    setLibraryMessage('Iniciando música...');
    const res = await api('/admin/show/lyrics', 'POST', { id });
    setLibraryMessage(res.status === 'ok' ? 'Música iniciada.' : res.error || 'Erro ao iniciar.');
    refresh();
  };

  const showTextItem = async (id: string) => {
    setLibraryMessage('Iniciando texto...');
    const res = await api('/admin/show/text', 'POST', { id });
    setLibraryMessage(res.status === 'ok' ? 'Texto iniciado.' : res.error || 'Erro ao iniciar.');
    refresh();
  };

  const loadBibleBooks = async (language: string) => {
    setBibleLoading(true);
    const res = await api(`/admin/bible/books?language=${encodeURIComponent(language)}`);
    if (res.status === 'ok') {
      const books: BibleBook[] = res.books || [];
      setBibleBooks(books);
      if (books.length > 0) setBibleBookId(String(books[0].id));
    } else {
      setBibleBooks([]);
      setLibraryMessage(res.error || 'Erro ao carregar livros.');
    }
    setBibleLoading(false);
  };

  const loadBibleVersions = async () => {
    const res = await api('/admin/bible/versions');
    if (res.status !== 'ok') {
      setLibraryMessage(res.error || 'Erro ao carregar versões da Bíblia.');
      return;
    }
    const versions: BibleVersion[] = res.versions || [];
    setBibleVersions(versions);
    const defaultKey = res.defaultVersion || versions[0]?.key || '';
    setBibleVersion(defaultKey);
    const selected = versions.find((v) => v.key === defaultKey);
    const language =
      selected?.language?.iso || selected?.language?.id || String(defaultKey).split('_')[0];
    if (language) loadBibleBooks(language);
  };

  const changeBibleVersion = (key: string) => {
    setBibleVersion(key);
    const selected = bibleVersions.find((v) => v.key === key);
    const language = selected?.language?.iso || selected?.language?.id || key.split('_')[0];
    if (language) loadBibleBooks(language);
  };

  const buildBibleReference = () => {
    const book = bibleBooks.find((b) => String(b.id) === bibleBookId);
    const chapter = parseInt(bibleChapter, 10);
    const verse = parseInt(bibleVerse, 10);
    if (!book || !chapter || !verse) return '';
    const end = parseInt(bibleVerseEnd, 10);
    const range = end && end >= verse ? `-${end}` : '';
    return `${book.name} ${chapter}:${verse}${range}`;
  };

  const showVerse = async () => {
    const references = buildBibleReference();
    if (!references) {
      setLibraryMessage('Selecione livro, capítulo e versículo.');
      return;
    }
    setLibraryMessage('Iniciando versículo...');
    const res = await api('/admin/show/verse', 'POST', {
      references,
      version: bibleVersion || undefined,
      quick: verseQuick,
    });
    setLibraryMessage(
      res.status === 'ok'
        ? verseQuick
          ? `Versículo rápido iniciado: ${references}. Use "Fechar apresentação rápida" para voltar.`
          : `Versículo iniciado: ${references}`
        : res.error || 'Erro ao iniciar.'
    );
    refresh();
  };

  const closeQuick = async () => {
    setQuickMessage('Fechando apresentação rápida...');
    const res = await api('/admin/quick/close', 'POST');
    setQuickMessage(
      res.status === 'ok'
        ? 'Apresentação rápida fechada. A apresentação anterior foi retomada.'
        : res.error || 'Nenhuma apresentação rápida ativa.'
    );
    refresh();
    setTimeout(() => setQuickMessage(''), 4000);
  };

  const updateSettingsField = <K extends keyof AppSettings>(
    section: K,
    field: string,
    value: unknown
  ) => {
    setSettingsForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      };
    });
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-lg w-full max-w-sm">
          <h1 className="text-xl font-bold mb-4">Painel Administrativo</h1>
          <input
            type="password"
            value={inputPassword}
            onChange={(e) => setInputPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="Senha administrativa"
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 mb-3"
          />
          <button
            onClick={login}
            className="w-full bg-blue-700 hover:bg-blue-600 text-white font-semibold py-2 rounded"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  const inputClass = 'w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm';
  const labelClass = 'block text-xs text-slate-400 mb-1';
  const cardClass = 'bg-slate-800 p-4 rounded-lg space-y-3';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 sm:p-4 space-y-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Administração</h1>
          {status?.server?.version && (
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">
              OHC v{status.server.version}
            </span>
          )}
        </div>
        <ConnectionBadge connected={connected} holyricsConnected={state?.connected ?? false} />
      </header>

      <section className={cardClass}>
        <h2 className="font-semibold">Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>Controller: {status?.server?.online ? 'online' : 'offline'}</div>
          <div>Holyrics: {status?.holyrics?.connected ? 'conectado' : 'desconectado'}</div>
          <div>Versão: {status?.holyrics?.version || '—'}</div>
          <div>Atualizado: {status?.lastUpdate ? formatTime(status.lastUpdate) : '—'}</div>
        </div>
        <div className="text-sm text-slate-300">
          Apresentação:{' '}
          {status?.presentation
            ? `${status.presentation.name || status.presentation.type} (${status.presentation.slide_number}/${status.presentation.total_slides})`
            : 'nenhuma'}
        </div>
        <div className="text-sm text-slate-300">
          Stage view:{' '}
          {stageViewStatus
            ? stageViewStatus.available
              ? 'disponível'
              : stageViewStatus.enabled
                ? `indisponível${stageViewStatus.error ? ` (${stageViewStatus.error})` : ''}`
                : 'desativado'
            : '—'}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => sendCommand('previous')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm">Anterior</button>
          <button onClick={() => sendCommand('next')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm">Próximo</button>
          <button onClick={() => sendCommand('close')} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm">Fechar</button>
          <button onClick={closeQuick} className="bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded text-sm">Fechar apresentação rápida</button>
          <button onClick={testConnection} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded text-sm">Testar conexão</button>
        </div>
        {quickMessage && <p className="text-xs text-slate-300">{quickMessage}</p>}
        {testResult && (
          <pre className="text-xs bg-slate-900 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Iniciar apresentação</h2>
        <div className="flex flex-wrap gap-2">
          {([
            ['songs', 'Músicas'],
            ['verse', 'Versículo'],
            ['texts', 'Textos'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setLibraryTab(key);
                setLibraryResults([]);
                setLibraryMessage('');
              }}
              className={`px-3 py-1.5 rounded text-sm ${libraryTab === key ? 'bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {libraryTab === 'verse' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className={labelClass}>Versão</label>
                <select
                  className={inputClass}
                  value={bibleVersion}
                  onChange={(e) => changeBibleVersion(e.target.value)}
                >
                  {bibleVersions.map((v) => (
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
                  value={bibleBookId}
                  onChange={(e) => setBibleBookId(e.target.value)}
                >
                  {bibleBooks.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Capítulo</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={bibleChapter}
                  onChange={(e) => setBibleChapter(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Versículo</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={bibleVerse}
                  onChange={(e) => setBibleVerse(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="w-full sm:w-44">
                <label className={labelClass}>Até o versículo (opcional)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={bibleVerseEnd}
                  onChange={(e) => setBibleVerseEnd(e.target.value)}
                />
              </div>
              <button
                onClick={showVerse}
                className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm whitespace-nowrap"
              >
                Exibir versículo
              </button>
              <div className="text-xs text-slate-400 sm:ml-2">
                Referência: <span className="text-slate-200">{buildBibleReference() || '—'}</span>
                {bibleLoading ? ' (carregando livros...)' : ''}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={verseQuick}
                onChange={(e) => setVerseQuick(e.target.checked)}
              />
              Abrir como apresentação rápida (mantém a apresentação atual, ex.: PPT)
            </label>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={inputClass}
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              placeholder={libraryTab === 'songs' ? 'Buscar música pelo título, letra ou artista' : 'Buscar texto pelo título'}
              onKeyDown={(e) => e.key === 'Enter' && searchLibrary()}
            />
            <button onClick={searchLibrary} className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm whitespace-nowrap">
              Buscar
            </button>
          </div>
        )}

        <p className="text-xs text-slate-500">
          {libraryTab === 'verse'
            ? 'Selecione a versão, o livro, o capítulo e o versículo. O nome do livro segue o idioma da versão escolhida.'
            : 'A busca consulta a API oficial do Holyrics (SearchLyrics / SearchText).'}
        </p>

        {libraryMessage && <p className="text-xs text-slate-300">{libraryMessage}</p>}

        {libraryTab !== 'verse' && libraryResults.length > 0 && (
          <div className="space-y-1 max-h-72 overflow-auto">
            {libraryResults.map((item) => (
              <div key={item.id} className="bg-slate-900 p-2 rounded flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.title || '(sem título)'}</div>
                  <div className="text-xs text-slate-500 truncate">{item.artist || item.folder || ''}</div>
                </div>
                <button
                  onClick={() => (libraryTab === 'songs' ? showSong(item.id) : showTextItem(item.id))}
                  className="bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded text-xs flex-shrink-0"
                >
                  Exibir
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <button
          type="button"
          onClick={() => setCompatOpen((v) => !v)}
          aria-expanded={compatOpen}
          className="w-full flex items-center justify-between gap-2 flex-wrap text-left"
        >
          <h2 className="font-semibold">Compatibilidade dos recursos</h2>
          <span className="text-xs text-slate-400">
            {compatibilityVersion ? `Holyrics ${compatibilityVersion}` : 'versão não detectada'}
            {' • '}
            {compatAvailable} disp. · {compatUnverified} não verif. · {compatUnavailable} indisp.
            <span className="ml-2 inline-block">{compatOpen ? '▲' : '▼'}</span>
          </span>
        </button>
        {compatOpen && (
          <>
            <p className="text-xs text-slate-500">
              Disponível = a versão conectada atende ao requisito e o comportamento foi verificado.
              Não verificado = a versão atende, mas o comportamento ainda não foi confirmado.
            </p>
            <div className="space-y-1">
              {compatibility.map((f) => {
                const badge = COMPAT_STATUS[f.status];
                return (
                  <div
                    key={f.key}
                    className="bg-slate-900 p-2 rounded text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-slate-500">
                        mín. {f.minVersion}
                        {f.note ? ` • ${f.note}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">
                        Controller: {f.implemented ? 'usa' : 'não usa'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Integração com Holyrics</h2>
          <button onClick={loadSettings} className="text-xs text-slate-400 hover:text-slate-200">Recarregar</button>
        </div>
        {settingsForm ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Endereço do Holyrics</label>
              <input className={inputClass} value={settingsForm.holyrics.host} onChange={(e) => updateSettingsField('holyrics', 'host', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Porta da API</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.port} onChange={(e) => updateSettingsField('holyrics', 'port', Number(e.target.value))} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Token (deixe "***" para manter o atual)</label>
              <input className={inputClass} value={settingsForm.holyrics.token} onChange={(e) => updateSettingsField('holyrics', 'token', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Intervalo de consulta (ms)</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.pollIntervalMs} onChange={(e) => updateSettingsField('holyrics', 'pollIntervalMs', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Intervalo de prévias (ms)</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.previewIntervalMs} onChange={(e) => updateSettingsField('holyrics', 'previewIntervalMs', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Timeout das requisições (ms)</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.requestTimeoutMs} onChange={(e) => updateSettingsField('holyrics', 'requestTimeoutMs', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Porta do stage view</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.stageViewPort} onChange={(e) => updateSettingsField('holyrics', 'stageViewPort', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Intervalo do stage view (ms)</label>
              <input className={inputClass} type="number" value={settingsForm.holyrics.stageViewIntervalMs} onChange={(e) => updateSettingsField('holyrics', 'stageViewIntervalMs', Number(e.target.value))} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settingsForm.holyrics.stageViewEnabled} onChange={(e) => updateSettingsField('holyrics', 'stageViewEnabled', e.target.checked)} />
                Usar stage view do Holyrics para prévia (inclui PPT/ODP)
              </label>
            </div>
            <div>
              <label className={labelClass}>Limite entre comandos (ms)</label>
              <input className={inputClass} type="number" value={settingsForm.security.commandRateLimitMs} onChange={(e) => updateSettingsField('security', 'commandRateLimitMs', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Porta do servidor web</label>
              <input className={inputClass} type="number" value={settingsForm.server.port} onChange={(e) => updateSettingsField('server', 'port', Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settingsForm.server.openBrowser} onChange={(e) => updateSettingsField('server', 'openBrowser', e.target.checked)} />
                Abrir navegador ao iniciar
              </label>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button onClick={saveSettings} className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm">Salvar configurações</button>
              {settingsMessage && <span className="text-xs text-slate-400">{settingsMessage}</span>}
            </div>
            <p className="sm:col-span-2 text-xs text-slate-500">
              A porta do servidor web só é aplicada após reiniciar o controller. O token nunca é exibido ao navegador.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Carregando...</p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Dispositivos conectados</h2>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum dispositivo conectado.</p>
        ) : (
          <div className="space-y-2">
            {clients.map((c) => (
              <div key={c.socketId} className="bg-slate-900 p-2 rounded text-sm flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold">{CLIENT_TYPE_LABEL[c.type]}</span>
                <span>{c.name}</span>
                <span className="text-slate-400">{c.ip || '—'}</span>
                <span className="text-slate-500 text-xs">desde {formatTime(c.connectedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Sessões de palestrante</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="Nome do palestrante"
            className={inputClass}
          />
          <button onClick={createSession} className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded text-sm whitespace-nowrap">Criar sessão</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERMISSIONS.map((p) => (
            <label key={p.key} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={selectedPerms.includes(p.key)}
                onChange={(e) =>
                  setSelectedPerms((prev) =>
                    e.target.checked ? [...prev, p.key] : prev.filter((x) => x !== p.key)
                  )
                }
              />
              {p.label}
            </label>
          ))}
        </div>

        {sessions.filter((s) => !s.revoked).length === 0 && (
          <p className="text-sm text-slate-400">Nenhuma sessão ativa.</p>
        )}

        <div className="space-y-2">
          {sessions.filter((s) => !s.revoked).map((s) => (
            <div key={s.id} className="bg-slate-900 p-3 rounded text-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.blocked ? 'bg-yellow-700' : 'bg-green-800'}`}>
                      {s.blocked ? 'Bloqueado' : 'Ativo'}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs mt-1">{s.permissions.join(', ')}</div>
                  <div className="text-slate-500 text-xs break-all mt-1">{presenterUrl(s.token)}</div>
                </div>
                <div className="flex flex-wrap gap-2 flex-shrink-0">
                  <button onClick={() => openQr(s)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs">QR Code</button>
                  <button onClick={() => copyLink(presenterUrl(s.token))} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs">Copiar link</button>
                  <button onClick={() => toggleBlock(s)} className="bg-yellow-700 hover:bg-yellow-600 px-3 py-2 rounded text-xs">
                    {s.blocked ? 'Liberar' : 'Bloquear'}
                  </button>
                  <button onClick={() => startEditPerms(s)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs">Permissões</button>
                  <button onClick={() => revoke(s.id)} className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded text-xs">Revogar</button>
                </div>
              </div>

              {editingSession === s.id && (
                <div className="border-t border-slate-700 pt-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PERMISSIONS.map((p) => (
                      <label key={p.key} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={editPerms.includes(p.key)}
                          onChange={(e) =>
                            setEditPerms((prev) =>
                              e.target.checked ? [...prev, p.key] : prev.filter((x) => x !== p.key)
                            )
                          }
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => savePerms(s.id)} className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded text-xs">Salvar</button>
                    <button onClick={() => setEditingSession(null)} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold">Logs recentes</h2>
          <div className="flex gap-2">
            <button onClick={() => refresh()} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs">Atualizar</button>
            <button onClick={() => exportLog('server')} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs">Exportar server.log</button>
            <button onClick={() => exportLog('error')} className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-xs">Exportar error.log</button>
          </div>
        </div>
        <pre className="text-xs bg-slate-900 p-2 rounded overflow-auto max-h-48">
          {logs.join('\n')}
        </pre>
      </section>

      {qrOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setQrOpen(false)}>
          <div className="bg-slate-800 rounded-lg p-4 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-center">Acesso do palestrante</h2>
            {qrImage && <img src={qrImage} alt="QR Code do link do palestrante" className="w-full rounded bg-white p-2" />}
            <div className="text-xs text-slate-400 break-all">{qrLink}</div>
            <div className="flex gap-2">
              <button onClick={() => copyLink(qrLink)} className="flex-1 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded text-sm">
                {copied ? 'Copiado!' : 'Copiar link'}
              </button>
              <button onClick={() => setQrOpen(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
