const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '30000', 10);
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '100', 10));
const DEFAULT_MAX_CONCURRENCY = Math.min(1000, Math.max(CONCURRENCY * 4, CONCURRENCY + 50));
const MAX_CONCURRENCY_RAW = parseInt(process.env.MAX_CONCURRENCY || String(DEFAULT_MAX_CONCURRENCY), 10);
const MAX_CONCURRENCY = Math.max(CONCURRENCY, MAX_CONCURRENCY_RAW);
const MAX_REDIRECTS = Math.max(0, parseInt(process.env.MAX_REDIRECTS || '3', 10));
const RETRY_ATTEMPTS = Math.max(0, parseInt(process.env.RETRY_ATTEMPTS || '2', 10));
const REQUEST_METHOD = (process.env.REQUEST_METHOD || 'GET').toUpperCase();
const KEEP_ALIVE = (process.env.KEEP_ALIVE || 'false').toLowerCase() === 'true';
const MAX_BODY_BYTES = Math.max(0, parseInt(process.env.MAX_BODY_BYTES || '65536', 10));
const MAX_SOCKETS = Math.max(MAX_CONCURRENCY * 2, parseInt(process.env.MAX_SOCKETS || '128', 10));
const MAX_FREE_SOCKETS = Math.max(0, parseInt(process.env.MAX_FREE_SOCKETS || '32', 10));
const FAST_TIMEOUT_MS = Math.max(0, parseInt(process.env.FAST_TIMEOUT_MS || '3000', 10));
const FAST_LANE_RATIO_RAW = parseFloat(process.env.FAST_LANE_RATIO || '0.2');
const FAST_LANE_RATIO = Number.isFinite(FAST_LANE_RATIO_RAW)
  ? Math.max(0, Math.min(0.9, FAST_LANE_RATIO_RAW))
  : 0.2;
const DISPLAY_INTERVAL_MS = Math.max(500, parseInt(process.env.DISPLAY_INTERVAL_MS || '3000', 10));
const SLOW_RAMP_STEP = Math.max(1, parseInt(process.env.SLOW_RAMP_STEP || '10', 10));
const SLOW_RAMP_INTERVAL_MS = Math.max(1000, parseInt(process.env.SLOW_RAMP_INTERVAL_MS || '15000', 10));
const SLOW_RAMP_QUEUE_THRESHOLD = Math.max(0, parseInt(process.env.SLOW_RAMP_QUEUE_THRESHOLD || '100', 10));
const SLOW_RAMP_MAX_TIMEOUT_PCT_RAW = parseFloat(process.env.SLOW_RAMP_MAX_TIMEOUT_PCT || '0.1');
const SLOW_RAMP_MAX_TIMEOUT_PCT = Number.isFinite(SLOW_RAMP_MAX_TIMEOUT_PCT_RAW)
  ? Math.max(0, Math.min(1, SLOW_RAMP_MAX_TIMEOUT_PCT_RAW))
  : 0.1;
const SLOW_RAMP_MIN_COMPLETIONS = Math.max(1, parseInt(process.env.SLOW_RAMP_MIN_COMPLETIONS || '5', 10));
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/whois_gobve.json');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'status.json');
const MONGO_URI = process.env.MONGO_URI;
const MONGO_ENABLED = !!MONGO_URI;
const FORCE_IPV4 = (process.env.FORCE_IPV4 || 'false').toLowerCase() === 'true';
const SKIP_DNS_RETRIES = (process.env.SKIP_DNS_RETRIES || 'false').toLowerCase() === 'true';
const LOG_MODE_RAW = (process.env.LOG_MODE || 'progress').toLowerCase();
const LOG_MODE = ['progress', 'stream', 'fail'].includes(LOG_MODE_RAW) ? LOG_MODE_RAW : 'progress';
const LOG_CHECKPOINT_MS = Math.max(1000, parseInt(process.env.LOG_CHECKPOINT_MS || '30000', 10));
const LOG_FILE = process.env.LOG_FILE || '';
const LOG_COLOR_RAW = (process.env.LOG_COLOR || '').toLowerCase();
const LOG_COLOR = LOG_COLOR_RAW
  ? !['0', 'false', 'no', 'off'].includes(LOG_COLOR_RAW)
  : process.stdout.isTTY;

