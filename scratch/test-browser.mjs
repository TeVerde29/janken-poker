import { spawn } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const proc = spawn(edgePath, [
  '--headless',
  '--dump-dom',
  '--enable-logging=stderr',
  '--v=1',
  'https://teverde29.github.io/janken-poker/'
]);

let out = '';
let err = '';

proc.stdout.on('data', (d) => { out += d.toString(); });
proc.stderr.on('data', (d) => { err += d.toString(); });

proc.on('close', (code) => {
  console.log('Exit code:', code);
  console.log('DOM length:', out.length);
  console.log('Stderr (logs):', err.slice(0, 1000));
});
