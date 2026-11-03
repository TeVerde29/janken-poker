const http = require('http');
const { spawn } = require('child_process');

const targetRoom = process.argv[2] || 'P5CZ44';
const targetId = 'jankencards-' + targetRoom;

const html = `<!DOCTYPE html>
<html>
<head><script src="https://unpkg.com/peerjs@1/dist/peerjs.min.js"></script></head>
<body>
<script>
  const targetId = "${targetId}";
  const peer = new window.Peer();
  peer.on('open', (id) => {
    fetch('/log?m=' + encodeURIComponent('Guest open: ' + id));
    console.log('Connecting to: ' + targetId);
    const conn = peer.connect(targetId);
    conn.on('open', () => {
      fetch('/log?m=CONNECTED_TO_HOST');
    });
    conn.on('error', (e) => {
      fetch('/log?m=' + encodeURIComponent('Conn error: ' + e));
    });
  });
  peer.on('error', (e) => {
    fetch('/log?m=' + encodeURIComponent('Peer error: ' + e.type + ' - ' + e.message));
  });
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/log')) {
    console.log('[PROBE]', decodeURIComponent(req.url.substring(7)));
    res.end('ok');
    if (req.url.includes('CONNECTED') || req.url.includes('Peer error') || req.url.includes('Conn error')) {
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 500);
    }
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}).listen(3335, () => {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', 'http://localhost:3335']);
  setTimeout(() => {
    console.log('[PROBE TIMEOUT]');
    edge.kill();
    server.close();
    process.exit(1);
  }, 10000);
});
