const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://unpkg.com/peerjs@1/dist/peerjs.min.js"></script>
</head>
<body>
  <h1>PeerJS Test</h1>
  <script type="module">
    const log = (msg) => {
      console.log(msg);
      fetch('/log', { method: 'POST', body: msg }).catch(() => {});
    };

    window.onerror = (e, src, line, col, err) => {
      log('WINDOW ERROR: ' + e + ' at ' + line + ':' + col + ' ' + (err?.stack || ''));
    };

    window.onunhandledrejection = (e) => {
      log('UNHANDLED REJECTION: ' + (e.reason?.stack || e.reason || e));
    };

    async function run() {
      log('Browser test script started');
      if (typeof window.Peer !== 'function') {
        log('ERROR: window.Peer is missing');
        return;
      }
      log('PeerJS loaded successfully: ' + window.Peer.name);

      const PEER_PREFIX = 'jankencards-';
      const code = 'TEST' + Math.floor(1000 + Math.random() * 9000);
      const hostId = PEER_PREFIX + code;

      const opts = {
        debug: 3,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            {
              urls: [
                'turn:eu-0.turn.peerjs.com:3478',
                'turn:us-0.turn.peerjs.com:3478',
              ],
              username: 'peerjs',
              credential: 'peerjsp',
            },
          ],
          sdpSemantics: 'unified-plan',
        },
      };

      log('Creating host peer with ID: ' + hostId);
      const host = new window.Peer(hostId, opts);

      host.on('open', (id) => {
        log('Host peer OPEN with id: ' + id);
        startGuest(id);
      });

      host.on('error', (err) => {
        log('Host peer ERROR: ' + err.type + ' - ' + err.message);
      });

      host.on('connection', (conn) => {
        log('Host received connection from: ' + conn.peer);
        conn.on('open', () => {
          log('Host data connection OPEN! Sending room-config...');
          conn.send({ type: 'room-config', mode: 'classic' });
        });
        conn.on('data', (d) => {
          log('Host received data: ' + JSON.stringify(d));
        });
        conn.on('error', (err) => log('Host conn error: ' + err));
      });

      function startGuest(targetId) {
        log('Starting guest...');
        const guest = new window.Peer(opts);
        guest.on('open', (id) => {
          log('Guest peer OPEN with id: ' + id);
          log('Guest connecting to host ' + targetId);
          const conn = guest.connect(targetId, { reliable: true, serialization: 'json' });
          conn.on('open', () => {
            log('Guest data connection OPEN! Sending join packet...');
            conn.send({ type: 'join', name: 'Tester' });
          });
          conn.on('data', (d) => {
            log('Guest received data: ' + JSON.stringify(d));
            log('SUCCESS: Full 2-way WebRTC communication verified!');
            setTimeout(() => {
              fetch('/done', { method: 'POST', body: 'OK' }).catch(() => {});
            }, 1000);
          });
          conn.on('error', (err) => log('Guest conn error: ' + err));
          conn.on('close', () => log('Guest conn closed'));
        });
        guest.on('error', (err) => log('Guest peer error: ' + err.type + ' - ' + err.message));
      }
    }

    run().catch(e => log('Fatal: ' + e));
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
  } else if (req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('[BROWSER]', body);
      res.writeHead(200);
      res.end('ok');
    });
  } else if (req.url === '/done') {
    console.log('[ALL DONE]');
    res.writeHead(200);
    res.end('ok');
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3333, () => {
  console.log('Test server listening on http://localhost:3333');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const child = spawn(edgePath, ['--headless=new', 'http://localhost:3333'], { stdio: 'ignore' });
  child.on('error', (err) => console.error('Edge launch error:', err));
  setTimeout(() => {
    console.log('Timeout reached (20s)');
    child.kill();
    server.close();
    process.exit(1);
  }, 20000);
});
