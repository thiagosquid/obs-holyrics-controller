interface Props {
  connected: boolean;
  holyricsConnected: boolean;
  label?: string;
}

export function ConnectionBadge({ connected, holyricsConnected, label }: Props) {
  let color = 'bg-red-600';
  if (connected && holyricsConnected) color = 'bg-green-600';
  else if (connected) color = 'bg-yellow-600';
  return (
    <span className={`text-xs px-2 py-1 rounded ${color} text-white`}>
      {label || (connected ? (holyricsConnected ? 'Conectado' : 'Controller OK') : 'Desconectado')}
    </span>
  );
}
