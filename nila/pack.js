/* ===== Nila Report Book: one Excel = one full report ===== */
"use strict";
const MONTH_HEAD=/^[A-Za-z]{3,9}[\s\-'’]*\d{2,4}$/;
const isMonthHead=c=>(MONTH_HEAD.test(String(c).trim())&&!!toISO(String(c).trim()))||/^\d{4}-\d{2}$/.test(String(c).trim());
const monthKey=c=>{const s=String(c).trim();return /^\d{4}-\d{2}$/.test(s)?s:toISO(s).slice(0,7)};
const BAD_DIR=/cancel|refund|complaint|issue|fail|escalat|reject|delay|breach|tat\b/i;

/* how Nila reads each report type */
const LENS={
  'Red Deal / offers revenue':{title:'Red Deal lens',text:'Red Deal % is a share of seats, so totals are never added up. Overall = seats ÷ seats from the raw data, and the month view uses the monthly average. A BO is incremental when its % grows from the start month to the end month.',good:1},
  'LQS / quality score':{title:'LQS lens',text:'Scores are averaged, never added. Watch who slips below the region and who improves month on month.',good:1},
  'YB / BC':{title:'YB / BC lens',text:'Shares are averaged, counts are added. Month-on-month change shows who is moving.',good:1},
  'Service information':{title:'Service lens',text:'For complaints and failures, lower is better, so a drop is shown as an improvement.',good:-1},
  'KAM dashboard':{title:'KAM lens',text:'Your accounts against region and India, month by month.',good:1}};
const lensOf=t=>LENS[t]||{title:'Smart lens',text:'Percentages are averaged, amounts are added, IDs are kept as codes. Pick the months to compare and Nila marks who went up and who went down.',good:1};

/* ---------- import ---------- */
function packRole(t){const mc=t.cols.filter(isMonthHead);if(mc.length>=2)return'matrix';const dc=t.cols.filter(c=>t.types[c]==='date');if(dc.length&&t.rows.length>=20)return'raw';return'table'}
async function importPack(items){const p=pending;const btn=$('#imPack');const sel=items.filter(x=>x.cb.checked&&x.t.rows.length);if(!sel.length){toast('Pick at least one sheet');return}
  btn.disabled=true;const sig=sel.map(x=>x.n).sort().join('|');
  const old=S.datasets.filter(d=>!d.demo&&d.pack&&d.pack.sig===sig);const pid=old[0]?old[0].pack.id:newId();const pname=old[0]?old[0].pack.name:baseOf(p.file);
  if(S.demo)clearDemo(true);const done=[];
  try{for(const [i,x] of sel.entries()){btn.textContent=`Saving ${i+1} of ${sel.length}…`;const t=x.t;const role=packRole(t);
      const dc=role==='raw'?bestDateCol(t.cols,t.types,t.rows):'';
      const meta={type:x.type.value,units:t.units||{},operatorCol:guessOpCol(t.cols,t.types,t.rows),dateCol:dc,note:'Sheet: '+x.n+' of '+p.file,space:p.space||'',pack:{id:pid,name:pname,sheet:x.n,role,order:i,sig,file:p.file}};
      const ex=old.find(d=>d.pack.sheet===x.n);let rows=t.rows,cols=t.cols,types={...t.types};
      if(ex&&role==='raw'&&dc&&ex.dateCol){const prev=await loadRows(ex);cols=[...ex.columns];for(const c of t.cols)if(!cols.includes(c))cols.push(c);types={...ex.types,...t.types};const nd=t.rows.map(r=>r[dc]).filter(Boolean).sort();const lo=nd[0],hi=nd.at(-1);rows=prev.filter(r=>{const d=r[ex.dateCol];return!(d&&d>=lo&&d<=hi)}).concat(t.rows)}
      const id=ex?ex.id:newId();const ds=await writeDataset(id,{name:`${pname} · ${x.n}`,...meta,columns:cols,types},rows,ex,p.file+' / '+x.n,t.rows.length);
      S.rows[id]=rows;S.datasets=[ds,...S.datasets.filter(d=>d.id!==id)];done.push(`${x.n}: ${nf.format(rows.length)} rows · ${role==='raw'?'raw data, deep dive':role==='matrix'?'month table':'table'}`)}
    p.box.replaceChildren(h('div',{class:'banner ok',style:'flex-direction:column;align-items:flex-start;gap:4px'},h('b',{},`${old.length?'Updated':'Saved'} "${pname}" as one report with ${done.length} sheets`),...done.map(x=>h('span',{class:'small'},'• '+x)),h('button',{class:'btn sm primary',style:'margin-top:6px',onclick:()=>openPack(pid)},'Open the report in Studio')));
    pending=null;S.gapsScanned=false;renderAll();computeMovers();if(S.view==='studio'){ST.packId=pid;studioView()}}
  catch(e){console.error(e);toast(e&&e.code?dbErr(e):'Could not save. Try again.');btn.disabled=false;btn.textContent='Import as one report'}}
function bestDateCol(cols,types,rows){const d=cols.filter(c=>types[c]==='date');let best='',n=-1;for(const c of d){const k=new Set(rows.slice(0,5000).map(r=>r[c]).filter(Boolean)).size;if(k>n){n=k;best=c}}return best}
function packList(){const by=new Map();for(const d of S.datasets){if(!d.pack||!d.pack.id)continue;const p=by.get(d.pack.id)||{id:d.pack.id,name:d.pack.name,members:[]};p.members.push(d);by.set(d.pack.id,p)}for(const p of by.values())p.members.sort((a,b)=>(a.pack.order||0)-(b.pack.order||0));return[...by.values()]}
function openPack(pid){closeSheet();ST.packId=pid;lsSet('nila.studio.last','pack:'+pid);go('studio')}
function packCard(pid){const p=packList().find(x=>x.id===pid);if(!p)return'';const rows=p.members.reduce((a,d)=>a+(d.rowCount||0),0);const raw=p.members.find(d=>d.pack.role==='raw');
  return h('div',{class:'ds pack-ds'},h('div',{class:'row between'},h('span',{class:'ds-name'},'📘 ',p.name),h('span',{class:'row',style:'gap:6px'},h('span',{class:'chip gold'},'One report'),h('span',{class:'chip teal'},p.members[0].type))),
    h('div',{class:'small muted mono'},p.members.length,' sheets · ',nf.format(rows),' rows',raw&&raw.minDate?` · ${prettyY(raw.minDate)} → ${prettyY(raw.maxDate)}`:'',' · updated ',pretty((p.members[0].updatedAt||'').slice(0,10))),
    h('div',{class:'colnames'},p.members.map(d=>h('span',{},d.pack.sheet,' · ',d.pack.role==='raw'?'raw':d.pack.role==='matrix'?'months':'table'))),
    h('div',{class:'row'},h('button',{class:'btn sm primary',onclick:()=>openPack(pid)},'Open in Studio'),h('button',{class:'btn sm',onclick:()=>{const box=h('div',{});openSheet('Update '+p.name,h('p',{class:'small muted'},'Upload the new Excel with the same sheets. Raw data merges by date, summary sheets are replaced.'),studioDrop(box),box)}},'Upload new week'),
      h('button',{class:'btn sm danger',onclick:()=>confirmSheet('Delete report?',`${p.name} and all ${p.members.length} sheets will be removed.`,'Delete',async()=>{for(const d of p.members)await deleteDs(d)})},'Delete')))}

/* ---------- models ---------- */
function matrixModel(ds,rows){const months=ds.columns.filter(isMonthHead).map(c=>({c,k:monthKey(c)})).sort((a,b)=>a.k.localeCompare(b.k));
  const types=ds.types||{};const units=ds.units||{};const mset=new Set(months.map(x=>x.c));
  const text=ds.columns.filter(c=>!mset.has(c)&&types[c]==='text');const idCol=text.find(c=>ID_RE.test(c))||'';
  const nameCol=text.filter(c=>c!==idCol).sort((a,b)=>new Set(rows.map(r=>r[b])).size-new Set(rows.map(r=>r[a])).size)[0]||idCol;
  const extra=ds.columns.filter(c=>!mset.has(c)&&types[c]==='number');const pct=months.some(x=>units[x.c]==='pct');
  let section=nameCol;const ents=[];const sections=[];
  for(const r of rows){const vals={};let any=false;for(const m of months){const v=r[m.c];if(typeof v==='number'){vals[m.k]=v;any=true}}
    const name=r[nameCol]!=null?String(r[nameCol]):'';if(!any){if(name&&!extra.some(c=>typeof r[c]==='number')){section=name;continue}if(!name)continue}
    if(!sections.includes(section))sections.push(section);
    const id=idCol&&r[idCol]!=null?String(r[idCol]):'';ents.push({key:id||name,id,name:name||id,section,vals,extra:Object.fromEntries(extra.map(c=>[c,r[c]])),total:/^(grand )?total$/i.test(name)})}
  const others=text.filter(c=>c!==idCol&&c!==nameCol);
  return{ds,months:months.map(x=>x.k),idCol,nameCol,extra,others,unit:pct?'pct':'num',ents,sections,row:r=>r}}
function rawModel(ds,rows){const types=ds.types||{};const dateCol=ds.dateCol&&types[ds.dateCol]==='date'?ds.dateCol:bestDateCol(ds.columns,types,rows);
  const text=ds.columns.filter(c=>types[c]==='text');const idCol=text.find(c=>ID_RE.test(c))||'';
  const nameCol=text.filter(c=>c!==idCol&&/name|operator|travels|bo\b|account|partner/i.test(c))[0]||text.filter(c=>c!==idCol).sort((a,b)=>new Set(rows.map(r=>r[b])).size-new Set(rows.map(r=>r[a])).size)[0]||'';
  const keyCol=idCol||nameCol;const nums=ds.columns.filter(c=>types[c]==='number');
  const names=new Map();const KM=new Map(),M=new Map(),KD=new Map(),D=new Map();
  const add=(map,k,r)=>{let o=map.get(k);if(!o){o={_n:0};map.set(k,o)}o._n++;for(const c of nums){const v=r[c];if(typeof v==='number')o[c]=(o[c]||0)+v}return o};
  for(const r of rows){const d=r[dateCol];if(!d)continue;const mk=d.slice(0,7);const k=keyCol?String(r[keyCol]??''):'All';if(nameCol&&idCol&&r[nameCol]&&!names.has(k))names.set(k,String(r[nameCol]));
    let km=KM.get(k);if(!km){km=new Map();KM.set(k,km)}add(km,mk,r);add(M,mk,r);let kd=KD.get(k);if(!kd){kd=new Map();KD.set(k,kd)}add(kd,d,r);add(D,d,r)}
  const months=[...M.keys()].sort();const days=[...D.keys()].sort();const cnt={};for(const v of names.values())cnt[v]=(cnt[v]||0)+1;
  return{ds,rows,dateCol,idCol,nameCol,keyCol,nums,names,KM,M,KD,D,months,days,label:k=>{const n=names.get(k);return n?(cnt[n]>1?n+' · '+k:n):k}}}
function metricVal(mt,o){if(!o)return null;const n=o[mt.num];if(mt.kind==='sum')return n??null;const d=o[mt.den];if(!d)return null;return(n||0)/d*(mt.kind==='pct'?100:1)}
function presetMetrics(rm){const sums=Object.fromEntries(rm.nums.map(c=>[c,[...rm.M.values()].reduce((a,o)=>a+(o[c]||0),0)]));
  const seat=rm.nums.filter(c=>/seat|ticket|booking|pax|count|qty|trips?|orders?/i.test(c)&&!MONEY_RE.test(c)&&!/discount/i.test(c));
  const money=rm.nums.filter(c=>MONEY_RE.test(c)||/discount/i.test(c));const out=[];
  const den=seat.slice().sort((a,b)=>sums[b]-sums[a])[0];
  if(den)for(const c of seat)if(c!==den)out.push({id:'p_'+c,name:`${c} % of ${den}`,num:c,den,kind:'pct'});
  const disc=money.find(c=>/discount|burn/i.test(c)),gmv=money.find(c=>/gmv|revenue|sales|amount/i.test(c));
  if(disc&&gmv)out.push({id:'p_dg',name:`${disc} % of ${gmv}`,num:disc,den:gmv,kind:'pct'});
  const rdSeat=seat.filter(c=>c!==den).sort((a,b)=>sums[b]-sums[a])[0];
  if(gmv&&rdSeat)out.push({id:'p_gps',name:`${gmv} per ${rdSeat} (₹)`,num:gmv,den:rdSeat,kind:'per'});
  if(disc&&rdSeat)out.push({id:'p_dps',name:`${disc} per ${rdSeat} (₹)`,num:disc,den:rdSeat,kind:'per'});
  for(const c of rm.nums)out.push({id:'s_'+c,name:`${c} (total)`,num:c,kind:'sum'});
  return out}
/* find the raw ratio that reproduces a month table (e.g. Bo Summary %) */
function autoMatch(rm,mx){if(!mx||mx.unit!=='pct')return null;let best=null;
  for(const num of rm.nums)for(const den of rm.nums){if(num===den)continue;const mt={num,den,kind:'pct'};let e=0,n=0;
    for(const en of mx.ents){if(en.total)continue;const km=rm.KM.get(en.key);for(const m of mx.months){const want=en.vals[m];if(want==null)continue;const got=km?metricVal(mt,km.get(m)):null;if(got==null){if(want===0)continue;e+=Math.abs(want);n++;continue}e+=Math.abs(got-want);n++}}
    if(n>=3&&(!best||e/n<best.err))best={num,den,err:e/n}}
  return best&&best.err<0.6?best:null}

/* ---------- formatting ---------- */
const fmtU=(u,v)=>v==null||!isFinite(v)?'–':u==='pct'?v.toFixed(2)+'%':u==='per'||u==='money'?'₹'+fmtShort(v):fmtShort(v);
const fmtD=(u,v)=>v==null||!isFinite(v)?'–':(v>0?'+':v<0?'−':'')+(u==='pct'?Math.abs(v).toFixed(2)+' pp':u==='per'||u==='money'?'₹'+fmtShort(Math.abs(v)):fmtShort(Math.abs(v)));
function analyse(vals,ms,unit,dir){const arr=ms.map(m=>vals[m]??null);const nn=arr.filter(v=>v!=null);const first=arr.find(v=>v!=null);const last=[...arr].reverse().find(v=>v!=null);
  const avg=nn.length?nn.reduce((a,b)=>a+b,0)/nn.length:null;const ch=nn.length>1?last-first:null;const thr=unit==='pct'?0.5:Math.max(Math.abs(avg||0)*.02,1e-9);
  const moms=arr.map((v,i)=>i&&v!=null&&arr[i-1]!=null?v-arr[i-1]:null);const ups=moms.filter(x=>x!=null&&x*dir>thr).length,downs=moms.filter(x=>x!=null&&x*dir<-thr).length;
  const lastMom=moms.length>1?moms.at(-1):null;const tag=ch==null?'na':ch*dir>thr?'inc':ch*dir<-thr?'dec':'flat';
  return{arr,avg,ch,moms,ups,downs,lastMom,tag,first,last,pctCh:first?(last/first-1):null,fell:lastMom!=null&&lastMom*dir<-thr}}
const TAGS={inc:['good','▲ Incremental'],dec:['bad','▼ Decremental'],flat:['','● Flat'],na:['','–']};

/* multi-line chart */
function lineChart({labels,series,fmtY,height=250,dayLabels}){const W=720,H=height,L=58,R=14,T=14,B=30;const n=labels.length;if(!n)return h('p',{class:'small muted'},'No data in these months.');
  const all=series.flatMap(s=>s.vals).filter(v=>v!=null&&isFinite(v));if(!all.length)return h('p',{class:'small muted'},'No values to draw.');let mx=Math.max(...all),mn=Math.min(...all,0);if(mx===mn)mx=mn+1;
  const mag=Math.pow(10,Math.floor(Math.log10((mx-mn)/4||1)));const step=Math.ceil((mx-mn)/4/mag)*mag||1;const t0=Math.ceil(mx/step)*step,b0=Math.floor(mn/step)*step;
  const X=i=>L+(n===1?(W-L-R)/2:i*(W-L-R)/(n-1)),Y=v=>T+(t0-v)/(t0-b0||1)*(H-T-B);
  let g='';for(let v=b0;v<=t0+1e-9;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L-8}" y="${Y(v)+3.5}" text-anchor="end">${fmtY(v)}</text>`;
  const every=Math.max(1,Math.ceil(n/(dayLabels?8:12)));labels.forEach((lb,i)=>{if((i%every&&i!==n-1)||(i!==n-1&&n-1-i<every*.6))return;g+=`<text x="${X(i)}" y="${H-9}" text-anchor="${n===1?'middle':i===0?'start':i===n-1?'end':'middle'}">${pretty(lb)}</text>`});
  series.forEach(s=>{let d='';s.vals.forEach((v,i)=>{if(v==null)return;d+=(d&&s.vals[i-1]!=null?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)});g+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w||2.4}" ${s.dash?'stroke-dasharray="6 5"':''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if(!dayLabels||n<40)s.vals.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="${dayLabels?2.4:4}" fill="${s.color}" stroke="var(--surface-solid)" stroke-width="1.5"><title>${s.name} · ${pretty(labels[i])}: ${fmtY(v)}</title></circle>`})});
  return h('div',{},h('div',{html:`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Trend">${g}</svg>`}),h('div',{class:'legend'},series.map(s=>h('span',{},h('i',{style:`background:${s.color}`}),s.name))))}

/* ---------- state ---------- */
const PK={pid:null,tab:'overview',cache:null,cfg:null};
function pkCfgKey(pid){return'nila.pack.'+pid}
function pkSave(){lsSet(pkCfgKey(PK.pid),PK.cfg);const hd=PK.cache&&PK.cache.holder;if(hd){hd.packCfg=PK.cfg;persistDs(hd)}}
let _pT=null;function persistDs(ds){clearTimeout(_pT);_pT=setTimeout(async()=>{if(!S.saveOn||ds.demo)return;try{const{id,demo,...b}=ds;await store.set(`${S.P.ds}/${id}`,b)}catch(e){toast(dbErr(e))}},500)}
async function buildPack(p){const out={p,mx:[],raw:null,tables:[]};
  for(const d of p.members){const rows=await loadRows(d);if(d.pack.role==='matrix')out.mx.push(matrixModel(d,rows));else if(d.pack.role==='raw'&&!out.raw)out.raw=rawModel(d,rows);else out.tables.push({ds:d,rows})}
  out.bench=out.mx.find(m=>m.ents.some(e=>/^india$|^(grand )?total$|all india|pan india/i.test(e.name))&&m.ents.length>3)||null;
  out.me=out.mx.find(m=>m!==out.bench&&m.ents.filter(e=>!e.total).length<=3)||null;
  out.main=out.mx.filter(m=>m!==out.bench&&m!==out.me).sort((a,b)=>(b.idCol?1:0)-(a.idCol?1:0)||b.ents.length-a.ents.length)[0]||null;
  out.holder=p.members[0];
  if(out.raw){out.presets=presetMetrics(out.raw);const am=autoMatch(out.raw,out.main||out.me);if(am){const nm=(out.main||out.me).ds.pack.sheet+' %';out.matched={id:'match',name:`${nm} = ${am.num} ÷ ${am.den}`,short:nm,num:am.num,den:am.den,kind:'pct',auto:true};out.presets=[out.matched,...out.presets.filter(x=>!(x.num===am.num&&x.den===am.den))]}}
  const ms=new Set();out.mx.forEach(m=>m.months.forEach(x=>ms.add(x)));if(out.raw)out.raw.months.forEach(x=>ms.add(x));out.months=[...ms].sort();
  return out}
function notesOf(){const hd=PK.cache.holder;return hd.notes||(hd.notes={})}

/* ---------- main view ---------- */
async function packView(body,pid){const p=packList().find(x=>x.id===pid);if(!p){body.replaceChildren(h('div',{class:'banner'},'This report is not here any more.'));return}
  body.replaceChildren(h('div',{class:'card'},dots('Reading all sheets of '+p.name+'…')));
  try{if(!PK.cache||PK.pid!==pid||PK.cache.p.members.some((d,i)=>d!==p.members[i])||PK.cache.p.members.length!==p.members.length){PK.pid=pid;PK.cache=await buildPack(p);
      const saved=PK.cache.holder.packCfg||lsGet(pkCfgKey(pid),null)||{};const ms=PK.cache.months;
      PK.cfg={from:ms[0],to:ms.at(-1),bench:null,metric:PK.cache.matched?'match':(PK.cache.presets||[])[0]?.id,metrics:[],bo:'',filter:'all',sort:'change',...saved};
      if(!ms.includes(PK.cfg.from))PK.cfg.from=ms[0];if(!ms.includes(PK.cfg.to))PK.cfg.to=ms.at(-1);PK.tab=PK.tab||'overview'}
    renderPack(body)}catch(e){console.error(e);body.replaceChildren(h('div',{class:'banner'},'Could not build this report: '+(e.message||e)))}}
function rangeMonths(){const ms=PK.cache.months;const a=ms.indexOf(PK.cfg.from),b=ms.indexOf(PK.cfg.to);return ms.slice(Math.min(a,b),Math.max(a,b)+1)}
function renderPack(body){const C=PK.cache,c=PK.cfg;const lens=lensOf(C.p.members[0].type);
  const set=patch=>{Object.assign(PK.cfg,patch);pkSave();renderPack(body)};
  const mSel=(key)=>{const s=h('select',{'aria-label':key==='from'?'Start month':'End month'},C.months.map(m=>h('option',{value:m,selected:c[key]===m},pretty(m))));s.onchange=()=>set({[key]:s.value});return s};
  const tabs=[['overview','Overview'],...C.mx.map(m=>['mx:'+m.ds.id,m.ds.pack.sheet]),...(C.raw?[['deep','Deep dive · '+C.raw.ds.pack.sheet]]:[]),...C.tables.map(t=>['tb:'+t.ds.id,t.ds.pack.sheet])];
  if(!tabs.some(t=>t[0]===PK.tab))PK.tab='overview';
  const head=h('div',{class:'card pk-head'},
    h('div',{class:'row between'},h('div',{},h('h3',{style:'font-size:1.15rem'},'📘 ',C.p.name),h('p',{class:'small muted'},C.p.members.length,' sheets · ',C.p.members[0].type,C.raw&&C.raw.days.length?` · raw data ${prettyY(C.raw.days[0])} → ${prettyY(C.raw.days.at(-1))}`:'')),
      h('div',{class:'row',style:'gap:6px'},h('button',{class:'btn sm',onclick:()=>exportPack()},'Export Excel'),h('button',{class:'btn sm',onclick:()=>askNila()},'Explain with Nila'))),
    h('div',{class:'lens'},h('b',{},lens.title),h('span',{},lens.text)),
    h('div',{class:'fbar pk-bar'},h('label',{class:'field inline'},h('span',{},'From'),mSel('from')),h('label',{class:'field inline'},h('span',{},'To'),mSel('to')),
      h('div',{class:'seg',role:'group','aria-label':'Quick months'},[['all','All'],['3','Last 3'],['2','Last 2']].map(([k,l])=>h('button',{onclick:()=>{const ms=C.months;set(k==='all'?{from:ms[0],to:ms.at(-1)}:{from:ms[Math.max(0,ms.length-Number(k))],to:ms.at(-1)})}},l))),
      h('span',{class:'small muted'},`${rangeMonths().length} months selected`)),
    h('div',{class:'pk-tabs',role:'tablist'},tabs.map(([k,l])=>h('button',{role:'tab','aria-selected':String(PK.tab===k),onclick:()=>{PK.tab=k;renderPack(body)}},l))));
  let content;try{content=PK.tab==='overview'?overviewTab(set):PK.tab==='deep'?deepTab(set):PK.tab.startsWith('mx:')?matrixTab(C.mx.find(m=>'mx:'+m.ds.id===PK.tab),set):tableTab(C.tables.find(t=>'tb:'+t.ds.id===PK.tab))}catch(e){console.error(e);content=h('div',{class:'banner'},'Could not draw this tab: '+e.message)}
  body.replaceChildren(head,content)}

/* ---------- overview ---------- */
function benchSeries(){const C=PK.cache,c=PK.cfg,ms=rangeMonths();const out=[];const COL=['var(--accent)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
  if(C.me){const meName=(S.settings.name||'').toLowerCase();const e=C.me.ents.find(x=>meName&&x.name.toLowerCase().includes(meName))||C.me.ents.find(x=>!x.total);if(e)out.push({name:'Me · '+e.name,key:'me',vals:ms.map(m=>e.vals[m]??null),w:3.4})}
  else if(C.raw&&C.matched){out.push({name:'Me (from raw)',key:'me',vals:ms.map(m=>metricVal(C.matched,C.raw.M.get(m))),w:3.4})}
  if(C.bench){const picks=c.bench||defaultBench(C.bench);for(const k of picks){const e=C.bench.ents.find(x=>x.section+'|'+x.name===k);if(e)out.push({name:e.name,key:k,vals:ms.map(m=>e.vals[m]??null),target:e.extra&&Object.entries(e.extra).find(([col])=>/target/i.test(col))?.[1]})}}
  out.forEach((s,i)=>{s.color=COL[i%COL.length];if(i>0)s.w=2.2});return out}
function defaultBench(bm){const ents=bm.ents;const pick=[];const me=(S.settings.region||'tamil|tn').toLowerCase().split(/[\s,]+/).filter(Boolean);
  const tn=ents.filter(e=>/tamil|^tn\b|tn \(/i.test(e.name)||me.some(w=>w.length>2&&e.name.toLowerCase().includes(w)));tn.slice(0,2).forEach(e=>pick.push(e.section+'|'+e.name));
  const ind=ents.find(e=>/^india$/i.test(e.name));if(ind)pick.push(ind.section+'|'+ind.name);const gt=ents.find(e=>e.total);if(gt)pick.push(gt.section+'|'+gt.name);return[...new Set(pick)]}
function overviewTab(set){const C=PK.cache,c=PK.cfg,ms=rangeMonths();const unit=(C.bench||C.me||C.main||{}).unit||'pct';const F=v=>fmtU(unit,v);const dir=lensOf(C.p.members[0].type).good;
  const ser=benchSeries();const me=ser.find(s=>s.key==='me');
  const tiles=h('div',{class:'kpis'},ser.slice(0,5).map(s=>{const a=analyse(Object.fromEntries(ms.map((m,i)=>[m,s.vals[i]])),ms,unit,dir);return h('div',{class:'kpi'+(s.key==='me'?' on':'')},h('span',{class:'label'},s.name),h('b',{},F(a.last)),h('span',{class:'delta '+(a.ch==null?'muted':a.ch*dir>=0?'up':'down')},a.ch==null?'one month':`${fmtD(unit,a.ch)} since ${pretty(ms[0])}`),h('span',{class:'small muted'},'Monthly average ',F(a.avg),s.target!=null?` · target ${F(s.target)}`:''))}));
  const chart=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},'You vs region vs India, month by month'),C.bench?h('button',{class:'btn sm',onclick:()=>pickBench(set)},'Choose comparison rows'):''),lineChart({labels:ms,series:ser,fmtY:F}));
  /* gap table */
  let gap='';if(me&&ser.length>1){const others=ser.filter(s=>s!==me);gap=h('div',{class:'card w12'},h('h3',{},'Gap: where you stand each month'),
    tbl(['Month','Me',...others.flatMap(o=>[o.name,'Me vs '+o.name.split(' (')[0]])],ms.map((m,i)=>[pretty(m),F(me.vals[i]),...others.flatMap(o=>{const d=me.vals[i]!=null&&o.vals[i]!=null?me.vals[i]-o.vals[i]:null;return[F(o.vals[i]),h('span',{class:d==null?'':d*dir>=0?'up':'down'},fmtD(unit,d))]})]).concat([['Monthly average',F(avgOf(me.vals)),...others.flatMap(o=>{const d=avgOf(me.vals)!=null&&avgOf(o.vals)!=null?avgOf(me.vals)-avgOf(o.vals):null;return[F(avgOf(o.vals)),h('span',{class:d==null?'':d*dir>=0?'up':'down'},fmtD(unit,d))]})]]),
      [1,...others.flatMap((_,i)=>[2+i*2,3+i*2])]))}
  /* movers from main table */
  let movers='';const mm=C.main;if(mm){const rows=mm.ents.filter(e=>!e.total).map(e=>({e,a:analyse(e.vals,ms,mm.unit,dir)})).filter(x=>x.a.ch!=null);
    const inc=rows.filter(x=>x.a.tag==='inc').sort((a,b)=>b.a.ch*dir-a.a.ch*dir),dec=rows.filter(x=>x.a.tag==='dec').sort((a,b)=>a.a.ch*dir-b.a.ch*dir);
    const lst=(arr,cls)=>arr.length?hbars(arr.slice(0,8).map(x=>({key:x.e.name,v:x.a.ch})),{fmtV:v=>fmtD(mm.unit,Math.abs(v)*(cls==='good'?1:-1)).replace(/^[+−]/,''),signed:true,onPick:k=>{PK.tab='mx:'+mm.ds.id;set({filter:cls==='good'?'inc':'dec'})}}):h('p',{class:'small muted'},'None in these months.');
    movers=[h('div',{class:'card w6'},h('div',{class:'ch-head'},h('h3',{},`▲ Incremental ${mm.ds.pack.sheet.replace(/summary/i,'').trim()||'rows'} (${inc.length})`),h('span',{class:'small muted'},pretty(ms[0])+' → '+pretty(ms.at(-1)))),lst(inc,'good')),
      h('div',{class:'card w6'},h('div',{class:'ch-head'},h('h3',{},`▼ Decremental (${dec.length})`),h('span',{class:'small muted'},'tap to see all')),lst(dec,'bad'))]}
  /* follow-ups */
  const nt=Object.entries(notesOf()).filter(([,v])=>v&&v.status!=='Done'&&(v.reason||v.action));
  const fu=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},`Open follow-ups (${nt.length})`),h('span',{class:'small muted'},'type a reason on any row in the sheet tabs')),
    nt.length?tbl(['Who','Status','Reason','Next step','Follow-up'],nt.map(([k,v])=>[v.label||k,h('span',{class:'chip '+(v.status==='In progress'?'warn':'violet')},v.status||'Open'),v.reason||'',v.action||'',v.due?prettyY(v.due):''])):h('p',{class:'small muted'},'No open follow-ups yet.'));
  const ins=h('div',{class:'card w12'},h('h3',{},'What Nila sees'),h('div',{class:'insights'},packInsights(ms,unit,dir).map(t=>h('div',{class:'insight'},h('span',{class:'ico',style:'background:var(--teal-soft);color:var(--teal)'},'✦'),h('span',{html:t})))));
  return h('div',{class:'view',style:'animation:none'},tiles,h('div',{class:'dash'},ins,chart,gap,movers,fu))}
