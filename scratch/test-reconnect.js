const http = require('http');
const { spawn } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head><script src="https://unpkg.com/peerjs@1/dist/peerjs.min.js"></script></head>
<body>
<script>
  const log = (m) => fetch('/log?m=' + encodeURIComponent(m));

  async function test() {
    const id = 'jankencards-RECON' + Math.floor(Math.random() * 1000);
    const peer = new window.Peer(id);
    peer.on('open', (openedId) => {
      log('Host opened with id: ' + openedId);
      // Now simulate disconnect
      log('Simulating disconnect in 1s...');
      setTimeout(() => {
        peer.disconnect();
      }, 1000);
    });

    peer.on('disconnected', () => {
      log('Host disconnected! Calling peer.reconnect()...');
      try {
        peer.reconnect();
        log('peer.reconnect() called successfully');
      } catch (err) {
        log('peer.reconnect() threw: ' + err.message);
      }
    });

    peer.on('error', (err) => {
      log('Host error: ' + err.type + ' - ' + err.message);
    });
  }

  test();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/log')) {
    console.log('[RECONNECT TEST]', decodeURIComponent(req.url.substring(7)));
    res.end('ok');
    if (req.url.includes('called successfully') || req.url.includes('threw')) {
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 3000);
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}).listen(3337, () => {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', 'http://localhost:3337']);
});
