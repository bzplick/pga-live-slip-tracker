const ESPN='https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';
const target=/memorial/i;
function score(x){ if(x==null||x==='') return null; const s=String(x).trim().replace('−','-'); if(['E','EVEN','-'].includes(s.toUpperCase())) return 0; const n=parseInt(s.replace('+',''),10); return Number.isFinite(n)?n:null; }
function fmt(n){ if(n==null) return ''; return n===0?'E':(n>0?'+'+n:String(n)); }
function pickEvent(data){ return (data.events||[]).find(e=>target.test(e.name||e.shortName||'')) || (data.events||[])[0]; }
function normalize(data){
  const ev=pickEvent(data);
  const comp=ev?.competitions?.[0];
  const comps=comp?.competitors || [];
  const parsed=comps.map(c=>{
    const rounds=(c.linescores||[]).filter(r=>r && (r.displayValue!=null || r.value!=null || r.linescores));
    const active=[...rounds].reverse().find(r=>r.displayValue!=null || r.value!=null || (r.linescores||[]).length) || {};
    const thru=Array.isArray(active.linescores)?active.linescores.length:(active.thru||active.period||0);
    const today=score(active.displayValue ?? active.scoreType?.displayValue ?? active.value);
    const total=score(c.score ?? c.displayValue);
    const status=String(c.status?.type?.name||c.status?.displayName||'').toLowerCase();
    return {
      player:c.athlete?.displayName||c.athlete?.fullName||c.displayName||'',
      position:null,
      total:fmt(total),
      totalScore:total,
      roundScore:fmt(today),
      todayScore:today,
      thru:thru>=18?'F':(thru||''),
      round:active.period || rounds.length || '',
      order:Number(c.order||9999),
      missedCut:status.includes('cut')||status.includes('wd')||status.includes('dq')||(today!=null&&today>5)
    };
  }).filter(p=>p.player).sort((a,b)=>(a.totalScore??999)-(b.totalScore??999)||a.order-b.order);
  const ties={};
  parsed.forEach(p=>{ if(p.totalScore==null){p.position='—'; return;} const rank=1+parsed.filter(x=>(x.totalScore??999)<p.totalScore).length; p.position=rank; ties[rank]=(ties[rank]||0)+1; });
  parsed.forEach(p=>{ if(typeof p.position==='number') p.position=(ties[p.position]>1?'T':'')+p.position; });
  return {updatedAt:new Date().toISOString(), eventId:ev?.id||'', eventName:ev?.name||'', source:ESPN, players:parsed};
}
const res=await fetch(ESPN,{headers:{'user-agent':'Mozilla/5.0'}});
if(!res.ok) throw new Error('ESPN '+res.status);
const data=await res.json();
const out=normalize(data);
if(!out.players.length) throw new Error('No leaderboard competitors found');
await import('node:fs/promises').then(fs=>fs.writeFile('leaderboard.json', JSON.stringify(out,null,2)+'\n'));
console.log(`Wrote ${out.players.length} players for ${out.eventName}`);