const avgOf=a=>{const v=a.filter(x=>x!=null);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function packInsights(ms,unit,dir){const C=PK.cache;const F=v=>fmtU(unit,v);const out=[];const ser=benchSeries();const me=ser.find(s=>s.key==='me');
  if(me){const a=analyse(Object.fromEntries(ms.map((m,i)=>[m,me.vals[i]])),ms,unit,dir);if(a.ch!=null)out.push(`Your level moved from <b>${F(a.first)}</b> in ${pretty(ms[0])} to <b>${F(a.last)}</b> in ${pretty(ms.at(-1))} (<b>${fmtD(unit,a.ch)}</b>). Monthly average ${F(a.avg)}.`);
    for(const o of ser.filter(s=>s!==me)){const i=ms.length-1;if(me.vals[i]!=null&&o.vals[i]!=null){const d=me.vals[i]-o.vals[i];out.push(`In ${pretty(ms[i])} you are <b>${fmtD(unit,d)}</b> ${d*dir>=0?'ahead of':'behind'} ${esc(o.name)} (${F(o.vals[i])}).`)}if(o.target!=null&&me.vals[i]!=null){const d=me.vals[i]-o.target;out.push(`Against the ${esc(o.name)} target of ${F(o.target)}, you are <b>${fmtD(unit,d)}</b>.`)}}}
  const mm=C.main;if(mm){const rows=mm.ents.filter(e=>!e.total).map(e=>({e,a:analyse(e.vals,ms,mm.unit,dir)}));const inc=rows.filter(x=>x.a.tag==='inc').length,dec=rows.filter(x=>x.a.tag==='dec').length,fell=rows.filter(x=>x.a.fell);
    out.push(`${inc} of ${rows.length} rows in ${esc(mm.ds.pack.sheet)} grew, ${dec} fell from ${pretty(ms[0])} to ${pretty(ms.at(-1))}.`);
    if(fell.length)out.push(`Dropped in the latest month: <b>${fell.sort((a,b)=>a.a.lastMom-b.a.lastMom).slice(0,4).map(x=>esc(x.e.name)+' ('+fmtD(mm.unit,x.a.lastMom)+')').join(', ')}</b>. Worth a call this week.`);
    const zero=rows.filter(x=>x.a.last===0);if(zero.length)out.push(`${zero.length} rows are at 0 in the latest month: ${zero.slice(0,5).map(x=>esc(x.e.name)).join(', ')}${zero.length>5?' …':''}.`)}
  if(C.raw&&C.matched&&ms.length>1){const ct=contrib(C.matched,ms[0],ms.at(-1));if(ct){const top=ct.rows.slice(0,3);out.push(`Biggest drivers of your change (${pretty(ms[0])} → ${pretty(ms.at(-1))}): ${top.map(x=>esc(x.label)+' '+fmtD('pct',x.c)).join(', ')}.`)}}
  if(C.matched)out.push(`Checked: <b>${esc(C.matched.short)}</b> in the sheet equals <span class="mono">${esc(C.matched.num)} ÷ ${esc(C.matched.den)}</span> from the raw data, so the deep dive uses the same formula.`);
  return out}
function pickBench(set){const C=PK.cache;const cur=new Set(PK.cfg.bench||defaultBench(C.bench));const box=h('div',{class:'view',style:'gap:4px;animation:none'});
  for(const sec of C.bench.sections){box.append(h('p',{class:'small muted',style:'margin-top:8px;font-weight:700'},sec));for(const e of C.bench.ents.filter(x=>x.section===sec)){const k=e.section+'|'+e.name;const cb=h('input',{type:'checkbox',checked:cur.has(k)});cb.onchange=()=>cb.checked?cur.add(k):cur.delete(k);box.append(h('label',{class:'toggle',style:'color:var(--fg)'},cb,e.name))}}
  openSheet('Compare me with',h('p',{class:'small muted'},'Pick up to 4 rows, for example your state, India and the overall total.'),box,h('button',{class:'btn primary',onclick:()=>{closeSheet();set({bench:[...cur].slice(0,5)})}},'Apply'))}

/* ---------- month table tab (Bo Summary, Employee Summary, Summary) ---------- */
function matrixTab(mm,set){const C=PK.cache,c=PK.cfg,ms=rangeMonths().filter(m=>mm.months.includes(m));const dir=lensOf(mm.ds.type).good;const u=mm.unit;
  if(!ms.length)return h('div',{class:'banner'},'This sheet has no data in the selected months.');
  const all=mm.ents.map(e=>({e,a:analyse(e.vals,ms,u,dir)}));const body=all.filter(x=>!x.e.total);
  const cnt={all:body.length,inc:body.filter(x=>x.a.tag==='inc').length,dec:body.filter(x=>x.a.tag==='dec').length,flat:body.filter(x=>x.a.tag==='flat').length,fell:body.filter(x=>x.a.fell).length,note:body.filter(x=>notesOf()[x.e.key]).length};
  const q=c.q||'';let rows=body.filter(x=>c.filter==='all'||(c.filter==='fell'?x.a.fell:c.filter==='note'?!!notesOf()[x.e.key]:x.a.tag===c.filter)).filter(x=>!q||(x.e.name+' '+x.e.id).toLowerCase().includes(q.toLowerCase()));
  const sk=c.sort;rows.sort((a,b)=>sk==='name'?a.e.name.localeCompare(b.e.name):sk==='end'?(b.a.last??-1e9)-(a.a.last??-1e9):sk==='avg'?(b.a.avg??-1e9)-(a.a.avg??-1e9):sk==='mom'?(a.a.lastMom??1e9)-(b.a.lastMom??1e9):(b.a.ch??-1e9)*dir-(a.a.ch??-1e9)*dir);
  const secs=mm.sections.length>1;
  const filt=h('div',{class:'seg',role:'group','aria-label':'Filter'},[['all','All'],['inc','▲ Incremental'],['dec','▼ Decremental'],['flat','Flat'],['fell','Fell last month'],['note','With notes']].map(([k,l])=>h('button',{'aria-pressed':String(c.filter===k),onclick:()=>set({filter:k})},l,' ',h('small',{},cnt[k]))));
  const srch=h('input',{type:'search',placeholder:'Search name or ID',value:q,style:'width:180px'});srch.oninput=()=>{PK.cfg.q=srch.value;clearTimeout(srch._t);srch._t=setTimeout(()=>{const pos=srch.selectionStart;set({});const n=$('.pk-tools input[type=search]');if(n){n.focus();n.setSelectionRange(pos,pos)}},250)};
  const sortS=h('select',{'aria-label':'Sort',style:'width:auto'},[['change','Sort: biggest growth'],['mom','Sort: biggest fall last month'],['end','Sort: latest month'],['avg','Sort: monthly average'],['name','Sort: name']].map(([k,l])=>h('option',{value:k,selected:sk===k},l)));sortS.onchange=()=>set({sort:sortS.value});
  const tools=h('div',{class:'pk-tools'},filt,h('span',{style:'flex:1'}),srch,sortS);
  const cell=(a,i)=>{const v=a.arr[i],d=a.moms[i];return h('td',{class:'n mxc'},h('span',{},fmtU(u,v)),d!=null?h('small',{class:d*dir>(u==='pct'?.5:0)?'up':d*dir<-(u==='pct'?.5:0)?'down':'muted'},d>0?'▲':d<0?'▼':'•',' ',fmtD(u,Math.abs(d)).replace(/^[+−]/,'')):'')};
  const noteBtn=e=>{const n=notesOf()[e.key];return h('td',{class:'note-td'},h('button',{class:'notebtn'+(n?' has':''),onclick:()=>editNote(e.key,e.name,()=>set({}))},n?h('span',{},h('b',{class:'chip '+(n.status==='Done'?'good':n.status==='In progress'?'warn':'violet'),style:'margin-right:6px'},n.status||'Open'),(n.reason||n.action||'').slice(0,60)):'+ reason / follow-up'))};
  const hasExtra=mm.extra.filter(x=>body.some(r=>typeof r.e.extra[x]==='number'));
  const hdr=h('tr',{},mm.idCol?h('th',{},mm.idCol):'',h('th',{class:'stick'},mm.nameCol),...hasExtra.map(x=>h('th',{class:'n'},x)),...ms.map(m=>h('th',{class:'n'},pretty(m))),h('th',{class:'n'},'Monthly avg'),h('th',{class:'n'},'Change'),h('th',{},'Trend'),h('th',{},'Months ▲/▼'),h('th',{},'Reason & follow-up'));
  const ncol=(mm.idCol?1:0)+1+hasExtra.length+ms.length+5;
  const trs=[];let lastSec=null;const benchKeys=new Set(PK.cfg.bench||(C.bench===mm?defaultBench(mm):[]));
  for(const x of rows){
    trs.push(h('tr',{class:benchKeys.has(x.e.section+'|'+x.e.name)?'hl':''},mm.idCol?h('td',{class:'mono'},x.e.id):'',h('td',{class:'stick nm',title:x.e.name},x.e.name,secs?h('small',{class:'muted',style:'display:block'},x.e.section):''),...hasExtra.map(col=>h('td',{class:'n'},fmtU(mm.ds.units&&mm.ds.units[col]==='pct'?'pct':'num',x.e.extra[col]))),...ms.map((_,i)=>cell(x.a,i)),
      h('td',{class:'n'},h('b',{},fmtU(u,x.a.avg))),h('td',{class:'n '+(x.a.ch==null?'':x.a.ch*dir>=0?'up':'down')},fmtD(u,x.a.ch)),h('td',{},h('span',{class:'chip '+TAGS[x.a.tag][0]},TAGS[x.a.tag][1])),h('td',{class:'small'},`${x.a.ups} ▲ · ${x.a.downs} ▼`),noteBtn(x.e)))}
  /* footer: totals rows from the sheet, then average of rows, then weighted from raw */
  const foot=[];const tot=all.filter(x=>x.e.total);for(const x of tot)foot.push(h('tr',{class:'total'},mm.idCol?h('td',{}):'',h('td',{class:'stick'},x.e.name+' (from sheet)'),...hasExtra.map(col=>h('td',{class:'n'},fmtU(mm.ds.units&&mm.ds.units[col]==='pct'?'pct':'num',x.e.extra[col]))),...ms.map((_,i)=>cell(x.a,i)),h('td',{class:'n'},fmtU(u,x.a.avg)),h('td',{class:'n'},fmtD(u,x.a.ch)),h('td',{colspan:3})));
  if(body.length>1){const av={};ms.forEach(m=>{av[m]=avgOf(body.map(x=>x.e.vals[m]??null))});const a=analyse(av,ms,u,dir);foot.push(h('tr',{class:'total'},mm.idCol?h('td',{}):'',h('td',{class:'stick'},u==='pct'?'Simple average of rows':'Total of rows'),...hasExtra.map(()=>h('td',{})),...ms.map((_,i)=>cell(u==='pct'?a:analyse(Object.fromEntries(ms.map(m=>[m,body.reduce((s,x)=>s+(x.e.vals[m]||0),0)])),ms,u,dir),i)),h('td',{class:'n'},fmtU(u,u==='pct'?a.avg:null)),h('td',{class:'n'},fmtD(u,a.ch)),h('td',{colspan:3})))}
  if(C.raw&&C.matched&&mm===C.main){const w={};ms.forEach(m=>w[m]=metricVal(C.matched,C.raw.M.get(m)));const a=analyse(w,ms,u,dir);foot.push(h('tr',{class:'total wt'},mm.idCol?h('td',{}):'',h('td',{class:'stick'},'Weighted overall (raw: '+C.matched.num+' ÷ '+C.matched.den+')'),...hasExtra.map(()=>h('td',{})),...ms.map((_,i)=>cell(a,i)),h('td',{class:'n'},fmtU(u,a.avg)),h('td',{class:'n'},fmtD(u,a.ch)),h('td',{colspan:3})))}
  const table=h('div',{class:'tblwrap mx'},h('table',{class:'t'},h('thead',{},hdr),h('tbody',{},trs.length?trs:[h('tr',{},h('td',{colspan:ncol,class:'muted'},'Nothing matches this filter.'))]),h('tfoot',{},foot)));
  const help=h('p',{class:'small muted'},u==='pct'?'Values are percentages, so the summary rows use the average, never the sum. Small ▲▼ under each value = change vs the month before. Change = last month minus first month in your range, in percentage points (pp).':'Small ▲▼ under each value = change vs the month before.');
  /* chart for selected rows */
  const top=rows.filter(x=>x.a.last!=null).slice(0,6);const COL=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];
  const chart=ms.length>1&&top.length?h('div',{class:'card'},h('div',{class:'ch-head'},h('h3',{},'Top rows of this view, month by month'),h('span',{class:'small muted'},'follows your filter and sort')),lineChart({labels:ms,series:top.map((x,i)=>({name:x.e.name,vals:x.a.arr,color:COL[i]})),fmtY:v=>fmtU(u,v)})):'';
  return h('div',{class:'view',style:'animation:none'},h('div',{class:'card'},h('div',{class:'ch-head'},h('h3',{},mm.ds.pack.sheet),h('span',{class:'small muted'},`${body.length} rows · ${pretty(ms[0])} → ${pretty(ms.at(-1))}`)),tools,table,help),chart)}
