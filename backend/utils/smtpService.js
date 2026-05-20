/**
 * Shared SMTP layer — pooled connections, send queue, circuit breaker.
 * Prevents connection storms when many users send onboarding / HR emails at once.
 */

import logger from './logger.js';
import CircuitBreaker from './circuitBreaker.js';

const smtpBreaker = new CircuitBreaker({
  name: 'SMTP',
  failureThreshold: 5,
  timeout: 60_000,
});

/** @type {Map<string, import('nodemailer').Transporter>} */
const transportPool = new Map();

let nodemailerModule = null;

async function getNodemailer() {
  if (!nodemailerModule) {
    nodemailerModule = await import('nodemailer');
  }
  return nodemailerModule.default;
}

/**
 * Normalize org or env SMTP into a single config object.
 */
export function normalizeSmtpConfig(organizationSmtp) {
  const o = organizationSmtp;
  const useOrg = o && o.host && o.user && o.pass;

  const host = useOrg ? o.host : process.env.SMTP_HOST;
  const user = useOrg ? o.user : process.env.SMTP_USER;
  const pass = useOrg ? o.pass : process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = useOrg
    ? parseInt(String(o.port), 10) || 587
    : parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = useOrg ? !!o.secure : String(process.env.SMTP_PORT) === '465';

  return {
    host: String(host).trim(),
    port,
    secure,
    user: String(user).trim(),
    pass: String(pass),
    fromEmail: useOrg
      ? (o.fromEmail || o.user)
      : process.env.FROM_EMAIL || process.env.SMTP_USER,
    fromName: useOrg
      ? (o.fromName || 'WorkPlus HR')
      : process.env.SMTP_FROM_NAME || 'WorkPlus HR',
    poolKey: `${host}:${port}:${user}`,
  };
}

function poolOptions(config) {
  const maxConnections =
    parseInt(process.env.SMTP_MAX_CONNECTIONS, 10) || 3;
  const maxMessages =
    parseInt(process.env.SMTP_POOL_MAX_MESSAGES, 10) || 100;

  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    pool: true,
    maxConnections,
    maxMessages,
    requireTLS: !config.secure && config.port === 587,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED === 'true',
    },
  };
}

async function getPooledTransport(config) {
  const key = config.poolKey;
  if (transportPool.has(key)) {
    return transportPool.get(key);
  }

  const nodemailer = await getNodemailer();
  const transport = nodemailer.createTransport(poolOptions(config));
  transportPool.set(key, transport);
  logger.info('SMTP pooled transport created', {
    host: config.host,
    port: config.port,
    user: config.user,
    maxConnections: poolOptions(config).maxConnections,
  });
  return transport;
}

/** Invalidate pooled transports (call after org SMTP settings change). */
export function invalidateSmtpTransports(poolKeyPrefix) {
  for (const [key, transport] of transportPool.entries()) {
    if (!poolKeyPrefix || key.startsWith(poolKeyPrefix)) {
      try {
        transport.close();
      } catch {
        /* ignore */
      }
      transportPool.delete(key);
    }
  }
  logger.info('SMTP transport pool invalidated', { prefix: poolKeyPrefix || 'all' });
}

const sendQueue = [];
let activeSends = 0;
const maxConcurrent =
  parseInt(process.env.SMTP_MAX_CONCURRENT, 10) || 5;

function drainQueue() {
  while (activeSends < maxConcurrent && sendQueue.length > 0) {
    const job = sendQueue.shift();
    activeSends += 1;
    job
      .fn()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeSends -= 1;
        drainQueue();
      });
  }
}

function enqueueSend(fn) {
  return new Promise((resolve, reject) => {
    sendQueue.push({ fn, resolve, reject });
    drainQueue();
  });
}

/**
 * Send mail through pooled SMTP with queue + circuit breaker.
 */
export async function sendSmtpMail(config, mailOptions) {
  if (!config) {
    return {
      success: false,
      code: 'SMTP_NOT_CONFIGURED',
      error: 'SMTP is not configured',
    };
  }

  const breakerStatus = smtpBreaker.getStatus();
  if (breakerStatus.state === 'OPEN' && breakerStatus.timeUntilRetry > 0) {
    logger.warn('SMTP circuit breaker open — rejecting send', breakerStatus);
    return {
      success: false,
      code: 'SMTP_CIRCUIT_OPEN',
      error: 'Email service is temporarily unavailable. Try again in a minute.',
      retryAfterMs: breakerStatus.timeUntilRetry,
    };
  }

  try {
    const info = await smtpBreaker.execute(() =>
      enqueueSend(async () => {
        const transport = await getPooledTransport(config);
        return transport.sendMail(mailOptions);
      })
    );

    return {
      success: true,
      messageId: info?.messageId,
    };
  } catch (error) {
    const message = error?.message || 'SMTP send failed';
    const code = error?.code || error?.responseCode;

    logger.error('SMTP send failed', {
      error: message,
      code,
      to: mailOptions?.to,
      host: config.host,
    });

    if (
      code === 'SMTP_CIRCUIT_OPEN' ||
      message.includes('Circuit breaker is OPEN')
    ) {
      return {
        success: false,
        code: 'SMTP_CIRCUIT_OPEN',
        error: 'Email service is temporarily unavailable. Try again shortly.',
      };
    }

    return {
      success: false,
      code: code || 'SMTP_SEND_FAILED',
      error: message,
    };
  }
}

/** Quick connectivity check (cached) for admin diagnostics. */
const testCache = new Map();
const TEST_CACHE_MS = 60_000;

export async function testSmtpConnection(config, { force = false } = {}) {
  if (!config) {
    return { ok: false, code: 'SMTP_NOT_CONFIGURED', error: 'SMTP not configured' };
  }

  const cacheKey = config.poolKey;
  if (!force && testCache.has(cacheKey)) {
    const cached = testCache.get(cacheKey);
    if (Date.now() - cached.at < TEST_CACHE_MS) {
      return cached.result;
    }
  }

  const started = Date.now();
  try {
    const transport = await getPooledTransport(config);
    await Promise.race([
      transport.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP verify timeout')), 15_000)
      ),
    ]);
    const result = {
      ok: true,
      latencyMs: Date.now() - started,
      host: config.host,
      user: config.user,
    };
    testCache.set(cacheKey, { at: Date.now(), result });
    return result;
  } catch (error) {
    const result = {
      ok: false,
      code: 'SMTP_VERIFY_FAILED',
      error: error.message,
      latencyMs: Date.now() - started,
      host: config.host,
      user: config.user,
    };
    testCache.set(cacheKey, { at: Date.now(), result });
    return result;
  }
}

export function getSmtpServiceStatus() {
  return {
    pooledTransports: transportPool.size,
    queueLength: sendQueue.length,
    activeSends,
    maxConcurrent,
    circuitBreaker: smtpBreaker.getStatus(),
  };
}

export default {
  normalizeSmtpConfig,
  sendSmtpMail,
  testSmtpConnection,
  invalidateSmtpTransports,
  getSmtpServiceStatus,
};