// Headers to mimic a real browser
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
};

// Colors for console
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
};

// Shared agents (optional keep-alive)
const httpAgent = new http.Agent({ keepAlive: KEEP_ALIVE, maxSockets: MAX_SOCKETS, maxFreeSockets: MAX_FREE_SOCKETS });
const httpsAgent = new https.Agent({ keepAlive: KEEP_ALIVE, maxSockets: MAX_SOCKETS, maxFreeSockets: MAX_FREE_SOCKETS });

// Errors worth retrying
const DNS_ERRORS = ['EAI_AGAIN', 'ENOTFOUND'];
const RETRYABLE_ERRORS_BASE = ['TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', ...DNS_ERRORS];
const RETRYABLE_ERRORS = SKIP_DNS_RETRIES
  ? RETRYABLE_ERRORS_BASE.filter(error => !DNS_ERRORS.includes(error))
  : RETRYABLE_ERRORS_BASE;

// Extract SSL certificate information from an HTTPS response socket
function buildSSLInfo(socket, domain) {
  if (!socket || typeof socket.getPeerCertificate !== 'function') return null;

  try {
    const cert = socket.getPeerCertificate();
    if (!cert || !cert.subject) return null;

    const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
    const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
    const now = new Date();
    const daysUntilExpiry = validTo
      ? Math.floor((validTo - now) / (1000 * 60 * 60 * 24))
      : null;

    return {
      enabled: true,
      valid: socket.authorized === true,
      issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
      subject: cert.subject?.CN || domain,
      validFrom,
      validTo,
      daysUntilExpiry,
      selfSigned: (cert.issuer?.CN === cert.subject?.CN) ||
                  (cert.issuer?.O === cert.subject?.O && !cert.issuer?.O)
    };
  } catch (e) {
    return null;
  }
}

// Extract relevant headers from response
function extractHeaders(res) {
  const h = res.headers || {};
  return {
    server: h['server'] || null,
    contentType: h['content-type'] || null,
    poweredBy: h['x-powered-by'] || null,
    via: h['via'] || null,
    cacheControl: h['cache-control'] || null,
    contentLength: h['content-length'] ? parseInt(h['content-length']) : null,
    lastModified: h['last-modified'] || null,
  };
}

// Make a single request and return headers
function makeRequest(urlString, method = 'GET', timeout = TIMEOUT_MS, abortSignal) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let settled = false;
    let wasAborted = false;
    let onAbort = null;
    const abortReason = typeof abortSignal?.reason === 'string' ? abortSignal.reason : 'ABORTED';

    const settle = (value) => {
      if (settled) return;
      settled = true;
      if (abortSignal && onAbort) {
        try { abortSignal.removeEventListener('abort', onAbort); } catch (e) {}
      }
      resolve(value);
    };

    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      return settle({ success: false, error: 'INVALID_URL' });
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const headers = method === 'GET'
      ? { ...HEADERS, Range: 'bytes=0-0' }
      : HEADERS;

    const options = {
      method,
      timeout,
      headers,
      agent: url.protocol === 'https:' ? httpsAgent : httpAgent,
      rejectUnauthorized: false,
      family: FORCE_IPV4 ? 4 : undefined,
    };

    const req = protocol.request(url, options, (res) => {
      const responseTime = Date.now() - startTime;
      const sslInfo = url.protocol === 'https:' ? buildSSLInfo(res.socket, url.hostname) : null;

      // Get redirect location if present
      let location = res.headers['location'] || null;
      if (location && !location.startsWith('http')) {
        // Handle relative redirects
        location = new URL(location, urlString).href;
      }

      // For GET, abort immediately after getting headers
      if (method === 'GET') {
        if (KEEP_ALIVE) {
          let bytes = 0;
          res.on('data', (chunk) => {
            bytes += chunk.length;
            if (MAX_BODY_BYTES > 0 && bytes > MAX_BODY_BYTES) {
              req.destroy();
            }
          });
          res.resume();
        } else {
          req.destroy();
        }
      }

      settle({
        success: true,
        httpCode: res.statusCode,
        responseTime,
        headers: extractHeaders(res),
        location,
        ssl: sslInfo,
      });
    });

    req.on('error', (err) => {
      if (wasAborted) {
        return settle({ success: false, error: abortReason });
      }
      settle({ success: false, error: err.code || err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      settle({ success: false, error: 'TIMEOUT' });
    });

    onAbort = () => {
      wasAborted = true;
      req.destroy(new Error(abortReason));
      settle({ success: false, error: abortReason });
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        return settle({ success: false, error: abortReason });
      }
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    req.end();
  });
}

