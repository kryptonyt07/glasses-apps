// Record a promo clip of VIGIL from the real game.
//
// Chrome's --screenshot only gives one frame, and canvas.captureStream() only
// gives the canvas — which would lose the menu, the boss bar and the HP pips,
// i.e. exactly the half of the game the clip needs to sell. So this drives the
// page over the DevTools protocol and uses Page.startScreencast, which
// captures the composited page.
//
// No dependencies: node 22+ ships a WebSocket client, and CDP is just JSON
// over one socket.
//
//   node tools/vigil-clip.js [seconds]
'use strict';
const {spawn, execFileSync} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const SECS = Number(process.argv[2] || 15);
const VW = 480, VH = 820;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(os.homedir(), 'Desktop', 'vigil-itch', 'press');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'vigilclip-'));

// ── the performance ─────────────────────────────────────────────────────────
// A clip has to show the ONE idea: the menu with no clock on it, then the
// clock. So: hold on the choice long enough to read it, take the ten second
// option, survive it with a competent player, land the kill.
const PERF = `
<script>
window.addEventListener('load',()=>{
  setMuted(true);
  attract=false;
  stage=3; maxHp=5; hp=5; boons=[]; runStart=performance.now();
  beginBoss();
  bossHp=9;                       // one SURGE lands exactly lethal, and stage 3
  // is not the last boss, so the clip closes on HOUND DOWN / take a boon
  veil.className='';

  // A greedy dodger, the same one the difficulty harness uses: of nine
  // headings, take whichever keeps the worst-case approach largest over the
  // next half second. It plays like someone who knows the game, which is what
  // a promo clip needs and what a human recording it would not reliably give.
  const DIRS=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]];
  setInterval(()=>{
    if(!running) return;
    const top=boxTop()+7, k=265*SPD()*(1/60);
    let best=null, bs=-1e9;
    for(const [dx,dy] of DIRS){
      const nx=Math.max(7,Math.min(W-7,px+dx*k)), ny=Math.max(top,Math.min(H-7,py+dy*k));
      let worst=1e9;
      for(let f=1;f<=18;f+=3){
        const ft=f/60;
        for(const b of bullets){
          const d=Math.hypot(b.x+b.vx*ft-nx,b.y+b.vy*ft-ny)-b.r;
          if(d<worst) worst=d;
        }
        for(const bm of beams){
          const d=(bm.vert?Math.abs(nx-bm.pos):Math.abs(ny-bm.pos))-9;
          if(d<worst) worst=d;
        }
      }
      const room=Math.min(nx,W-nx,ny-top,H-ny);
      const s=Math.min(worst,90)+room*0.35;
      if(s>bs){bs=s;best=[nx,ny];}
    }
    px=best[0]; py=best[1];
  },16);

  // hold on the menu so the choice is readable, then take the long one
  setTimeout(()=>{
    const surge=[...menuEl.querySelectorAll('.act')].find(e=>e.textContent.includes('SURGE'));
    if(surge) surge.click();
  }, 2600);
});
</script>`;

const src = fs.readFileSync(path.join(__dirname, '..', 'vigil', 'index.html'), 'utf8');
const pageFile = path.join(WORK, 'clip.html');
fs.writeFileSync(pageFile, src + PERF);

// ── CDP ─────────────────────────────────────────────────────────────────────
const PORT = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${VW},${VH}`, '--force-device-scale-factor=2',
  `--user-data-dir=${path.join(WORK,'profile')}`,
  'about:blank',
], {stdio: 'ignore'});

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let list;
  for (let i = 0; i < 60; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; }
    catch (_) {}
    await sleep(250);
  }
  if (!list || !list.length) throw new Error('chrome never came up on the debugging port');
  const target = list.find(t => t.type === 'page');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({id: n, method, params}));
  });

  const frames = [];
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Page.screencastFrame') {
      frames.push({data: m.params.data, t: m.params.metadata.timestamp});
      send('Page.screencastFrameAck', {sessionId: m.params.sessionId});
    }
  });

  await send('Page.enable');
  await send('Page.navigate', {url: 'file://' + pageFile});
  await sleep(1400);                       // let the game boot and settle
  await send('Page.startScreencast', {format: 'jpeg', quality: 92, everyNthFrame: 1});
  await sleep(SECS * 1000);
  await send('Page.stopScreencast');
  ws.close(); chrome.kill();

  if (frames.length < 30) throw new Error(`only ${frames.length} frames captured; screencast did not run`);

  // Frames arrive when the compositor produces them, not on a fixed clock, so
  // hold each one for its measured duration rather than assuming a rate.
  const dir = path.join(WORK, 'f'); fs.mkdirSync(dir);
  const lines = [];
  frames.forEach((f, i) => {
    const p = path.join(dir, String(i).padStart(5, '0') + '.jpg');
    fs.writeFileSync(p, Buffer.from(f.data, 'base64'));
    const dur = i < frames.length - 1 ? Math.max(0.008, frames[i + 1].t - f.t) : 0.033;
    lines.push(`file '${p}'`, `duration ${dur.toFixed(4)}`);
  });
  lines.push(`file '${path.join(dir, String(frames.length - 1).padStart(5, '0') + '.jpg')}'`,
             'duration 1.4',
             `file '${path.join(dir, String(frames.length - 1).padStart(5, '0') + '.jpg')}'`);
  const concat = path.join(WORK, 'concat.txt');
  fs.writeFileSync(concat, lines.join('\n'));

  fs.mkdirSync(OUT, {recursive: true});
  const mp4 = path.join(OUT, 'vigil-clip.mp4');
  const gif = path.join(OUT, 'vigil-clip.gif');
  const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);

  ff(['-f', 'concat', '-safe', '0', '-i', concat, '-fps_mode', 'cfr', '-r', '30',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', mp4]);

  const pal = path.join(WORK, 'pal.png');
  ff(['-i', mp4, '-vf', 'fps=16,scale=360:-1:flags=lanczos,palettegen=stats_mode=diff', pal]);
  ff(['-i', mp4, '-i', pal, '-lavfi',
      'fps=16,scale=360:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=3', gif]);

  const span = frames[frames.length - 1].t - frames[0].t;
  console.log(`${frames.length} frames over ${span.toFixed(1)}s (${(frames.length/span).toFixed(1)} fps)`);
  for (const f of [mp4, gif]) console.log(`  ${f}  ${(fs.statSync(f).size/1048576).toFixed(2)} MB`);
  fs.rmSync(WORK, {recursive: true, force: true});
})().catch(e => { try{chrome.kill();}catch(_){}; console.error('clip failed:', e.message); process.exit(1); });