function editNote(key,label,done){const n=notesOf()[key]||{};const reason=h('textarea',{rows:3,placeholder:'Why did it move? e.g. Operator paused Red Deal on Bangalore routes, competitor offer, fare change'},n.reason||'');
  const action=h('textarea',{rows:3,placeholder:'Next step / follow-up, e.g. Meet owner on Monday, propose 10% deal on weekend services'},n.action||'');
  const st=h('select',{},['Open','In progress','Done'].map(x=>h('option',{selected:(n.status||'Open')===x},x)));const due=h('input',{type:'date',value:n.due||''});
  const hist=(n.log||[]).slice().reverse();
  openSheet(label,h('label',{class:'field'},h('span',{},'Reason'),reason),h('label',{class:'field'},h('span',{},'Progress / next step'),action),h('div',{class:'grid2'},h('label',{class:'field'},h('span',{},'Status'),st),h('label',{class:'field'},h('span',{},'Follow-up date'),due)),
    hist.length?h('details',{},h('summary',{class:'small'},`History (${hist.length})`),h('div',{class:'small muted',style:'display:flex;flex-direction:column;gap:6px;margin-top:6px'},hist.map(x=>h('div',{},h('b',{},prettyY(x.at.slice(0,10))),' · ',x.status||'',' · ',x.reason||'',x.action?' → '+x.action:'')))):'',
    h('div',{class:'row'},h('button',{class:'btn primary',onclick:()=>{const all=notesOf();const prev=all[key];const log=[...((prev&&prev.log)||[])];if(prev&&(prev.reason||prev.action))log.push({at:prev.at||new Date().toISOString(),reason:prev.reason,action:prev.action,status:prev.status});
      all[key]={label,reason:reason.value.trim(),action:action.value.trim(),status:st.value,due:due.value,at:new Date().toISOString(),log:log.slice(-12)};persistDs(PK.cache.holder);closeSheet();toast('Saved');done&&done()}},'Save'),n.reason||n.action?h('button',{class:'btn ghost danger',onclick:()=>{delete notesOf()[key];persistDs(PK.cache.holder);closeSheet();done&&done()}},'Remove'):''))}

