import pkg from '../package.json';

/**
 * Versão do próprio OHC (não confundir com a versão do Holyrics).
 * Vem do package.json e é embutida no executável pelo pkg.
 */
export const APP_VERSION: string = (pkg as { version: string }).version;
