const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const net = require('net');
const http = require('http');
const { startServer, gracefulShutdown, getIsShuttingDown, resetShutdownState } = require('../../src/index');
const db = require('../../src/database');
const { config } = require('../../src/config/env');

describe('Unit Tests: Server Lifecycle, Startup & Graceful Shutdown', () => {
  let originalPort;
  let originalClosePool;
  let originalCheckConnection;
  let closePoolCalled = false;

  beforeEach(() => {
    resetShutdownState();
    originalPort = config.port;
    originalClosePool = db.closePool;
    originalCheckConnection = db.checkConnection;
    closePoolCalled = false;

    db.checkConnection = async () => ({ connected: true, alive: true });
    db.closePool = async () => {
      closePoolCalled = true;
    };
  });

  afterEach(() => {
    config.port = originalPort;
    db.closePool = originalClosePool;
    db.checkConnection = originalCheckConnection;
    resetShutdownState();
  });

  test('gracefulShutdown closes HTTP server and closes DB pool', async () => {
    let serverClosed = false;
    const mockServer = {
      close: (cb) => {
        serverClosed = true;
        cb();
      },
    };

    assert.strictEqual(getIsShuttingDown(), false);
    await gracefulShutdown('SIGTERM', mockServer);

    assert.strictEqual(getIsShuttingDown(), true);
    assert.strictEqual(serverClosed, true);
    assert.strictEqual(closePoolCalled, true);
  });

  test('gracefulShutdown is idempotent: second signal is safely ignored', async () => {
    let closeCallCount = 0;
    const mockServer = {
      close: (cb) => {
        closeCallCount++;
        cb();
      },
    };

    await gracefulShutdown('SIGTERM', mockServer);
    assert.strictEqual(closeCallCount, 1);

    // Send second signal
    await gracefulShutdown('SIGINT', mockServer);
    assert.strictEqual(closeCallCount, 1, 'Server.close must not be called again on repeated signal');
  });

  test('gracefulShutdown drains in-flight requests cleanly', async () => {
    let inFlightFinished = false;

    // Create an HTTP server that tracks active connections and finishes in-flight responses
    const sockets = new Set();
    const server = http.createServer((req, res) => {
      res.setHeader('Connection', 'close');
      setTimeout(() => {
        inFlightFinished = true;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('done');
      }, 50);
    });

    server.on('connection', (sock) => {
      sockets.add(sock);
      sock.on('close', () => sockets.delete(sock));
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    // Send in-flight request
    const reqPromise = new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/',
          method: 'GET',
          agent: false,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => resolve(body));
        }
      );
      req.on('error', reject);
      req.end();
    });

    // Wait until server has accepted connection
    while (sockets.size === 0) {
      await new Promise((r) => setTimeout(r, 5));
    }

    // Initiate shutdown while request is active
    const shutdownPromise = gracefulShutdown('SIGTERM', server);

    const [body] = await Promise.all([reqPromise, shutdownPromise]);
    assert.strictEqual(body, 'done');
    assert.strictEqual(inFlightFinished, true);
    assert.strictEqual(closePoolCalled, true);
  });

  test('startServer handles port collision (EADDRINUSE) with clear error', async () => {
    // Occupy a random free port first
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const occupiedPort = blocker.address().port;

    config.port = occupiedPort;
    config.host = '127.0.0.1';

    try {
      await assert.rejects(
        async () => {
          await startServer();
        },
        (err) => {
          assert.strictEqual(err.code, 'EADDRINUSE');
          return true;
        }
      );
    } finally {
      await new Promise((resolve) => blocker.close(resolve));
    }
  });
});