/* ---------- deep dive on raw data ---------- */
function allMetrics(){const C=PK.cache;return[...(C.presets||[]),...(PK.cfg.metrics||[])]}
function contrib(mt,ma,mb){const rm=PK.cache.raw;if(mt.kind!=='pct'&&mt.kind!=='per')return null;const A=rm.M.get(ma),B=rm.M.get(mb);if(!A||!B||!A[mt.den]||!B[mt.den])return null;const k=mt.kind==='pct'?100:1;
  const rows=[];for(const [key,km] of rm.KM){const a=km.get(ma)||{},b=km.get(mb)||{};const sa=(a[mt.den]||0)/A[mt.den],sb=(b[mt.den]||0)/B[mt.den];const ra=a[mt.den]?(a[mt.num]||0)/a[mt.den]*k:0,rb=b[mt.den]?(b[mt.num]||0)/b[mt.den]*k:0;
    const cc=sb*rb-sa*ra;if(!sa&&!sb)continue;rows.push({key,label:rm.label(key),c:cc,rate:((sa+sb)/2)*(rb-ra),mix:((ra+rb)/2)*(sb-sa),ra:a[mt.den]?ra:null,rb:b[mt.den]?rb:null,sa,sb})}
  rows.sort((x,y)=>Math.abs(y.c)-Math.abs(x.c));return{rows,total:metricVal(mt,B)-metricVal(mt,A)}}