// Check single domain with redirect following
async function checkDomain(domain, options = {}) {
  const redirects = [];
  let currentUrl = `https://${domain}`;
  let result = null;
  let usedHttps = true;
  let sslInfo = null;
  const abortSignal = options.abortSignal;

  const primaryMethod = REQUEST_METHOD === 'HEAD' ? 'HEAD' : 'GET';
  const fallbackMethod = 'GET';

  // Follow redirects - Default to GET for compatibility
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    result = await makeRequest(currentUrl, primaryMethod, TIMEOUT_MS, abortSignal);

    // If HEAD is blocked, retry once with GET to confirm status
    if (primaryMethod === 'HEAD' && result.success && [403, 405, 501].includes(result.httpCode)) {
      result = await makeRequest(currentUrl, fallbackMethod, TIMEOUT_MS, abortSignal);
    }

    // If HTTPS failed on first attempt, try HTTP
    if (!result.success && i === 0 && usedHttps) {
      usedHttps = false;
      currentUrl = `http://${domain}`;
      sslInfo = null; // No SSL for HTTP

      result = await makeRequest(currentUrl, primaryMethod, TIMEOUT_MS, abortSignal);

      if (primaryMethod === 'HEAD' && result.success && [403, 405, 501].includes(result.httpCode)) {
        result = await makeRequest(currentUrl, fallbackMethod, TIMEOUT_MS, abortSignal);
      }
    }

    if (!result.success) {
      break;
    }

    if (result.ssl) {
      sslInfo = result.ssl;
    }

    // Check for redirect
    if (result.httpCode >= 300 && result.httpCode < 400 && result.location) {
      redirects.push({
        url: currentUrl,
        statusCode: result.httpCode
      });
      currentUrl = result.location;
    } else {
      // Not a redirect, we're done
      break;
    }
  }

  const checkedAt = new Date();

  if (result && result.success) {
    return {
      domain,
      status: 'online',
      httpCode: result.httpCode,
      responseTime: result.responseTime,
      ssl: sslInfo,
      headers: result.headers,
      redirects: redirects.length > 0 ? redirects : null,
      finalUrl: redirects.length > 0 ? currentUrl : null,
      checkedAt,
    };
  }

  // Both failed
  return {
    domain,
    status: 'offline',
    httpCode: null,
    responseTime: null,
    ssl: null,
    headers: null,
    redirects: null,
    finalUrl: null,
    error: result?.error || 'UNKNOWN',
    checkedAt,
  };
}

// Check domain with retry logic
async function checkDomainWithRetry(domain, options = {}) {
  const retries = Number.isFinite(options.retries) ? Math.max(0, options.retries) : RETRY_ATTEMPTS;
  let result = await checkDomain(domain, options);

  if (result?.error === 'SLOW_DEMOTE') {
    return result;
  }

  // Retry if failed with retryable error
  if (retries > 0 && result.status === 'offline' && RETRYABLE_ERRORS.includes(result.error)) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      // Wait before retry (2s, 4s)
      await new Promise(r => setTimeout(r, attempt * 2000));
      result = await checkDomain(domain, options);
      if (result.status === 'online') break;
    }
  }

  return result;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDomain(domain, width) {
  if (!domain) return ''.padEnd(width);
  if (domain.length > width) return `${domain.slice(0, width - 3)}...`;
  return domain.padEnd(width);
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function makeProgressBar(pct, width = 10) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return `[${'#'.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}]`;
}

