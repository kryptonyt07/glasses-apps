#!/usr/bin/env bash
# Runtime smoke test for vigil. `node --check` only proves the file PARSES —
# that is how an undeclared variable once shipped and broke the BEGIN button.
# This actually runs the game: intro, a full run through all five bosses with
# every action, every boon, and both endings.
set -e
TOOLS="$(cd "$(dirname "$0")" && pwd)"
cd "$TOOLS/.."
VIGIL_HTML="${VIGIL_HTML:-vigil/index.html}" python3 -c "
import re
import os
s=open(os.environ.get('VIGIL_HTML','vigil/index.html')).read()
js=''.join(re.findall(r'<script>(.*?)</script>', s, re.S))
open('/tmp/_vigil_game.js','w').write(js)
"
node -e "
$(cat "$TOOLS/dom-shim.js")
let RAF=[]; global.requestAnimationFrame=f=>{RAF.push(f);return RAF.length;};
global.cancelAnimationFrame=()=>{};
global.setInterval=()=>0; global.clearInterval=()=>{}; global.setTimeout=(f)=>0;
// A FAKE clock. With the real one, pumping frames in a tight loop never
// advances time past phaseEnd, so a phase could never actually finish and the
// most important path in the game went untested.
let T=1000; global.performance={now:()=>T};
const tick=ms=>{T+=ms;};
$(cat /tmp/_vigil_game.js)
let f=[];
const pump=(n,step)=>{ for(let i=0;i<n;i++){ const q=RAF; RAF=[]; if(!q.length) break;
                  tick(step==null?16:step);
                  for(const fn of q){ fn(performance.now()); } } };
try{ intro(); pump(30); }catch(e){ f.push('intro: '+e.message); }
try{ newRun(); }catch(e){ f.push('newRun: '+e.message); }
// invuln for the harness only: the dummy never moves, so without it every
// phase ends in death and nothing past frame() is ever reached.
const immortal=()=>{ iframeUntil=1e15; };
try{ for(const a of ACTS){ pending=a; startPhase(phaseLen(a)); immortal(); pump(900); } }
catch(e){ f.push('phases: '+e.message); }

// THE ORDERING. Damage used to land the moment you picked, which let SURGE kill
// a small boss before its dodge phase ever ran. The whole fight now hangs on
// the blow landing at the END, so assert it rather than trusting it.
try{
  stage=0; beginBoss();
  const surge=ACTS.find(a=>a.k==='surge'), hp0=bossHp;
  pending=surge; startPhase(phaseLen(surge)); immortal();
  pump(120);
  if(bossHp!==hp0) f.push('damage landed DURING the phase: '+hp0+' -> '+bossHp);
  immortal();
  pump(1200);                       // run past phaseEnd into endPhase
  pump(200);                        // and through strikeAnim
  if(bossHp>=hp0) f.push('damage never landed after the phase: still '+bossHp);
  if(pending!==null) f.push('pending action was not cleared');
}catch(e){ f.push('ordering: '+e.message); }

// No boss may fall to a single SURGE, or the big swing skips the fight.
try{
  const surge=ACTS.find(a=>a.k==='surge'), strike=ACTS.find(a=>a.k==='strike');
  for(const b of BOSSES){
    if(b.hp<=surge.dmg) f.push(b.name+' dies to one SURGE ('+b.hp+'hp vs '+surge.dmg+')');
    if(Math.ceil(b.hp/strike.dmg)>14) f.push(b.name+' is a '+Math.ceil(b.hp/strike.dmg)+'-phase STRIKE grind');
  }
}catch(e){ f.push('hp shape: '+e.message); }
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