function deepTab(set){const C=PK.cache,rm=C.raw,c=PK.cfg;const ms=rangeMonths().filter(m=>rm.months.includes(m));if(!ms.length)return h('div',{class:'banner'},'No raw data in the selected months.');
  const mets=allMetrics();let mt=mets.find(x=>x.id===c.metric)||mets[0];if(!mt)return h('div',{class:'banner'},'This sheet has no number columns.');const u=mt.kind==='pct'?'pct':mt.kind==='per'?'per':'num';const F=v=>fmtU(u,v);const dir=BAD_DIR.test(mt.num)?-1:1;
  const chips=h('div',{class:'mchips'},mets.filter(x=>x.kind!=='sum').map(x=>h('button',{class:'mchip'+(x.id===mt.id?' on':''),onclick:()=>set({metric:x.id})},x.auto?'★ ':'',x.short||x.name)),
    h('select',{'aria-label':'More numbers',style:'width:auto',onchange:e=>e.target.value&&set({metric:e.target.value})},h('option',{value:''},'Totals…'),mets.filter(x=>x.kind==='sum').map(x=>h('option',{value:x.id,selected:x.id===mt.id},x.name))),
    h('button',{class:'btn sm primary',onclick:()=>buildMetric(set)},'+ Build your own %'));
  const formula=h('p',{class:'small muted'},'Formula: ',h('span',{class:'mono'},mt.kind==='sum'?`sum of ${mt.num}`:`sum of ${mt.num} ÷ sum of ${mt.den}${mt.kind==='pct'?' × 100':''}`),mt.auto?' · matches the summary sheet':'',(c.metrics||[]).some(x=>x.id===mt.id)?h('button',{class:'btn ghost sm',onclick:()=>set({metrics:c.metrics.filter(x=>x.id!==mt.id),metric:mets[0].id})},'Delete this metric'):'');
  /* who */
  const keys=[...rm.KM.keys()].sort((a,b)=>rm.label(a).localeCompare(rm.label(b)));const bo=keys.includes(c.bo)?c.bo:'';
  const boSel=h('select',{'aria-label':'BO',style:'width:auto;max-width:260px'},h('option',{value:''},'All ('+keys.length+')'),keys.map(k=>h('option',{value:k,selected:k===bo},rm.label(k)+(rm.idCol?' · '+k:''))));boSel.onchange=()=>set({bo:boSel.value});
  const src=bo?rm.KM.get(bo):rm.M;const srcD=bo?rm.KD.get(bo):rm.D;
  /* KPIs */
  const mv=ms.map(m=>metricVal(mt,src.get(m)));const agg={};for(const m of ms){const o=src.get(m);if(!o)continue;for(const k of[mt.num,mt.den])if(k)agg[k]=(agg[k]||0)+(o[k]||0)}
  const overall=metricVal(mt,agg);const mAvg=avgOf(mv);const best=ms.map((m,i)=>[m,mv[i]]).filter(x=>x[1]!=null).sort((a,b)=>(b[1]-a[1])*dir)[0];const worst=ms.map((m,i)=>[m,mv[i]]).filter(x=>x[1]!=null).sort((a,b)=>(a[1]-b[1])*dir)[0];
  const lastD=mv.length>1&&mv.at(-1)!=null&&mv.at(-2)!=null?mv.at(-1)-mv.at(-2):null;
  const kp=(l,v,s,cls)=>h('div',{class:'kpi'},h('span',{class:'label'},l),h('b',{},v),h('span',{class:'delta '+(cls||'muted')},s));
  const kpis=h('div',{class:'kpis'},kp(mt.kind==='sum'?'Total':'Overall (weighted)',F(mt.kind==='sum'?agg[mt.num]:overall),mt.kind==='sum'?'all selected months':'all seats in the range together'),
    mt.kind!=='sum'?kp('Monthly average',F(mAvg),`average of ${mv.filter(x=>x!=null).length} monthly values`):kp('Monthly average',F(avgOf(mv)),'per month'),
    kp('Latest month',F(mv.at(-1)),lastD==null?pretty(ms.at(-1)):`${fmtD(u,lastD)} vs ${pretty(ms.at(-2))}`,lastD==null?'muted':lastD*dir>=0?'up':'down'),
    best?kp('Best month',F(best[1]),pretty(best[0])+(worst?` · lowest ${pretty(worst[0])} ${F(worst[1])}`:'')):'');
  /* month table */
  const mtab=h('div',{class:'card w12'},h('h3',{},'Month by month',bo?' · '+rm.label(bo):''),tbl(['Month',...(mt.den?[mt.num,mt.den]:[mt.num]),'Value','vs prev'],ms.map((m,i)=>{const o=src.get(m)||{};const d=i&&mv[i]!=null&&mv[i-1]!=null?mv[i]-mv[i-1]:null;return[pretty(m),fmtShort(o[mt.num]),...(mt.den?[fmtShort(o[mt.den])]:[]),h('b',{},F(mv[i])),h('span',{class:d==null?'':d*dir>=0?'up':'down'},fmtD(u,d))]}).concat([['Monthly average','',...(mt.den?['']:[]),h('b',{},F(mAvg)),''],[mt.kind==='sum'?'Total':'Overall (weighted)',fmtShort(agg[mt.num]),...(mt.den?[fmtShort(agg[mt.den])]:[]),h('b',{},F(mt.kind==='sum'?agg[mt.num]:overall)),'']]),[1,2,3,4].slice(0,mt.den?4:3)));
  /* day level */
  const days=rm.days.filter(d=>ms.includes(d.slice(0,7)));const dv=days.map(d=>metricVal(mt,srcD&&srcD.get(d)));
  const roll=days.map((d,i)=>{if(mt.kind==='sum'){const w=dv.slice(Math.max(0,i-6),i+1).filter(x=>x!=null);return w.length?w.reduce((a,b)=>a+b,0)/w.length:null}const o={};for(let j=Math.max(0,i-6);j<=i;j++){const x=srcD&&srcD.get(days[j]);if(!x)continue;o[mt.num]=(o[mt.num]||0)+(x[mt.num]||0);o[mt.den]=(o[mt.den]||0)+(x[mt.den]||0)}return metricVal(mt,o)});
  const dd=days.map((d,i)=>[d,dv[i]]).filter(x=>x[1]!=null);const hiD=dd.slice().sort((a,b)=>b[1]-a[1]).slice(0,3),loD=dd.slice().sort((a,b)=>a[1]-b[1]).slice(0,3);
  const day=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},'Day level',bo?' · '+rm.label(bo):' · all'),h('span',{class:'small muted'},`${days.length} days`)),lineChart({labels:days,series:[{name:'Daily',vals:dv,color:'var(--c3)',w:1.4},{name:'7-day',vals:roll,color:'var(--accent)',w:2.8}],fmtY:F,dayLabels:true,height:230}),
    h('p',{class:'small'},h('b',{},'Highest days: '),hiD.map(x=>`${prettyY(x[0])} ${F(x[1])}`).join(' · '),h('br'),h('b',{},'Lowest days: '),loD.map(x=>`${prettyY(x[0])} ${F(x[1])}`).join(' · ')));
  /* BO x month */
  const ents=keys.map(k=>{const km=rm.KM.get(k);const vals={};for(const m of ms){const v=metricVal(mt,km.get(m));if(v!=null)vals[m]=v}const vol=ms.reduce((s,m)=>s+((km.get(m)||{})[mt.den||mt.num]||0),0);return{k,vals,vol,a:analyse(vals,ms,u,dir)}}).filter(x=>Object.keys(x.vals).length);
  const f=c.filter||'all';let er=ents.filter(x=>f==='all'||f==='note'||f==='fell'?(f!=='fell'||x.a.fell)&&(f!=='note'||notesOf()[x.k]):x.a.tag===f);er.sort((a,b)=>(b.a.ch??-1e9)*dir-(a.a.ch??-1e9)*dir);
  const fseg=h('div',{class:'seg',role:'group'},[['all','All'],['inc','▲ Incremental'],['dec','▼ Decremental'],['fell','Fell last month']].map(([k,l])=>h('button',{'aria-pressed':String(f===k),onclick:()=>set({filter:k})},l,' ',h('small',{},k==='all'?ents.length:k==='fell'?ents.filter(x=>x.a.fell).length:ents.filter(x=>x.a.tag===k).length))));
  const cell=(a,i)=>{const v=a.arr[i],d=a.moms[i];return h('td',{class:'n mxc'},h('span',{},F(v)),d!=null?h('small',{class:d*dir>0?'up':d*dir<0?'down':'muted'},d>0?'▲':d<0?'▼':'•',' ',fmtD(u,Math.abs(d)).replace(/^[+−]/,'')):'')};
  const bx=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},(rm.nameCol||'Row')+' × month · ',mt.short||mt.name),fseg),
    h('div',{class:'tblwrap mx'},h('table',{class:'t'},h('thead',{},h('tr',{},rm.idCol?h('th',{},rm.idCol):'',h('th',{class:'stick'},rm.nameCol||rm.keyCol),...ms.map(m=>h('th',{class:'n'},pretty(m))),h('th',{class:'n'},'Monthly avg'),h('th',{class:'n'},'Change'),h('th',{},'Trend'),h('th',{class:'n'},(mt.den||mt.num)+' (range)'),h('th',{},'Reason & follow-up'))),
      h('tbody',{},er.map(x=>{const n=notesOf()[x.k];return h('tr',{class:x.k===bo?'hl':''},rm.idCol?h('td',{class:'mono'},x.k):'',h('td',{class:'stick nm'},h('button',{class:'linkbtn',title:'Show day level',onclick:()=>set({bo:x.k===bo?'':x.k})},rm.label(x.k))),...ms.map((_,i)=>cell(x.a,i)),h('td',{class:'n'},h('b',{},F(x.a.avg))),h('td',{class:'n '+(x.a.ch==null?'':x.a.ch*dir>=0?'up':'down')},fmtD(u,x.a.ch)),h('td',{},h('span',{class:'chip '+TAGS[x.a.tag][0]},TAGS[x.a.tag][1])),h('td',{class:'n'},fmtShort(x.vol)),
        h('td',{class:'note-td'},h('button',{class:'notebtn'+(n?' has':''),onclick:()=>editNote(x.k,rm.label(x.k),()=>set({}))},n?h('span',{},h('b',{class:'chip '+(n.status==='Done'?'good':n.status==='In progress'?'warn':'violet'),style:'margin-right:6px'},n.status||'Open'),(n.reason||n.action||'').slice(0,50)):'+ reason')))})),
      h('tfoot',{},h('tr',{class:'total'},rm.idCol?h('td',{}):'',h('td',{class:'stick'},'Overall (weighted)'),...ms.map((m,i)=>cell(analyse(Object.fromEntries(ms.map(mm=>[mm,metricVal(mt,rm.M.get(mm))])),ms,u,dir),i)),h('td',{class:'n'},F(avgOf(ms.map(m=>metricVal(mt,rm.M.get(m)))))),h('td',{colspan:4}))))),
    h('p',{class:'small muted'},'Tap a name to see its day level above. Monthly avg = average of the monthly values. Weighted = all seats added first, then divided.'));
  /* contribution */
  let ctc='';if(ms.length>1&&mt.kind!=='sum'){const ct=contrib(mt,ms[0],ms.at(-1));if(ct&&ct.rows.length){ctc=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},`What moved the overall ${mt.short||'value'}: ${pretty(ms[0])} → ${pretty(ms.at(-1))} (${fmtD(u,ct.total)})`),h('span',{class:'small muted'},'each bar = that row\'s share of the change')),
      h('div',{class:'view',style:'gap:14px;animation:none'},hbars(ct.rows.slice(0,12).map(x=>({key:x.label,v:x.c})),{fmtV:v=>fmtD(u,v).replace(/^\+/,''),signed:true,onPick:k=>{const r=ct.rows.find(x=>x.label===k);if(r)set({bo:r.key})}}),
        tbl(['Row','Before','After','Rate effect','Volume effect','Total'],ct.rows.slice(0,12).map(x=>[x.label,F(x.ra),F(x.rb),fmtD(u,x.rate),fmtD(u,x.mix),h('b',{class:x.c*dir>=0?'up':'down'},fmtD(u,x.c))]),[1,2,3,4,5])),
      h('p',{class:'small muted'},'Rate effect = the row\'s own % went up or down. Volume effect = the row got a bigger or smaller share of total seats. Together they add up to the change in your overall %.'))}}
  return h('div',{class:'view',style:'animation:none'},h('div',{class:'card'},h('div',{class:'ch-head'},h('h3',{},'Pick the number'),h('label',{class:'field inline'},h('span',{},'Who'),boSel)),chips,formula),kpis,h('div',{class:'dash'},day,mtab,bx,ctc))}