// Process domains with fast/slow lanes and demotion for slow checks
async function processWithConcurrency(domains, concurrency) {
  const results = new Array(domains.length);
  const fastQueue = domains.map((domain, index) => ({ domain, index }));
  const slowQueue = [];
  const total = domains.length;
  const logToConsole = LOG_MODE !== 'progress';
  const logToFile = !!LOG_FILE;
  const shouldLog = logToConsole || logToFile;
  const logTagWidth = 7;
  const logDomainWidth = 32;
  let logStream = null;
  if (logToFile) {
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    } catch (e) {}
    logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  }

  let fastLaneLimit = Math.floor(concurrency * FAST_LANE_RATIO);
  fastLaneLimit = Math.max(1, Math.min(fastLaneLimit, concurrency));
  let slowLaneLimit = Math.max(0, concurrency - fastLaneLimit);
  const minSlowLaneLimit = slowLaneLimit;
  const maxSlowLaneLimit = Math.max(0, MAX_CONCURRENCY - fastLaneLimit);

  console.log(`Lanes: FAST ${fastLaneLimit}, SLOW ${slowLaneLimit} (ratio ${FAST_LANE_RATIO}, fast timeout ${FAST_TIMEOUT_MS}ms)`);

  let inFlightFast = 0;
  let inFlightSlow = 0;
  let done = 0;
  let started = 0;
  const startedSet = new Set();
  let lastPct = 0;
  let online = 0;
  let offline = 0;
  let timeoutCount = 0;
  let lastDoneForRamp = 0;
  let lastTimeoutForRamp = 0;
  let spinIndex = 0;
  const spinChars = ['|', '/', '-', '\\'];
  const startTime = Date.now();
  let onlineResponseSum = 0;
  let dnsErrors = 0;
  let timeoutErrors = 0;
  let resetErrors = 0;
  let otherErrors = 0;

  const writeLog = (event, payload = {}) => {
    if (!shouldLog) return;
    const now = Date.now();
    if (logToFile && logStream) {
      const record = {
        ts: new Date(now).toISOString(),
        elapsedMs: now - startTime,
        event,
        ...payload,
      };
      logStream.write(`${JSON.stringify(record)}\n`);
    }
    if (!logToConsole) return;

    const tagText = event.padEnd(logTagWidth);
    let tagColor = '';
    if (event === 'ONLINE') tagColor = C.green;
    if (event === 'OFFLINE') tagColor = C.red;
    if (event === 'START') tagColor = C.cyan;
    if (event === 'DEMOTE' || event === 'RAMP') tagColor = C.yellow;
    if (event === 'CHECK') tagColor = C.dim;
    const tag = LOG_COLOR && tagColor ? `${tagColor}${tagText}${C.reset}` : tagText;

    const timestamp = formatElapsed(now - startTime);
    const details = payload.details || '';
    if (payload.omitDomain) {
      console.log(`${timestamp} | ${tag} | ${details}`);
    } else {
      const domain = formatDomain(payload.domain || '-', logDomainWidth);
      console.log(`${timestamp} | ${tag} | ${domain} | ${details}`);
    }
  };

  const logCheckpoint = () => {
    if (!shouldLog || LOG_MODE === 'progress') return;
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    const avgResponse = online > 0 ? Math.round(onlineResponseSum / online) : 0;
    const spinner = spinChars[spinIndex % spinChars.length];
    spinIndex++;
    const bar = makeProgressBar(pct, 12);
    const details = [
      `${spinner} ${bar} ${pct}%`,
      `DONE ${done}/${total}`,
      `ON ${online} OFF ${offline}`,
      `AVG ${formatMs(avgResponse)}`,
      `FAILS TIMEOUT ${timeoutErrors} DNS ${dnsErrors} RESET ${resetErrors} OTHER ${otherErrors}`,
    ].join(' | ');
    writeLog('CHECK', { details, omitDomain: true });
  };

  const renderProgress = (force = false) => {
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    const now = Date.now();
    const elapsed = now - startTime;
    const rate = done > 0 ? elapsed / done : 0;
    const etaMs = done > 0 ? rate * (total - done) : 0;
    const eta = done > 0 ? formatDuration(etaMs) : '--';
    const spinner = spinChars[spinIndex % spinChars.length];
    spinIndex++;

    const lanesTextTTY = `${C.yellow}FAST${C.reset} ${inFlightFast}/${fastLaneLimit} ${C.dim}SLOW${C.reset} ${inFlightSlow}/${slowLaneLimit} ${C.dim}SQ${C.reset} ${slowQueue.length}`;
    const lanesTextPlain = `FAST ${inFlightFast}/${fastLaneLimit} SLOW ${inFlightSlow}/${slowLaneLimit} SQ ${slowQueue.length}`;
    const inFlight = inFlightFast + inFlightSlow;
    const queued = fastQueue.length + slowQueue.length;
    const waiting = queued + inFlight;

    if (process.stdout.isTTY) {
      process.stdout.write(
        `\r[${spinner}] Active ${inFlight} Waiting ${waiting} Total ${total} | Started ${started} Completed ${done} | ETA ${eta} RT ${formatDuration(elapsed)} ${C.green}ONLINE${C.reset} ${online} ${C.red}OFFLINE${C.reset} ${offline} ${lanesTextTTY}    `
      );
    } else if (force || pct >= lastPct + 5 || done === total) {
      console.log(`[${spinner}] Active ${inFlight} Waiting ${waiting} Total ${total} | Started ${started} Completed ${done} | ETA ${eta} RT ${formatDuration(elapsed)} ONLINE ${online} OFFLINE ${offline} ${lanesTextPlain}`);
      lastPct = pct;
    }
  };

  let progressTimer = null;
  if (process.stdout.isTTY && LOG_MODE === 'progress') {
    progressTimer = setInterval(() => renderProgress(false), DISPLAY_INTERVAL_MS);
  }

  let checkpointTimer = null;
  if (LOG_MODE !== 'progress') {
    checkpointTimer = setInterval(() => logCheckpoint(), LOG_CHECKPOINT_MS);
  }

  return new Promise((resolve) => {
    const logRamp = (message) => {
      if (LOG_MODE === 'progress') {
        if (process.stdout.isTTY) {
          process.stdout.write('\n');
        }
        console.log(message);
        return;
      }
      writeLog('RAMP', { details: message, omitDomain: true });
    };

    const finishIfDone = () => {
      if (done !== total) return;
      if (progressTimer) clearInterval(progressTimer);
      if (checkpointTimer) clearInterval(checkpointTimer);
      if (rampTimer) clearInterval(rampTimer);
      if (process.stdout.isTTY) {
        if (LOG_MODE === 'progress') {
          renderProgress(true);
          console.log('');
        }
      } else {
        if (LOG_MODE === 'progress') {
          renderProgress(true);
        }
      }
      if (LOG_MODE !== 'progress') {
        logCheckpoint();
      }
      if (logStream) {
        logStream.end();
      }
      resolve(results);
    };

    const runItem = async (item, { demote }) => {
      let demoteTimer = null;
      let controller = null;
      const itemKey = `${item.index}:${item.domain}`;

      if (demote && FAST_TIMEOUT_MS > 0) {
        controller = new AbortController();
        demoteTimer = setTimeout(() => {
          if (fastQueue.length > 0) {
            controller.abort('SLOW_DEMOTE');
          }
        }, FAST_TIMEOUT_MS);
      }

      try {
        if (!startedSet.has(itemKey)) {
          startedSet.add(itemKey);
          started++;
          if (LOG_MODE === 'progress') {
            renderProgress();
          } else if (LOG_MODE === 'stream') {
            writeLog('START', { domain: item.domain, details: 'checking' });
          }
        }
        const result = await checkDomainWithRetry(
          item.domain,
          demote
            ? { abortSignal: controller?.signal, retries: 0 }
            : { retries: RETRY_ATTEMPTS }
        );

        if (result?.error === 'SLOW_DEMOTE' && fastQueue.length > 0) {
          writeLog('DEMOTE', { domain: item.domain, details: `fast-timeout=${FAST_TIMEOUT_MS}ms` });
          slowQueue.push(item);
          return { demoted: true };
        }

        results[item.index] = result;
        if (result.status === 'online') {
          online++;
          if (Number.isFinite(result.responseTime)) onlineResponseSum += result.responseTime;
          if (LOG_MODE === 'stream') {
            const redirectCount = Array.isArray(result.redirects) ? result.redirects.length : 0;
            const details = [
              `code=${result.httpCode}`,
              `rt=${Math.round(result.responseTime)}ms`,
              redirectCount > 0 ? `redir=${redirectCount}` : null
            ].filter(Boolean).join(' ');
            writeLog('ONLINE', { domain: item.domain, details, httpCode: result.httpCode, responseTime: result.responseTime, redirects: redirectCount });
          }
        } else {
          offline++;
          if (result.error === 'TIMEOUT' || result.error === 'ETIMEDOUT') {
            timeoutCount++;
            timeoutErrors++;
          } else if (DNS_ERRORS.includes(result.error)) {
            dnsErrors++;
          } else if (result.error === 'ECONNRESET') {
            resetErrors++;
          } else {
            otherErrors++;
          }
          if (LOG_MODE === 'stream' || LOG_MODE === 'fail') {
            const details = `err=${result.error || 'UNKNOWN'}`;
            writeLog('OFFLINE', { domain: item.domain, details, error: result.error || 'UNKNOWN' });
          }
        }
        done++;
        if (LOG_MODE === 'progress') {
          renderProgress();
        }
        return { demoted: false };
      } catch (err) {
        const error = err?.code || err?.message || 'UNKNOWN';
        results[item.index] = {
          domain: item.domain,
          status: 'offline',
          httpCode: null,
          responseTime: null,
          ssl: null,
          headers: null,
          redirects: null,
          finalUrl: null,
          error,
          checkedAt: new Date(),
        };
        offline++;
        if (error === 'TIMEOUT' || error === 'ETIMEDOUT') {
          timeoutCount++;
          timeoutErrors++;
        } else if (DNS_ERRORS.includes(error)) {
          dnsErrors++;
        } else if (error === 'ECONNRESET') {
          resetErrors++;
        } else {
          otherErrors++;
        }
        if (LOG_MODE === 'stream' || LOG_MODE === 'fail') {
          writeLog('OFFLINE', { domain: item.domain, details: `err=${error}`, error });
        }
        done++;
        if (LOG_MODE === 'progress') {
          renderProgress();
        }
        return { demoted: false };
      } finally {
        if (demoteTimer) clearTimeout(demoteTimer);
      }
    };

    const pump = () => {
      while (inFlightFast < fastLaneLimit) {
        let item = null;
        let demote = false;

        if (fastQueue.length > 0) {
          item = fastQueue.shift();
          demote = true;
        } else if (slowQueue.length > 0) {
          item = slowQueue.shift();
        } else {
          break;
        }

        inFlightFast++;
        runItem(item, { demote })
          .finally(() => {
            inFlightFast--;
            pump();
            finishIfDone();
          });
      }

      while (inFlightSlow < slowLaneLimit) {
        let item = null;

        if (slowQueue.length > 0) {
          item = slowQueue.shift();
        } else if (fastQueue.length > 0) {
          item = fastQueue.shift();
        } else {
          break;
        }

        inFlightSlow++;
        runItem(item, { demote: false })
          .finally(() => {
            inFlightSlow--;
            pump();
            finishIfDone();
          });
      }
    };

    const rampEnabled = maxSlowLaneLimit > minSlowLaneLimit;
    let rampTimer = null;
    if (rampEnabled) {
      rampTimer = setInterval(() => {
        const doneDelta = done - lastDoneForRamp;
        const timeoutDelta = timeoutCount - lastTimeoutForRamp;
        lastDoneForRamp = done;
        lastTimeoutForRamp = timeoutCount;

        if (doneDelta < SLOW_RAMP_MIN_COMPLETIONS) return;

        const timeoutPct = timeoutDelta / doneDelta;
        const queued = fastQueue.length + slowQueue.length;
        const inFlight = inFlightFast + inFlightSlow;
        const atCapacity = inFlight >= fastLaneLimit + slowLaneLimit;

        if (!atCapacity || queued < SLOW_RAMP_QUEUE_THRESHOLD) return;

        if (timeoutPct > SLOW_RAMP_MAX_TIMEOUT_PCT && slowLaneLimit > minSlowLaneLimit) {
          const nextLimit = Math.max(minSlowLaneLimit, slowLaneLimit - SLOW_RAMP_STEP);
          if (nextLimit !== slowLaneLimit) {
            slowLaneLimit = nextLimit;
            logRamp(`Ramp: reducing slow lanes to ${slowLaneLimit} (timeouts ${(timeoutPct * 100).toFixed(1)}%)`);
            if (LOG_MODE === 'progress') {
              renderProgress(true);
            }
          }
          return;
        }

        if (timeoutPct <= SLOW_RAMP_MAX_TIMEOUT_PCT && slowLaneLimit < maxSlowLaneLimit) {
          const nextLimit = Math.min(maxSlowLaneLimit, slowLaneLimit + SLOW_RAMP_STEP);
          if (nextLimit !== slowLaneLimit) {
            slowLaneLimit = nextLimit;
            logRamp(`Ramp: increasing slow lanes to ${slowLaneLimit} (timeouts ${(timeoutPct * 100).toFixed(1)}%)`);
            pump();
            if (LOG_MODE === 'progress') {
              renderProgress(true);
            }
          }
        }
      }, SLOW_RAMP_INTERVAL_MS);
    }

    pump();
    finishIfDone();
  });
}

