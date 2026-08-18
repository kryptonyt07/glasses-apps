#!/usr/bin/env bash
# Runtime smoke test for warden. `node --check` only validates SYNTAX, which is
# why an undeclared `reeling` shipped and broke the BEGIN button: the file
# parsed perfectly and threw on first click. This actually RUNS the game.
set -e
cd "$(dirname "$0")/.."
python3 -c "
import re
s=open('warden/index.html').read()
js=''.join(re.findall(r'<script>(.*?)</script>', s, re.S))
open('/tmp/_warden_game.js','w').write(js)
"
node -e "
$(cat "$(dirname "$0")/dom-shim.js")
$(cat /tmp/_warden_game.js)
let f=[];
try{ newRun(); }catch(e){ f.push('start: '+e.message); }
try{ for(let i=0;i<40&&!over;i++){const o=reachable();const p=o[Math.floor(Math.random()*o.length)];busy=false;step(p[0],p[1]);} }catch(e){ f.push('play: '+e.message); }
try{ for(const b of ['hp','heal','dmg','reach','sight','shield']){ boons=[b]; newRun();
       for(let i=0;i<10&&!over;i++){const o=reachable();busy=false;step(o[0][0],o[0][1]);} } }catch(e){ f.push('boon '+e.message); }
try{ died(); died(true); cleared(); runWon(); intro(); }catch(e){ f.push('screens: '+e.message); }
if(f.length){ console.error('SMOKE FAILED:\n  '+f.join('\n  ')); process.exit(1); }
console.log('smoke OK');
"