function buildMetric(set){const rm=PK.cache.raw;const opt=sel=>rm.nums.map(c=>h('option',{value:c,selected:c===sel},c));
  const nm=h('input',{type:'text',placeholder:'e.g. Red Deal 10% share'});const num=h('select',{},opt(rm.nums.find(c=>/red_deal_seats_10|_10$/.test(c))||rm.nums[0]));const den=h('select',{},h('option',{value:''},'Nothing (just add up)'),opt(rm.nums.find(c=>/b2c|total/i.test(c))||rm.nums[1]));
  const kind=h('select',{},h('option',{value:'pct'},'Percent (× 100)'),h('option',{value:'per'},'Per unit (₹ or count)'));const prev=h('p',{class:'small'});
  const upd=()=>{const mt={num:num.value,den:den.value,kind:den.value?kind.value:'sum'};const v=metricVal(mt,[...rm.M.values()].reduce((o,x)=>{for(const k in x)o[k]=(o[k]||0)+x[k];return o},{}));prev.replaceChildren('Overall across all months: ',h('b',{},fmtU(mt.kind==='pct'?'pct':mt.kind==='per'?'per':'num',v)))};[num,den,kind].forEach(x=>x.onchange=upd);upd();
  openSheet('Build your own %',h('p',{class:'small muted'},'Pick which seats go on top and which go below. Nila adds them up for each month, BO and day, then divides. Example: red_deal_seats_10 ÷ b2c_seats × 100.'),
    h('label',{class:'field'},h('span',{},'Name'),nm),h('div',{class:'grid2'},h('label',{class:'field'},h('span',{},'Top (numerator)'),num),h('label',{class:'field'},h('span',{},'Divide by (denominator)'),den)),h('label',{class:'field'},h('span',{},'Show as'),kind),prev,
    h('button',{class:'btn primary',onclick:()=>{const id='u'+newId();const mt={id,name:nm.value.trim()||(den.value?`${num.value} ÷ ${den.value}`:num.value),num:num.value,den:den.value,kind:den.value?kind.value:'sum'};closeSheet();set({metrics:[...(PK.cfg.metrics||[]),mt],metric:id})}},'Add and show'))}
