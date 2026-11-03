const http = require('http');
const { spawn } = require('child_process');

const html = `<!DOCTYPE html>
<html><body><script>
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  });
  pc.createDataChannel('test');
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      console.log('Candidate:', e.candidate.type, e.candidate.candidate);
      fetch('/log?t=' + e.candidate.type + '&c=' + encodeURIComponent(e.candidate.candidate));
    } else {
      console.log('Gathering complete');
      fetch('/done');
    }
  };
  pc.onicecandidateerror = (e) => {
    fetch('/err?u=' + encodeURIComponent(e.url) + '&code=' + e.errorCode + '&text=' + encodeURIComponent(e.errorText));
  };
  pc.createOffer().then(o => pc.setLocalDescription(o));
</script></body></html>`;

const server = http.createServer((req, res) => {
  console.log('[ICE]', decodeURIComponent(req.url));
  res.end('ok');
  if (req.url === '/done') {
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  }
}).listen(3339, () => {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', 'http://localhost:3339']);
});
