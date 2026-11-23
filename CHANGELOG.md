# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto adere ao [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Planejado

- Evolução para produto: executável com ícone na bandeja (Windows e Linux),
  atualização automática via GitHub Releases e site com download e tutorial.

### Alterado

- Porta padrão do servidor alterada de `3000` para `8585` (porta menos comum,
  evitando conflito com ferramentas de desenvolvimento). Instalações existentes
  mantêm a porta salva em `config/settings.json`.
- Senha padrão do painel administrativo alterada para `ohc@2026`
  (antes `icpb@2026`). Válida para instalações novas; instalações existentes
  mantêm a senha salva em `config/settings.json`.
- Identidade do projeto renomeada para **OHC — OBS Holyrics Controller**
  (nome, título do painel, PWA e pacotes npm).
- Licença **MIT** adicionada ao projeto.

## [0.8.0] - 2026-11-23

Baseline do controller web portátil.

### Adicionado

- Backend Node/TypeScript (Express + Socket.IO) com `HolyricsApiService`
  integrado exclusivamente à API oficial do Holyrics (API Server), polling de
  estado, fila centralizada de comandos e stage view do plugin WebService.
- Painel administrativo: configuração de integração (IP/porta/token), teste de
  conexão, versão detectada, matriz de compatibilidade, dispositivos conectados,
  sessões de palestrante com QR Code, revogação, bloqueio, logs e exportação.
- Docks para o OBS Studio: `/lyrics` (playlist de letras), `/slides` (playlist de
  mídia com prévias) e `/bible` (versículos em apresentação rápida com prévia,
  avançar/retroceder e fechar, mantendo a apresentação atual).
- Interface do palestrante responsiva com PWA, prévia do próximo slide ao lado,
  sinal de carregamento nos comandos e permissões por sessão.
- Scripts portáteis (Windows e Linux), download automático do Node.js portátil
  e pacote portátil com runtime embutido.
