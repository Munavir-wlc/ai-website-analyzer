/**
 * Structured JSON Logger for Production Monitoring
 */
const isProd = process.env.NODE_ENV === 'production';

function log(level, message, meta = {}) {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  if (isProd) {
    console.log(JSON.stringify(logObject));
  } else {
    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const colors = {
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    const color = colors[level] || colors.reset;
    console.log(`[${logObject.timestamp}] ${color}${level.toUpperCase()}${colors.reset}: ${message}${metaString}`);
  }
}

const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta)
};

module.exports = logger;
