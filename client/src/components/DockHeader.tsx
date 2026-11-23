import { ConnectionBadge } from './ConnectionBadge';

interface DockHeaderProps {
  /** Emoji que identifica o dock (ex.: 🎤, 🖼️, 📖). */
  icon: string;
  title: string;
  subtitle?: string;
  /** Classe Tailwind de fundo do selo do ícone (ex.: bg-emerald-600). */
  accent: string;
  connected: boolean;
  holyricsConnected: boolean;
}

/**
 * Cabeçalho unificado dos docks do OBS: selo com ícone colorido, título,
 * subtítulo opcional e o status de conexão — para identificar cada dock de
 * relance e manter a aparência consistente entre eles.
 */
export function DockHeader({
  icon,
  title,
  subtitle,
  accent,
  connected,
  holyricsConnected,
}: DockHeaderProps) {
  return (
    <header className="flex items-center gap-3">
      <span
        className={`flex-shrink-0 w-9 h-9 rounded-lg ${accent} flex items-center justify-center text-lg leading-none`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-sm font-bold text-slate-100 leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      <ConnectionBadge connected={connected} holyricsConnected={holyricsConnected} />
    </header>
  );
}