// Save to MongoDB with retry (only if MONGO_URI is defined)
async function saveToMongoDB(results, summary, checkDuration, maxRetries = 3) {
  if (!MONGO_ENABLED) {
    console.log('\nMongoDB: Skipped (MONGO_URI not defined)');
    return;
  }

  // Dynamic import - only load mongodb when needed
  const { MongoClient } = require('mongodb');

  let client;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\nConnecting to MongoDB (attempt ${attempt}/${maxRetries}): ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
      client = new MongoClient(MONGO_URI, {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000
      });
      await client.connect();

      const db = client.db();
      const checksCollection = db.collection('ve_monitor_checks');
      const domainsCollection = db.collection('ve_monitor_domains');

      // Create indexes if they don't exist
      await domainsCollection.createIndex({ domain: 1, checkedAt: -1 });
      await domainsCollection.createIndex({ checkId: 1 });
      await domainsCollection.createIndex({ checkedAt: -1 });
      await checksCollection.createIndex({ checkedAt: -1 });

      // Insert check record
      const checkRecord = {
        checkedAt: new Date(),
        checkDuration,
        summary
      };
      const checkResult = await checksCollection.insertOne(checkRecord);
      const checkId = checkResult.insertedId;

      // Prepare domain records with checkId
      const domainRecords = results.map(r => ({
        checkId,
        checkedAt: r.checkedAt,
        domain: r.domain,
        status: r.status,
        httpCode: r.httpCode,
        responseTime: r.responseTime,
        error: r.error || null,
        ssl: r.ssl,
        headers: r.headers,
        redirects: r.redirects,
        finalUrl: r.finalUrl
      }));

      // Bulk insert domain records
      await domainsCollection.insertMany(domainRecords);

      console.log(`${C.green}Saved to MongoDB:${C.reset} 1 check + ${results.length} domain records`);

      // Get total count
      const totalChecks = await checksCollection.countDocuments();
      const totalDomainRecords = await domainsCollection.countDocuments();
      console.log(`${C.dim}Total in DB: ${totalChecks} checks, ${totalDomainRecords} domain records${C.reset}`);

      // Success - exit the retry loop
      return;

    } catch (err) {
      lastError = err;
      console.error(`${C.red}MongoDB Error (attempt ${attempt}):${C.reset} ${err.message}`);

      if (attempt < maxRetries) {
        const waitTime = attempt * 10; // 10s, 20s, 30s
        console.log(`${C.yellow}Retrying in ${waitTime}s...${C.reset}`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
    } finally {
      if (client) {
        try { await client.close(); } catch (e) {}
      }
    }
  }

  // All retries failed
  console.error(`${C.red}MongoDB Error:${C.reset} All ${maxRetries} attempts failed`);
  console.log(`${C.yellow}Continuing without MongoDB...${C.reset}`);
}

