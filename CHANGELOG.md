# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto adere ao [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-11-23

### Adicionado

- **Atualização automática via GitHub Releases** (`updater.ts`): verifica a
  versão mais recente, baixa o binário da plataforma e aplica ao encerrar ou
  via item "Atualizar OHC" na bandeja (com reinício opcional).
- Script `scripts/release.sh` para compilar os binários e publicar o release no
  GitHub com os ativos `ohc` (Linux) e `OHC.exe` (Windows).
- Site de download e tutorial em `docs/` (publicado no GitHub Pages).
- **Launcher com ícone na bandeja** (`launcher.ts`, entrada do executável):
  status do servidor, abrir painel e encerrar — com fallback automático para
  modo headless (`--no-tray`) quando a bandeja não estiver disponível.
- **Executáveis empacotados** com `@yao-pkg/pkg` (Node 22.23.5 embutido):
  `ohc` (Linux, ~91MB) e `OHC.exe` (Windows, ~75MB, subsystem GUI — sem
  janela de terminal).
- Caminhos separados para dados graváveis (ao lado do executável, modo
  portátil) e assets somente leitura (frontend embutido no binário).
- Correção de compatibilidade com o systray2: o helper da bandeja é copiado
  para `<dados>/tray/<versão>/` com permissão 0o755 (o chmod interno do
  systray2 usa modo simbólico que o Node não aceita).
- Script `scripts/patch-pe-gui.py` para converter o executável Windows em GUI.

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

### Corrigido

- Executável Windows (`OHC.exe`) que fechava na inicialização por causa do
  bytecode V8 gerado em outra plataforma: o build agora usa
  `--public --public-packages "*"`, que embute o JavaScript como código-fonte
  (sem bytecode) e permite gerar o binário Windows a partir do Linux.
- Logs de erro que apareciam sem o motivo (o segundo argumento era descartado
  pelo winston); agora o motivo real é registrado no arquivo de log.

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
