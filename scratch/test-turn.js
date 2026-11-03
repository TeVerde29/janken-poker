const http = require('http');
const { spawn } = require('child_process');

const html = `<!DOCTYPE html>
<html><body><script>
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
    ]
  });
  pc.createDataChannel('test');
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      fetch('/log?c=' + encodeURIComponent(e.candidate.candidate));
    } else {
      fetch('/log?done=1');
    }
  };
  pc.onicecandidateerror = (e) => {
    fetch('/log?err=' + encodeURIComponent(e.url + ' ' + e.errorCode + ' ' + e.errorText));
  };
  pc.createOffer().then(o => pc.setLocalDescription(o));
</script></body></html>`;

const server = http.createServer((req, res) => {
  console.log('[ICE]', decodeURIComponent(req.url));
  res.end('ok');
  if (req.url.includes('done=1')) {
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  }
}).listen(3338, () => {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', 'http://localhost:3338']);
});
