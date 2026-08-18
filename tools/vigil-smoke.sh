#!/usr/bin/env bash
# Runtime smoke test for vigil. `node --check` only proves the file PARSES —
# that is how an undeclared variable once shipped and broke the BEGIN button.
# This actually runs the game: intro, a full run through all five bosses with
# every action, every boon, and both endings.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS/.."
python3 -c "
import re
s=open('vigil/index.html').read()
js=''.join(re.findall(r'<script>(.*?)</script>', s, re.S))
open('/tmp/_vigil_game.js','w').write(js)
"
node -e "
$(cat "$TOOLS/dom-shim.js")
let RAF=[]; global.requestAnimationFrame=f=>{RAF.push(f);return RAF.length;};
global.cancelAnimationFrame=()=>{};
global.setInterval=()=>0; global.clearInterval=()=>{}; global.setTimeout=(f)=>0;
global.performance={now:()=>Date.now()};
$(cat /tmp/_vigil_game.js)
let f=[];
const pump=n=>{ for(let i=0;i<n;i++){ const q=RAF; RAF=[]; if(!q.length) break;
                  for(const fn of q){ try{ fn(performance.now()); }catch(e){ throw e; } } } };
try{ intro(); pump(30); }catch(e){ f.push('intro: '+e.message); }
try{ newRun(); }catch(e){ f.push('newRun: '+e.message); }
try{ for(const a of ACTS){ startPhase(phaseLen(a)); pump(400); } }catch(e){ f.push('phases: '+e.message); }
try{ for(const b of ['hp','dmg','small','fast','ward','brief']){
       boons=[b]; newRun(); startPhase(phaseLen(ACTS[0])); pump(200); }
   }catch(e){ f.push('boon '+e.message); }
try{ for(let st=0; st<BOSSES.length; st++){ stage=st; beginBoss();
       startPhase(phaseLen(ACTS[2])); pump(700); } }catch(e){ f.push('bosses: '+e.message); }
try{ clampPlayer(); drawBox(); stepBoss(0.016);
     if(!(bx>=64&&bx<=W-64)) f.push('drift left the arena: '+bx);
     by=150; px=10; py=0; clampPlayer();
     if(py < boxTop()) f.push('clampPlayer let the player above the box ceiling');
   }catch(e){ f.push('box: '+e.message); }
try{ music('fight'); music('calm'); music('off'); setMuted(true); setMuted(false);
     playStep(0,0); playStep(4,0); playStep(12,0); scheduler();
   }catch(e){ f.push('audio: '+e.message); }
// the paths that reach for the one-shot sounds. noise() went missing in an
// audio rewrite and nothing here called it, so it shipped past the smoke test.
try{ newRun(); strikeAnim(2,()=>{}); pump(120);
     strikeAnim(0,()=>{}); pump(120);
     bossHp=0; killBoss(); pump(200);
     takeHit(); shield=true; takeHit();
   }catch(e){ f.push('impacts: '+e.message); }
try{ noise(.1,.05); kick(0,.5); snare(0,.2); hat(0,.05,true); beep(200,.1,'square',.05);
   }catch(e){ f.push('sfx: '+e.message); }
try{ endRun(true); endRun(false); }catch(e){ f.push('endings: '+e.message); }
if(f.length){ console.error('SMOKE FAILED:\n  '+f.join('\n  ')); process.exit(1); }
console.log('vigil smoke OK');
"