async function main() {
  console.log('\n=== Venezuela Digital Observatory - Status Check ===\n');

  // Load domains
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const domains = data.domains.map(d => d.domain);

  console.log(`Checking ${domains.length} domains...`);
  const rampEnabled = MAX_CONCURRENCY > CONCURRENCY;
  const rampText = rampEnabled
    ? ` (max ${MAX_CONCURRENCY}, slow ramp +${SLOW_RAMP_STEP}/${SLOW_RAMP_INTERVAL_MS}ms)`
    : ' (slow ramp disabled: set MAX_CONCURRENCY > CONCURRENCY)';
  console.log(`Request timeout: ${TIMEOUT_MS}ms, Fast-demote: ${FAST_TIMEOUT_MS}ms, Concurrency: ${CONCURRENCY}${rampText}\n`);
  const behaviorText = [
    FORCE_IPV4 ? 'IPv4 only' : 'IPv4/IPv6 auto',
    SKIP_DNS_RETRIES ? 'DNS retries off' : 'DNS retries on'
  ].join(', ');
  console.log(`Behavior: ${behaviorText}`);
  const logDetails = LOG_FILE ? `, file ${LOG_FILE}` : '';
  console.log(`Log mode: ${LOG_MODE}${logDetails}\n`);
  if (LOG_MODE !== 'progress') {
    console.log(
      `Legend: AVG=average response time (online only) | ` +
      `FAILS TIMEOUT=TIMEOUT/ETIMEDOUT | DNS=EAI_AGAIN/ENOTFOUND | RESET=ECONNRESET | OTHER=all other errors\n`
    );
  }

  const startTime = Date.now();
  const results = await processWithConcurrency(domains, CONCURRENCY);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Stats
  const online = results.filter(r => r.status === 'online');
  const offline = results.filter(r => r.status === 'offline');
  const withSSL = online.filter(r => r.ssl?.enabled === true);
  const validSSL = online.filter(r => r.ssl?.valid === true);
  const avgResponse = online.length > 0
    ? Math.round(online.reduce((sum, r) => sum + r.responseTime, 0) / online.length)
    : 0;

  const summary = {
    totalDomains: domains.length,
    online: online.length,
    offline: offline.length,
    withSSL: withSSL.length,
    validSSL: validSSL.length,
    avgResponseTime: avgResponse,
  };

  // Save to MongoDB
  await saveToMongoDB(results, summary, parseFloat(elapsed));

  // Output JSON file (for compatibility)
  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      ...summary,
      checkDuration: `${elapsed}s`,
    },
    domains: results.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
      return a.domain.localeCompare(b.domain);
    }),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // Summary
  console.log('\n=== Summary ===\n');
  console.log(`  ${C.green}Online:${C.reset}     ${online.length} (${Math.round(online.length/domains.length*100)}%)`);
  console.log(`  ${C.red}Offline:${C.reset}    ${offline.length} (${Math.round(offline.length/domains.length*100)}%)`);
  console.log(`  ${C.yellow}With SSL:${C.reset}   ${withSSL.length}`);
  console.log(`  ${C.yellow}Valid SSL:${C.reset}  ${validSSL.length}`);
  console.log(`  ${C.dim}Avg response:${C.reset} ${avgResponse}ms`);
  console.log(`  ${C.dim}Duration:${C.reset} ${elapsed}s`);
  console.log(`\n  Output: ${OUTPUT_FILE}\n`);
}

main().catch(console.error);
