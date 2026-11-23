# OHC — OBS Holyrics Controller

Controlador local, gratuito e portátil do [Holyrics](https://holyrics.com.br), com integração ao
[OBS Studio](https://obsproject.com) e interface web para palestrantes. Tudo roda no navegador, na sua rede local.

> **OHC não é afiliado ao OBS Studio nem ao Holyrics.** O OHC apenas utiliza a
> API oficial do [Holyrics API Server](https://github.com/holyrics/API-Server)
> e o plugin WebService do Holyrics.

## Baixar

| Plataforma | Arquivo |
|---|---|
| Windows | [`OHC.exe`](https://github.com/thiagosquid/obs-holyrics-controller/releases/latest/download/OHC.exe) |
| Linux | [`ohc`](https://github.com/thiagosquid/obs-holyrics-controller/releases/latest/download/ohc) |

- **[Site com tutorial](https://thiagosquid.github.io/obs-holyrics-controller/)**
- **[Todas as versões](https://github.com/thiagosquid/obs-holyrics-controller/releases)**

Os executáveis são únicos e portáteis: não exigem instalação nem Node.js. A
atualização automática baixa e aplica novas versões sozinha.

## Visão geral

O OHC se conecta ao **Holyrics API Server** oficial e fornece:

- Painel administrativo web (`/admin`)
- Dock do OBS para letras (`/lyrics`)
- Dock do OBS para versículos bíblicos (`/bible`)
- Dock do OBS para slides (`/slides`)
- Interface web para palestrantes (`/presenter`)
- Sincronização em tempo real via WebSocket

O Holyrics continua sendo a fonte de verdade: o OHC apenas consulta o estado e executa ações oficiais da API.

## Requisitos

- Computador com **Holyrics** instalado e **API Server** ativado (porta 8091).
- Todos os dispositivos na mesma rede local (LAN/Wi-Fi).

## Instalação

### Windows

1. Baixe o `OHC.exe` e coloque em uma pasta (ex.: `Documentos\OHC`).
2. Dê dois cliques. Na primeira vez, o Windows mostra o **SmartScreen** —
   clique em **“Mais informações” → “Executar assim mesmo”**.
3. Um ícone aparece na **bandeja** (setinha ⬆️ ao lado do relógio) e o painel abre no navegador.

### Linux

```bash
chmod +x ohc
./ohc
```

Os dados (configurações, sessões e logs) ficam **ao lado do executável**, em modo
portátil — é possível copiar a pasta inteira para outro computador.

## Configuração

A configuração é feita pelo painel administrativo (`/admin`), mas também pode ser
editada em `config/settings.json` (criado na primeira execução, ao lado do executável):

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8585,
    "openBrowser": true
  },
  "holyrics": {
    "host": "192.168.50.222",
    "port": 8091,
    "token": "SEU_TOKEN_AQUI",
    "pollIntervalMs": 750,
    "previewIntervalMs": 2000,
    "requestTimeoutMs": 5000
  },
  "admin": {
    "passwordHash": "..."
  }
}
```

- `holyrics.host` e `holyrics.port`: endereço do API Server do Holyrics.
- `holyrics.token`: token criado em *Configurações → API Server*. **Marque todas as permissões ao criar o token**.
- `server.host`: `0.0.0.0` permite acesso de outros dispositivos na LAN.

Senha padrão do painel administrativo: `ohc@2026` (troque após o primeiro acesso).

## Endereços de acesso

Substitua `IP` pelo IP local do computador que executa o OHC.

- Painel administrativo: `http://IP:8585/admin`
- Dock de letras (OBS): `http://IP:8585/lyrics`
- Dock de versículos (OBS): `http://IP:8585/bible`
- Dock de slides (OBS): `http://IP:8585/slides`
- Interface do palestrante: `http://IP:8585/presenter?token=TOKEN_DA_SESSAO`

## Integração com o OBS Studio

1. No OBS, vá em **Docks → Custom Browser Docks...**.
2. Adicione:
   - Nome: `Holyrics Lyrics` · URL: `http://IP:8585/lyrics`
   - Nome: `Holyrics Versículos` · URL: `http://IP:8585/bible`
   - Nome: `Holyrics Slides` · URL: `http://IP:8585/slides`
3. Clique em **Apply**.

## Sessão de palestrante

1. Acesse o painel administrativo (`/admin`).
2. Clique em **Nova sessão de palestrante**.
3. Copie o link gerado e envie ao palestrante.
4. Você pode revogar ou bloquear a sessão a qualquer momento.

## Atualização automática

O OHC verifica novas versões no GitHub Releases ao iniciar e baixa a atualização em
segundo plano. Ela é aplicada:

- automaticamente ao **encerrar** o OHC, ou
- a qualquer momento pelo menu da bandeja → **Atualizar OHC** (reinicia na nova versão).

## Firewall

Se outros dispositivos não conseguirem acessar, permita a porta configurada (padrão 8585) no firewall do Windows:

```powershell
netsh advfirewall firewall add rule name="OHC" dir=in action=allow protocol=tcp localport=8585
```

## Desenvolvimento

### Estrutura

```
├── server/                  # backend Node.js + TypeScript (Express + Socket.IO)
│   ├── src/                 # código-fonte
│   │   ├── launcher.ts      # entrada do executável (bandeja + servidor)
│   │   ├── updater.ts       # atualização automática via GitHub Releases
│   │   └── ...
│   ├── public/              # frontend compilado (embutido no binário)
│   └── scripts/             # patch-pe-gui.py e release.sh
├── client/                  # frontend React
├── docs/                    # site de download e tutorial (GitHub Pages)
├── config/ data/ logs/      # dados gerados em execução (modo portátil)
└── CHANGELOG.md
```

### Rodar em desenvolvimento

```bash
cd server
npm install
npm run dev          # inicia com ts-node (sem bandeja)
npm run launcher     # inicia com bandeja (a partir de dist/)
```

### Gerar os executáveis

```bash
cd server
npm run build:bin    # gera build/ohc (Linux) e build/OHC.exe (Windows)
```

### Publicar um release

```bash
# após commitar e enviar o código (git push)
bash server/scripts/release.sh
```

O script compila os binários e cria o release no GitHub com os ativos `ohc` e `OHC.exe`.

## Limitações conhecidas

- A API oficial não retorna lista de slides para apresentações de versículos (`slides: []`).
- O ETag mencionado na documentação não foi retornado nos testes com a versão 2.30.0; o polling periódico é usado.
- A pré-visualização é uma imagem gerada pelo Holyrics, não uma captura garantida da saída física do projetor.

## Segurança

- O token do Holyrics fica apenas no backend (`config/settings.json`) e nunca é enviado ao frontend.
- Logs nunca registram o token em texto aberto.
- Cada sessão de palestrante usa um token aleatório e possui permissões próprias.
- Por padrão, o servidor escuta apenas na rede local (`0.0.0.0` na LAN, sem exposição automática à internet).

## Licença

[MIT](LICENSE). Consulte a documentação oficial do Holyrics API Server para os termos de uso da API.