function tableTab(t){if(!t)return'';const d=t.ds;return h('div',{class:'card'},h('div',{class:'ch-head'},h('h3',{},d.pack.sheet),h('button',{class:'btn sm',onclick:()=>{ST.packId=null;ST.dsId=d.id;ST.m=null;studioView()}},'Open as a dashboard')),previewTable(d.columns,d.types||{},t.rows.slice(0,200)))}

/* ---------- export + AI ---------- */
async function exportPack(){if(typeof XLSX==='undefined'){toast('Excel tools are still loading');return}const C=PK.cache,ms=rangeMonths();const wb=XLSX.utils.book_new();const P=v=>v==null?null:Math.round(v*100)/100;
  const ser=benchSeries();if(ser.length){XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Report',C.p.name],['Months',pretty(ms[0])+' to '+pretty(ms.at(-1))],[],['Month',...ser.map(s=>s.name)],...ms.map((m,i)=>[pretty(m),...ser.map(s=>P(s.vals[i]))]),['Monthly average',...ser.map(s=>P(avgOf(s.vals)))]]),'Overview')}
  for(const mm of C.mx){const dir=lensOf(mm.ds.type).good;const mms=ms.filter(m=>mm.months.includes(m));const aoa=[[...(mm.idCol?[mm.idCol]:[]),mm.nameCol,...mm.extra,...mms.map(pretty),'Monthly avg','Change','Trend','Status','Reason','Next step','Follow-up']];
    for(const e of mm.ents){const a=analyse(e.vals,mms,mm.unit,dir);const n=notesOf()[e.key]||{};aoa.push([...(mm.idCol?[e.id]:[]),e.name,...mm.extra.map(x=>e.extra[x]),...a.arr.map(P),P(a.avg),P(a.ch),e.total?'':TAGS[a.tag][1].slice(2),n.status||'',n.reason||'',n.action||'',n.due||''])}
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),mm.ds.pack.sheet.slice(0,31))}
  if(C.raw){const rm=C.raw;const mt=allMetrics().find(x=>x.id===PK.cfg.metric)||allMetrics()[0];if(mt){const rmm=ms.filter(m=>rm.months.includes(m));const aoa=[[...(rm.idCol?[rm.idCol]:[]),rm.nameCol||'Row',...rmm.map(pretty),'Monthly avg','Change']];
    for(const [k,km] of rm.KM){const v=rmm.map(m=>metricVal(mt,km.get(m)));const a=analyse(Object.fromEntries(rmm.map((m,i)=>[m,v[i]])),rmm,'pct',1);aoa.push([...(rm.idCol?[k]:[]),rm.label(k),...v.map(P),P(a.avg),P(a.ch)])}
    aoa.push([]);aoa.push(['Formula',mt.kind==='sum'?mt.num:`${mt.num} ÷ ${mt.den}${mt.kind==='pct'?' × 100':''}`]);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Deep dive');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Month',...rm.nums],...rmm.map(m=>[pretty(m),...rm.nums.map(c=>(rm.M.get(m)||{})[c]||0)])]),'Month totals')}}
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});try{await S.downloads.save({filename:`${C.p.name.replace(/[\\/:*?"<>|]+/g,' ')} · Nila ${today()}.xlsx`,data:new Blob([buf])});toast('Excel saved')}catch(e){if(!(e&&e.code==='declined'))toast('Could not save the file')}}
function askNila(){const C=PK.cache,ms=rangeMonths();const unit=(C.bench||C.me||C.main||{}).unit||'pct';const lines=packInsights(ms,unit,lensOf(C.p.members[0].type).good).map(t=>'- '+t.replace(/<[^>]+>/g,''));
  const q=`Explain my "${C.p.name}" report for ${pretty(ms[0])} to ${pretty(ms.at(-1))} like a sharp KAM coach. What is going well, what is slipping, which 3 BOs to act on this week and what to say to them. Facts:\n${lines.join('\n')}`;
  go('ask');setTimeout(()=>{const ta=$('#askMount textarea');if(ta){ta.value=q;ta.focus()}},150)}

