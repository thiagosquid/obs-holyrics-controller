import winston from 'winston';
import path from 'path';
import { LOGS_DIR } from './config';
import { isPackaged } from './paths';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

function redactToken(msg: string): string {
  return msg.replace(/token=[a-zA-Z0-9]+/g, 'token=***');
}

const redactFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = redactToken(info.message);
  }
  return info;
});

export const logger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'holyrics-web-controller' },
  format: combine(
    redactFormat(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'server.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// No executável empacotado não há console: apenas arquivo de log
if (process.env.NODE_ENV !== 'production' && !isPackaged()) {
  logger.add(
    new winston.transports.Console({
      format: combine(
        redactFormat(),
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
    })
  );
}

export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  const str = JSON.stringify(obj);
  return JSON.parse(redactToken(str));
}
