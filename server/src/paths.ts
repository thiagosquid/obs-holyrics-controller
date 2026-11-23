import path from 'path';

/**
 * Detecta se o processo está rodando dentro de um executável gerado pelo
 * @yao-pkg/pkg (o pkg define a global process.pkg).
 */
export function isPackaged(): boolean {
  const proc = process as unknown as { pkg?: unknown };
  return Boolean(proc.pkg);
}

/**
 * Diretório gravável para configurações, dados e logs.
 *
 * - Desenvolvimento: raiz do projeto (duas pastas acima de src/dist),
 *   preservando o comportamento portátil atual.
 * - Executável empacotado: a pasta onde o binário está (modo portátil —
 *   config/data/logs acompanham o executável).
 */
export function getDataRoot(): string {
  if (isPackaged()) {
    return path.dirname(process.execPath);
  }
  return path.resolve(__dirname, '../..');
}

/**
 * Diretório (somente leitura quando empacotado) com o frontend compilado.
 * Em desenvolvimento e no executável a estrutura é a mesma: dist/../public
 * (ou src/../public no ts-node).
 */
export function getPublicDir(): string {
  return path.resolve(__dirname, '..', 'public');
}
