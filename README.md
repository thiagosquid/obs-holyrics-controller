# OHC — OBS Holyrics Controller

Sistema portátil de controle remoto do Holyrics, com integração ao OBS Studio e interface web para palestrantes.

> **OHC não é afiliado ao OBS Studio nem ao Holyrics.** O OHC apenas utiliza a
> API oficial do [Holyrics API Server](https://github.com/holyrics/API-Server).

## Visão geral

O Holyrics Web Controller se conecta ao **Holyrics API Server** oficial e fornece:

- Painel administrativo web (`/admin`)
- Dock do OBS para controle de letras (`/lyrics`)
- Dock do OBS para versículos bíblicos (`/bible`)
- Dock do OBS para controle e pré-visualização de slides (`/slides`)
- Interface web para palestrantes (`/presenter`)
- Sincronização em tempo real via WebSocket

O Holyrics continua sendo a fonte de verdade. Este projeto apenas consulta o estado e executa ações oficiais da API.

## Requisitos

- Computador com **Holyrics** instalado e **API Server** ativado.
- Todos os dispositivos na mesma rede local (LAN/Wi-Fi).
- No Windows: pasta do projeto extraída. O pacote portátil já inclui o Node.js em `runtime/node/`; se essa pasta não existir, o `iniciar.bat` baixa automaticamente.
- No Linux/macOS: Node.js 18+ instalado para desenvolvimento/testes.

## Estrutura

```
HolyricsWebController/
├── iniciar.bat              # inicia no Windows
├── parar.bat                # encerra no Windows
├── iniciar_oculto.vbs       # inicia oculto no Windows
├── download-node.bat        # baixa Node.js portátil no Windows
├── iniciar.sh               # inicia no Linux/macOS (desenvolvimento)
├── config/settings.json     # configurações locais
├── data/                    # sessões, PID
├── logs/                    # logs do servidor
├── runtime/node/            # Node.js portátil (Windows)
├── server/                  # backend Node.js + TypeScript
│   ├── src/                 # código-fonte
│   ├── public/              # páginas web
│   └── dist/                # código compilado
└── client/                  # frontend React (futuro)
```

## Configuração

Edite `config/settings.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
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
- `holyrics.token`: token criado em *Arquivo > Configurações > API Server > Gerenciar permissões*.
- `server.host`: `0.0.0.0` permite acesso de outros dispositivos na LAN.

Senha padrão do painel administrativo: `icpb@2026`.

## Como usar no Windows

1. Extraia a pasta do projeto.
2. O pacote portátil já inclui o Node.js em `runtime/node/`. Se essa pasta não existir, o `iniciar.bat` baixa automaticamente na primeira execução.
3. Ajuste `config/settings.json` com o IP e token do Holyrics.
4. Execute `iniciar.bat`.
5. O navegador abrirá o painel administrativo.

Para encerrar, use `parar.bat`.

## Como usar no Linux/macOS (desenvolvimento)

```bash
cd HolyricsWebController
./iniciar.sh
```

## Endereços de acesso

Substitua `IP-DO-SERVIDOR` pelo IP local do computador que executa o Holyrics e o Controller.

- Painel administrativo: `http://IP-DO-SERVIDOR:3000/admin`
- Dock de letras (OBS): `http://localhost:3000/lyrics`
- Dock de versículos (OBS): `http://localhost:3000/bible`
- Dock de slides (OBS): `http://localhost:3000/slides`
- Interface do palestrante: `http://IP-DO-SERVIDOR:3000/presenter?token=TOKEN_DA_SESSAO`

## Adicionando os docks no OBS Studio

1. No OBS, vá em **Docks > Custom Browser Docks...**
2. Adicione:
   - Nome: `Holyrics Lyrics` | URL: `http://localhost:3000/lyrics`
   - Nome: `Holyrics Versículos` | URL: `http://localhost:3000/bible`
   - Nome: `Holyrics Slides` | URL: `http://localhost:3000/slides`
3. Clique em **Apply**.

## Criando sessão para palestrante

1. Acesse o painel administrativo (`/admin`).
2. Clique em **Nova sessão de palestrante**.
3. Copie o link gerado e envie ao palestrante.
4. Você pode revogar ou bloquear a sessão a qualquer momento.

## Firewall

Se outros dispositivos não conseguirem acessar, permita a porta configurada (padrão 3000) no firewall do Windows:

```powershell
netsh advfirewall firewall add rule name="Holyrics Web Controller" dir=in action=allow protocol=tcp localport=3000
```

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

Uso interno. Consulte a documentação oficial do Holyrics API Server para os termos de uso da API.
