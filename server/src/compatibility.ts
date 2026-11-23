export type CompatibilityStatus = 'available' | 'unavailable' | 'unverified';

export interface CompatibilityFeature {
  key: string;
  name: string;
  minVersion: string;
  verified: boolean;
  implemented: boolean;
  note?: string;
}

export const COMPATIBILITY_FEATURES: CompatibilityFeature[] = [
  {
    key: 'get_current_presentation',
    name: 'GetCurrentPresentation',
    minVersion: '2.19.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'slide_number_total',
    name: 'Número e total de slides',
    minVersion: '2.20.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'slides_list',
    name: 'Lista de slides (include_slides)',
    minVersion: '2.21.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'slide_previews',
    name: 'Pré-visualização de slides',
    minVersion: '2.21.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'slide_preview_640',
    name: 'Prévia em 640x360',
    minVersion: '2.21.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'action_next_previous',
    name: 'ActionNext / ActionPrevious',
    minVersion: '2.19.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'action_goto_index',
    name: 'ActionGoToIndex',
    minVersion: '2.19.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'action_goto_description',
    name: 'ActionGoToSlideDescription',
    minVersion: '2.19.0',
    verified: false,
    implemented: true,
    note: 'Não testado por falta de descrições cadastradas.',
  },
  {
    key: 'close_current',
    name: 'CloseCurrentPresentation',
    minVersion: '2.19.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'get_version',
    name: 'GetVersion',
    minVersion: '2.22.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'get_token_info',
    name: 'GetTokenInfo',
    minVersion: '2.25.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'check_permissions',
    name: 'CheckPermissions',
    minVersion: '2.25.0',
    verified: true,
    implemented: true,
  },
  {
    key: 'etag',
    name: 'ETag',
    minVersion: '2.25.0',
    verified: false,
    implemented: false,
    note: 'Não retornado pela API nos testes com a versão conectada.',
  },
  {
    key: 'get_api_server_info',
    name: 'GetAPIServerInfo',
    minVersion: '2.26.0',
    verified: true,
    implemented: false,
    note: 'Ação disponível, mas o controller ainda não a utiliza.',
  },
  {
    key: 'get_slide_descriptions',
    name: 'GetSlideDescriptions',
    minVersion: '2.21.0',
    verified: true,
    implemented: false,
    note: 'Ação respondeu OK, mas não há descrições cadastradas.',
  },
  {
    key: 'quick_presentations',
    name: 'Apresentações rápidas',
    minVersion: '2.24.0',
    verified: true,
    implemented: false,
    note: 'Usadas apenas nos testes manuais.',
  },
  {
    key: 'show_lyrics',
    name: 'ShowLyrics / GetSongs / GetLyrics',
    minVersion: '2.21.0',
    verified: false,
    implemented: false,
    note: 'O controller controla a apresentação atual, mas não inicia músicas.',
  },
  {
    key: 'show_verse',
    name: 'ShowVerse',
    minVersion: '2.19.0',
    verified: false,
    implemented: false,
    note: 'O controller não inicia versículos; apenas controla a apresentação atual.',
  },
  {
    key: 'show_verse_quick',
    name: 'ShowVerse com quick_presentation',
    minVersion: '2.24.0',
    verified: false,
    implemented: false,
  },
  {
    key: 'f8_f9_f10',
    name: 'F8 / F9 / F10 (papel de parede, tela vazia, tela preta)',
    minVersion: '2.19.0',
    verified: false,
    implemented: false,
  },
];

function parseVersion(version: string): number[] {
  return version
    .split('.')
    .map((part) => parseInt(part, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

export function buildCompatibility(version?: string) {
  return COMPATIBILITY_FEATURES.map((feature) => {
    let status: CompatibilityStatus = 'unverified';
    if (version) {
      if (compareVersions(version, feature.minVersion) < 0) {
        status = 'unavailable';
      } else {
        status = feature.verified ? 'available' : 'unverified';
      }
    }
    return { ...feature, status };
  });
}
