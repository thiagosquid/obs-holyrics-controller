#!/usr/bin/env bash
#
# Gera os binários e publica um release no GitHub com eles.
#
# Uso:
#   bash server/scripts/release.sh
#
# Pré-requisitos:
#   - gh CLI autenticado (gh auth login)
#   - código já commitado e enviado (git push) para o repositório
#
# O nome dos ativos (ohc para Linux e OHC.exe para Windows) é o que o
# auto-update espera — não altere sem ajustar server/src/updater.ts.
set -euo pipefail

REPO="thiagosquid/obs-holyrics-controller"

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

echo "== Compilando binários (${TAG}) =="
rm -rf build
npm run build:bin

echo "== Renomeando ativos =="
mv build/ohc-server-linux build/ohc
mv build/ohc-server-win.exe build/OHC.exe

echo "== Convertendo OHC.exe para GUI (sem janela de terminal) =="
python3 scripts/patch-pe-gui.py build/OHC.exe

echo "== Criando release ${TAG} no GitHub =="
gh release create "$TAG" \
  build/ohc \
  build/OHC.exe \
  --repo "$REPO" \
  --title "OHC ${TAG}" \
  --generate-notes

echo
echo "Concluído: https://github.com/${REPO}/releases/tag/${TAG}"
