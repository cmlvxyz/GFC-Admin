// dev.js - runs the GFC-ADMIN backend + vite dev server together
import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const viteBin = path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

// Hanapin ang LAN IPv4 ng PC para i-point ang QR/upload link sa isang address na
// maaabot ng phone (same WiFi), kahit localhost ang pagbukas ng admin.
function getLanIPv4() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push(net);
    }
  }
  const priv = candidates.filter(n =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address) && !/^169\.254\./.test(n.address)
  );
  return (priv[0]?.address) || (candidates[0]?.address) || '';
}

const children = [];
let shutting = false;

function shutdown(code) {
  if (shutting) return;
  shutting = true;
  for (const c of children) {
    if (!c.killed) {
      try { c.kill(); } catch { /* ignore */ }
    }
  }
  setTimeout(() => process.exit(code ?? 0), 400);
}

function watch(child, name) {
  child.on('exit', (code, signal) => {
    console.log(`[dev] ${name} exited (code=${code}, signal=${signal})`);
    if (!shutting) {
      if (signal !== 'SIGTERM' && code !== 0) {
        console.error(`[dev] ${name} crashed. Stopping everything...`);
      }
      shutdown(code || 0);
    }
  });
}

const viteArgs = ['--port=3003', '--host=0.0.0.0'];
if (process.env.GFC_NO_OPEN !== '1') viteArgs.push('--open');

// Auto-set ang base URL ng QR/upload sa LAN IP (hindi na kailangan i-edit ang .env)
const viteEnv = { ...process.env };
if (!viteEnv.VITE_GFC_URL) {
  const lanIp = getLanIPv4();
  if (lanIp) {
    viteEnv.VITE_GFC_URL = `http://${lanIp}:4000`;
    console.log(`[dev] QR/upload link points to: http://${lanIp}:4000 (phone, same WiFi)`);
    console.log(`[dev]   admin: http://${lanIp}:3003  |  upload: http://${lanIp}:4000/upload`);
  } else {
    console.warn('[dev] Hindi mahanap ang LAN IP - set VITE_GFC_URL sa .env.development');
  }
}

const server = spawn(process.execPath, ['server.js'], { cwd: __dirname, stdio: 'inherit' });
const vite = spawn(process.execPath, [viteBin, ...viteArgs], { cwd: __dirname, stdio: 'inherit', env: viteEnv });

children.push(server, vite);
watch(server, 'backend (server.js)');
watch(vite, 'vite (admin)');

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
process.on('SIGBREAK', () => shutdown());
process.on('exit', () => {
  for (const c of children) {
    if (!c.killed) { try { c.kill(); } catch { /* ignore */ } }
  }
});