/* ---------- styles ---------- */
document.head.append(h('style',{},`
.pk-head{gap:12px}.lens{display:flex;gap:10px;align-items:flex-start;font-size:.84rem;padding:10px 12px;border-radius:12px;background:var(--teal-soft);color:var(--fg)}.lens b{color:var(--teal);white-space:nowrap}
.pk-bar{position:static;box-shadow:none}
.pk-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.pk-tabs::-webkit-scrollbar{display:none}
.pk-tabs button{flex:none;border:1px solid var(--line-2);background:var(--surface-2);color:var(--fg);border-radius:999px;padding:7px 14px;font-weight:700;font-size:.82rem;cursor:pointer}
.pk-tabs button[aria-selected="true"]{background:var(--grad);color:var(--accent-ink);border-color:transparent}
.pk-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pk-tools .seg small,.dash .seg small{opacity:.7;font-weight:600}
.tblwrap.mx{max-height:none}.tblwrap.mx table.t td,.tblwrap.mx table.t th{padding:7px 10px}
.tblwrap.mx .stick{position:sticky;left:0;z-index:2;background:var(--surface-solid)}.tblwrap.mx thead .stick{z-index:3;background:var(--surface-2)}
.tblwrap.mx td.nm{max-width:220px;overflow:hidden;text-overflow:ellipsis}
td.mxc span{display:block;font-weight:600}td.mxc small{display:block;font-size:.68rem;font-weight:700}
.up{color:var(--good)}.down{color:var(--bad)}small.muted{color:var(--muted)}
tr.hl td{background:var(--violet-soft)!important;font-weight:700}
.tblwrap.mx tfoot td{background:var(--surface-2);font-weight:700;border-top:1px solid var(--line-2)}
.tblwrap.mx tfoot tr.wt td{background:var(--teal-soft)}
.notebtn{border:1px dashed var(--line-2);background:transparent;color:var(--muted);border-radius:9px;padding:5px 9px;font-size:.76rem;cursor:pointer;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.notebtn.has{border-style:solid;color:var(--fg);background:var(--surface-2)}
.linkbtn{border:0;background:transparent;color:var(--fg);font:inherit;font-weight:600;cursor:pointer;padding:0;text-align:left;text-decoration:underline dotted;text-underline-offset:3px}
.mchips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.mchip{border:1px solid var(--line-2);background:var(--surface-2);color:var(--fg);border-radius:10px;padding:7px 11px;font-size:.8rem;font-weight:600;cursor:pointer;max-width:100%;text-align:left}
.mchip.on{background:var(--grad);color:var(--accent-ink);border-color:transparent}
.pack-ds{border-left:3px solid var(--accent)}
.dash>.card.w6{grid-column:span 6}@media (max-width:760px){.dash>.card.w6{grid-column:span 12}.lens{flex-direction:column;gap:2px}.tblwrap.mx td.nm{max-width:130px}}
`));
window.packList=packList;window.packView=packView;window.packCard=packCard;window.importPack=importPack;
