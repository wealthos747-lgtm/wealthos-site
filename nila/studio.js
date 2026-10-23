/* ===== Nila Studio: drop Excel, get a Power BI style dashboard ===== */
"use strict";
const MONEY_RE=/gmv|revenue|amount|value|fare|commission|sales|spend|cost|price|income|deal|payout|margin|burn|budget|₹|inr|rs\b/i;
const RATE_RE=/%|rate|ratio|avg|average|rating|occupancy|share|per\b|score|lqs|index|nps/i;

/* ---------- formula engine (calculated fields) ---------- */
const Formula={
  tokens(src){const out=[];const re=/\s*(\[[^\]]+\]|\d+(?:\.\d+)?|[()+\-*/])/y;let m,pos=0;src=String(src||'');while(pos<src.length){re.lastIndex=pos;m=re.exec(src);if(!m){if(/^\s*$/.test(src.slice(pos)))break;throw new Error('Cannot read "'+src.slice(pos,pos+12)+'"')}out.push(m[1]);pos=re.lastIndex}return out},
  compile(src){const t=this.tokens(src);const out=[],ops=[];const prec={'+':1,'-':1,'*':2,'/':2,'neg':3};let prev=null;
    for(const tk of t){if(/^\d/.test(tk))out.push({n:Number(tk)});else if(tk[0]==='[')out.push({v:tk.slice(1,-1).trim()});
      else if(tk==='(')ops.push(tk);else if(tk===')'){while(ops.length&&ops.at(-1)!=='(')out.push({o:ops.pop()});if(!ops.length)throw new Error('Brackets do not match');ops.pop()}
      else{let o=tk;if(o==='-'&&(prev===null||(typeof prev==='string'&&prev!==')'&&prev[0]!=='['&&!/^\d/.test(prev))))o='neg';while(ops.length&&ops.at(-1)!=='('&&prec[ops.at(-1)]>=prec[o]&&o!=='neg')out.push({o:ops.pop()});ops.push(o)}prev=tk}
    while(ops.length){const o=ops.pop();if(o==='(')throw new Error('Brackets do not match');out.push({o})}
    const vars=[...new Set(out.filter(x=>x.v).map(x=>x.v))];if(!out.length)throw new Error('Formula is empty');return{rpn:out,vars}},
  run(c,get){const st=[];for(const x of c.rpn){if('n' in x)st.push(x.n);else if(x.v!=null){const v=get(x.v);st.push(v==null?NaN:v)}else if(x.o==='neg')st.push(-st.pop());else{const b=st.pop(),a=st.pop();st.push(x.o==='+'?a+b:x.o==='-'?a-b:x.o==='*'?a*b:b===0?NaN:a/b)}}const r=st.pop();return isFinite(r)?r:null}};

/* ---------- model ---------- */
const Studio={
  /* Build a model for one dataset: rows with joins applied, measures, dims */
  async model(ds){
    const base=await loadRows(ds);const cfg=ds.studio||{};const joins=cfg.joins||[];
    let rows=base;const joinNum={};const joinedText=[];
    for(const j of joins){const o=dsById(j.ds);if(!o)continue;const orows=await loadRows(o);const map=new Map();
      for(const r of orows){const k=String(r[j.otherKey]??'').trim().toLowerCase();if(!k)continue;const e=map.get(k)||{};for(const c of j.cols){const v=r[c];if(typeof v==='number')e[c]=(e[c]||0)+v;else if(v!=null&&e[c]==null)e[c]=v}map.set(k,e)}
      for(const c of j.cols){const nm=`${c} (${o.name})`;if((o.types||{})[c]==='number')joinNum[nm]={key:j.key,map,col:c};else joinedText.push({nm,key:j.key,map,col:c})}}
    if(joinedText.length)rows=base.map(r=>{const o={...r};for(const t of joinedText){const e=t.map.get(String(r[t.key]??'').trim().toLowerCase());o[t.nm]=e?e[t.col]??null:null}return o});
    const types=ds.types||{};
    const measures=[...ds.columns.filter(c=>types[c]==='number'),...Object.keys(joinNum),...(cfg.calc||[]).map(c=>c.name)];
    const dims=[...ds.columns.filter(c=>types[c]==='text'),...joinedText.map(t=>t.nm)];
    const calc={};for(const c of cfg.calc||[]){try{calc[c.name]=Formula.compile(c.formula)}catch{}}
    const m={ds,rows,measures,dims,calc,joinNum,dateCol:ds.dateCol||'',cfg};
    m.distinct={};for(const d of dims){const s=new Map();for(const r of rows){const v=r[d];if(v==null||v==='')continue;s.set(v,(s.get(v)||0)+1)}m.distinct[d]=s.size}
    return m},
  isRate:(m,c)=>!m.calc[c]&&!m.joinNum[c]&&RATE_RE.test(c),
  val(m,rows,c){if(m.calc[c])return Formula.run(m.calc[c],v=>this.val(m,rows,this.resolve(m,v)));
    const j=m.joinNum[c];if(j){const seen=new Set();let s=0;for(const r of rows){const k=String(r[j.key]??'').trim().toLowerCase();if(!k||seen.has(k))continue;seen.add(k);const e=j.map.get(k);if(e&&typeof e[j.col]==='number')s+=e[j.col]}return s}
    let s=0,n=0;for(const r of rows){const v=r[c];if(typeof v==='number'){s+=v;n++}}return this.isRate(m,c)?(n?s/n:null):s},
  resolve(m,name){const f=m.measures.find(x=>x.toLowerCase()===String(name).toLowerCase());return f||name},
  fmt(m,c,v){if(v==null||!isFinite(v))return'–';if(this.isRate(m,c)){if(/%/.test(c))return v.toFixed(1)+'%';if(Math.abs(v)<=1&&/share|rate|occupancy|ratio/i.test(c))return(v*100).toFixed(1)+'%';return Math.abs(v)<100?v.toFixed(2):fmtShort(v)}return MONEY_RE.test(c)?'₹'+fmtShort(v):fmtShort(v)},
  pickMeasures(m){const pr=[/gmv|revenue|sales|amount|income|deal/i,/seat|booking|ticket|order|trip|sold|qty/i,/commission|margin|take/i,/cancel|refund/i,/rating|lqs|score|occupancy/i,/spend|cost|discount|burn/i];const out=[];for(const re of pr){const f=m.measures.find(c=>re.test(c)&&!out.includes(c));if(f)out.push(f)}for(const c of m.measures)if(out.length<4&&!out.includes(c))out.push(c);return out.slice(0,4)},
  pickDims(m){const opc=m.ds.operatorCol;const ranked=m.dims.filter(d=>m.distinct[d]>1).sort((a,b)=>{const s=d=>(d===opc?-100:0)+(/route|product|category|service|city|channel|region|bp|type/i.test(d)?-50:0)+Math.abs(Math.log((m.distinct[d]||1)/12));return s(a)-s(b)});return ranked},
  range(m,key,from,to){const dc=m.dateCol;if(!dc||key==='all')return null;const maxD=m.ds.maxDate||today();
    if(key==='custom'){if(!from||!to)return null;return{from,to}}
    if(key==='mtd'){const f=maxD.slice(0,8)+'01';return{from:f,to:maxD}}
    if(key==='lm'){const d=parseD(maxD.slice(0,8)+'01');d.setDate(0);const t=dstr(d);return{from:t.slice(0,8)+'01',to:t}}
    const n=Number(key)||30;return{from:addDays(maxD,-(n-1)),to:maxD}},
  prevRange(r){if(!r)return null;if(r.from.slice(8)==='01'){const d=parseD(r.from);d.setDate(0);const pe=dstr(d);const pf=pe.slice(0,8)+'01';if(r.to===monthEnd(r.to.slice(0,7)))return{from:pf,to:pe};const day=Math.min(Number(r.to.slice(8)),Number(pe.slice(8)));return{from:pf,to:pf.slice(0,8)+String(day).padStart(2,'0')}}
    const len=daysBetween(r.from,r.to)+1;return{from:addDays(r.from,-len),to:addDays(r.from,-1)}},
  filter(m,{range,filters,exclude}){const dc=m.dateCol;const fs=Object.entries(filters||{}).filter(([d,v])=>v&&v.length&&d!==exclude).map(([d,v])=>[d,new Set(v.map(String))]);
    return m.rows.filter(r=>{if(range&&dc){const d=r[dc];if(!d||d<range.from||d>range.to)return false}for(const[d,s]of fs)if(!s.has(String(r[d]??'')))return false;return true})},
  group(m,rows,dim,measure){const G=new Map();for(const r of rows){const k=r[dim]==null||r[dim]===''?'(blank)':String(r[dim]);let a=G.get(k);if(!a){a=[];G.set(k,a)}a.push(r)}return[...G.entries()].map(([k,rs])=>({key:k,rows:rs,v:this.val(m,rs,measure)}))},
  gran(r,m){const span=r?daysBetween(r.from,r.to):(m.ds.minDate&&m.ds.maxDate?daysBetween(m.ds.minDate,m.ds.maxDate):0);return span<=62?'day':span<=400?'week':'month'},
  series(m,rows,measure,gran){const dc=m.dateCol;const G=new Map();for(const r of rows){const d=r[dc];if(!d)continue;const k=gran==='month'?d.slice(0,7):gran==='week'?weekStart(d):d;let a=G.get(k);if(!a){a=[];G.set(k,a)}a.push(r)}
    const keys=[...G.keys()].sort();if(!keys.length)return[];const out=[];let k=keys[0];const last=keys.at(-1);let g=0;
    while(k<=last&&g++<1500){const rs=G.get(k);out.push({k,v:rs?this.val(m,rs,measure):(this.isRate(m,measure)?null:0)});k=gran==='month'?monthNext(k):addDays(k,gran==='week'?7:1)}return out}
};

/* ---------- charts ---------- */
let _gid=0;
function sparkSvg(vals,color){const v=vals.filter(x=>x!=null);if(v.length<2)return'';const W=200,H=38;const mn=Math.min(...v),mx=Math.max(...v),rg=mx-mn||1;const pts=vals.map((x,i)=>x==null?null:[i*(W/(vals.length-1)),H-3-(x-mn)/rg*(H-8)]).filter(Boolean);const id='sg'+(++_gid);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join('');const area=line+`L${pts.at(-1)[0]},${H}L${pts[0][0]},${H}Z`;
  return`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${id})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`}
function areaChart({labels,cur,prev,fmtY,height=240,curName='This period',prevName='Previous period'}){
  const W=700,H=height,L=56,R=12,T=14,B=28;const n=labels.length;if(!n)return h('p',{class:'small muted'},'No dated rows in this range.');
  const all=[...cur,...(prev||[])].filter(v=>v!=null);let mx=Math.max(...all,0),mn=Math.min(...all,0);if(mx===mn)mx=mn+1;
  const mag=Math.pow(10,Math.floor(Math.log10((mx-mn)/4||1)));const step=Math.ceil((mx-mn)/4/mag)*mag||1;const t0=Math.ceil(mx/step)*step,b0=Math.floor(mn/step)*step;
  const X=i=>L+(n===1?(W-L-R)/2:i*(W-L-R)/(n-1)),Y=v=>T+(t0-v)/(t0-b0||1)*(H-T-B);const id='ag'+(++_gid);
  const path=vals=>{let d='';vals.forEach((v,i)=>{if(v==null)return;d+=(d&&vals[i-1]!=null?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1)});return d};
  let grid='';for(let v=b0;v<=t0+1e-9;v+=step)grid+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L-8}" y="${Y(v)+3.5}" text-anchor="end">${fmtY(v)}</text>`;
  const every=Math.max(1,Math.ceil(n/7));let xl='';labels.forEach((lb,i)=>{if(i%every&&i!==n-1)return;xl+=`<text x="${X(i)}" y="${H-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${pretty(lb)}</text>`});
  const cd=path(cur);const fi=cur.findIndex(v=>v!=null);const li=cur.map((v,i)=>v!=null?i:-1).filter(i=>i>=0).at(-1);
  const area=cd&&li!=null?cd+`L${X(li)},${Y(b0)}L${X(fi)},${Y(b0)}Z`:'';
  let hits='';cur.forEach((v,i)=>{hits+=`<g><rect x="${X(i)-(W-L-R)/n/2}" y="${T}" width="${(W-L-R)/n}" height="${H-T-B}" fill="transparent"/><title>${pretty(labels[i])}: ${fmtY(v??0)}${prev&&prev[i]!=null?' · prev '+fmtY(prev[i]):''}</title></g>`});
  const svg=`<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Trend"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${grid}${xl}${prev?`<path d="${path(prev)}" fill="none" stroke="var(--faint)" stroke-width="1.6" stroke-dasharray="5 4"/>`:''}<path d="${area}" fill="url(#${id})"/><path d="${cd}" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>${li!=null?`<circle cx="${X(li)}" cy="${Y(cur[li])}" r="4.5" fill="var(--accent)" stroke="var(--surface-solid)" stroke-width="2"/>`:''}${hits}</svg>`;
  return h('div',{},h('div',{html:svg}),h('div',{class:'legend'},h('span',{},h('i',{style:'background:var(--accent)'}),curName),prev?h('span',{},h('i',{style:'background:var(--faint)'}),prevName):''))}
function hbars(items,{fmtV,onPick,selected,signed}){const mx=Math.max(...items.map(x=>Math.abs(x.v||0)),1);const anySel=selected&&selected.size;
  return h('div',{class:'hb'},items.map(x=>h('button',{class:'hb-row'+(anySel?(selected.has(x.key)?' sel':' dim'):''),title:`${x.key}: ${fmtV(x.v)}`,onclick:()=>onPick&&onPick(x.key)},h('span',{class:'nm'},x.key),h('span',{class:'tr'},h('i',{class:signed?(x.v<0?'neg':'pos'):'',style:`width:${Math.max(2,Math.abs(x.v||0)/mx*100)}%`})),h('span',{class:'vl'},signed&&x.v>0?'+':'',fmtV(x.v)))))}
const PAL=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)','var(--c8)'];
function donut(items,{fmtV,onPick,selected}){const tot=items.reduce((a,x)=>a+Math.max(0,x.v||0),0)||1;const C=2*Math.PI*52;let off=0;
  const segs=items.map((x,i)=>{const len=Math.max(0,x.v||0)/tot*C;const s=`<circle r="52" cx="70" cy="70" fill="none" stroke="${PAL[i%8]}" stroke-width="20" stroke-dasharray="${Math.max(0,len-1.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"${selected&&selected.size&&!selected.has(x.key)?' opacity=".3"':''}><title>${x.key}: ${(Math.max(0,x.v||0)/tot*100).toFixed(1)}%</title></circle>`;off+=len;return s}).join('');
  const top=items[0];const svg=`<svg viewBox="0 0 140 140" style="width:150px;height:150px">${segs}<text x="70" y="66" text-anchor="middle" style="font:600 18px var(--f-display);fill:var(--fg)">${top?(Math.max(0,top.v)/tot*100).toFixed(0)+'%':''}</text><text x="70" y="84" text-anchor="middle" style="font:500 9px var(--f-body);fill:var(--muted)">top share</text></svg>`;
  return h('div',{class:'donut-wrap'},h('div',{html:svg}),h('div',{class:'dleg'},items.map((x,i)=>h('button',{onclick:()=>onPick&&onPick(x.key),title:x.key},h('i',{style:`background:${PAL[i%8]}`}),h('span',{},x.key),h('b',{class:'mono small'},(Math.max(0,x.v||0)/tot*100).toFixed(1)+'%')))))}

/* ---------- state ---------- */
const ST={dsId:null,m:null,cfg:null,saveT:null};
function stDefaults(m){const ms=Studio.pickMeasures(m),ds=Studio.pickDims(m);return{measure:ms[0]||'',kpis:ms,dimA:ds[0]||'',dimB:ds.find(d=>d!==ds[0])||ds[0]||'',range:m.dateCol?'30':'all',from:'',to:'',filters:{},pivot:{rows:ds[0]||'',cols:'',measure:ms[0]||''},calc:(m.cfg.calc||[]),joins:(m.cfg.joins||[]),views:(m.cfg.views||[])}}
function stSave(){const ds=dsById(ST.dsId);if(!ds)return;const keep={measure:ST.cfg.measure,kpis:ST.cfg.kpis,dimA:ST.cfg.dimA,dimB:ST.cfg.dimB,range:ST.cfg.range,from:ST.cfg.from,to:ST.cfg.to,filters:ST.cfg.filters,pivot:ST.cfg.pivot,calc:ST.cfg.calc,joins:ST.cfg.joins,views:ST.cfg.views};ds.studio=keep;lsSet('nila.studio.last',ST.dsId);
  clearTimeout(ST.saveT);ST.saveT=setTimeout(async()=>{if(!S.saveOn||ds.demo)return;try{const{id,demo,...b}=ds;await store.set(`${S.P.ds}/${id}`,b)}catch(e){toast(dbErr(e))}},700)}

/* ---------- view ---------- */
function studioView(){const v=$('#view-studio');if(!v)return;
  const dsList=S.datasets;
  if(!dsList.length){v.replaceChildren(
    h('div',{class:'view-head'},h('div',{},h('h2',{},'Nila Studio'),h('p',{class:'muted small'},'Drop any Excel or CSV. Nila builds a Power BI style dashboard in seconds: KPIs, trends, top accounts, mix, movers and a pivot table. No AI key needed.'))),
    studioDrop(),h('div',{class:'empty'},h('h3',{},'No reports yet'),h('p',{class:'small muted'},'Try Red Deal revenue, KAM dashboard, service information, YB/BC or LQS downloads. Or look around with demo data first.'),h('button',{class:'btn sm primary',onclick:loadDemo},'Load demo data')));return}
  let id=ST.dsId&&dsById(ST.dsId)?ST.dsId:(lsGet('nila.studio.last',null)&&dsById(lsGet('nila.studio.last',null))?lsGet('nila.studio.last',null):dsList[0].id);
  const sel=h('select',{'aria-label':'Report'},dsList.map(d=>h('option',{value:d.id,selected:d.id===id},d.name+(d.demo?' (demo)':''))));sel.onchange=()=>{ST.dsId=sel.value;ST.m=null;studioView()};
  const body=h('div',{class:'view'},h('div',{class:'card'},dots('Building your dashboard…')));
  v.replaceChildren(h('div',{class:'view-head'},h('div',{},h('h2',{},'Nila Studio'),h('p',{class:'muted small'},'Tap any bar or slice to filter everything. Change the number, the split and the period from the bar below.'))),
    h('div',{class:'studio-top'},sel,h('button',{class:'btn sm',onclick:()=>{const box=h('div',{});openSheet('Add a report',studioDrop(box),box)}},'+ Upload report'),h('button',{class:'btn sm',onclick:openFields},'Fields & formulas'),h('button',{class:'btn sm',onclick:openJoin},'Link another file'),h('span',{style:'flex:1'}),viewsMenu()),body);
  (async()=>{if(!ST.m||ST.dsId!==id||ST.m.ds!==dsById(id)){ST.dsId=id;const ds=dsById(id);ST.m=await Studio.model(ds);ST.cfg={...stDefaults(ST.m),...(ds.studio||{})};if(!ST.m.measures.includes(ST.cfg.measure))ST.cfg=stDefaults(ST.m)}
    renderDash(body)})().catch(e=>{console.error(e);body.replaceChildren(h('div',{class:'banner'},'Could not build this dashboard: '+(e.message||e)))})}
function studioDrop(box){const inp=h('input',{type:'file',accept:'.csv,.xlsx,.xls,.tsv',hidden:true});const target=box||h('div',{});
  inp.onchange=()=>{const f=inp.files[0];if(f){readFile(f,target.isConnected?target:$('#importBox'),null);ST.wantNew=true}inp.value=''};
  const d=h('label',{class:'drop'},h('span',{class:'ico',html:'<svg class="i" viewBox="0 0 24 24" style="width:24px;height:24px"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>'}),h('strong',{},'Drop your Excel here'),h('span',{class:'small muted'},'.xlsx, .xls or .csv · up to about 40,000 rows is smooth'),inp);
  ['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('over')}));['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('over')}));d.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f){readFile(f,target.isConnected?target:$('#importBox'),null);ST.wantNew=true}});
  return box?d:h('div',{class:'view'},d,target)}
function viewsMenu(){const ds=dsById(ST.dsId)||{};const views=(ds.studio&&ds.studio.views)||[];const s=h('select',{'aria-label':'Saved views',style:'width:auto'},h('option',{value:''},views.length?'Saved views…':'No saved views'),views.map((x,i)=>h('option',{value:String(i)},x.name)));
  s.onchange=()=>{const x=views[Number(s.value)];if(x){ST.cfg={...ST.cfg,...x.cfg,views:ST.cfg.views};stSave();studioView()}};
  return h('div',{class:'row',style:'gap:6px'},s,h('button',{class:'btn sm',onclick:()=>{const nm=h('input',{type:'text',placeholder:'e.g. Chennai routes · last 30 days'});openSheet('Save this view',h('label',{class:'field'},h('span',{},'Name'),nm),h('button',{class:'btn primary',onclick:()=>{const name=nm.value.trim()||'View '+(ST.cfg.views.length+1);const{views:_,...snap}=ST.cfg;ST.cfg.views=[...ST.cfg.views,{name,cfg:JSON.parse(JSON.stringify(snap))}];stSave();closeSheet();toast('View saved');studioView()}},'Save view'))}},'Save view'))}

function renderDash(body){
  const m=ST.m,c=ST.cfg;const range=Studio.range(m,c.range,c.from,c.to);const prevR=Studio.prevRange(range);
  const rowsAll=Studio.filter(m,{range,filters:c.filters});const rowsPrev=prevR?Studio.filter(m,{range:prevR,filters:c.filters}):null;
  const F=(meas,v)=>Studio.fmt(m,meas,v);const set=(patch)=>{Object.assign(ST.cfg,patch);stSave();renderDash(body)};
  const toggle=(dim,key)=>{const cur=new Set((c.filters[dim]||[]).map(String));cur.has(key)?cur.delete(key):cur.add(key);const f={...c.filters};if(cur.size)f[dim]=[...cur];else delete f[dim];set({filters:f})};
  /* filter bar */
  const ranges=m.dateCol?[['7','7D'],['30','30D'],['90','90D'],['mtd','MTD'],['lm','Last month'],['all','All'],['custom','Custom']]:[];
  const seg=ranges.length?h('div',{class:'seg',role:'group','aria-label':'Period'},ranges.map(([k,l])=>h('button',{'aria-pressed':String(c.range===k),onclick:()=>{if(k==='custom'){const f=h('input',{type:'date',value:c.from||m.ds.minDate||''}),t=h('input',{type:'date',value:c.to||m.ds.maxDate||''});openSheet('Custom period',h('div',{class:'grid2'},h('label',{class:'field'},h('span',{},'From'),f),h('label',{class:'field'},h('span',{},'To'),t)),h('button',{class:'btn primary',onclick:()=>{closeSheet();set({range:'custom',from:f.value,to:t.value})}},'Apply'))}else set({range:k})}},l))):'';
  const slicerDims=[c.dimA,c.dimB,...Studio.pickDims(m)].filter((d,i,a)=>d&&a.indexOf(d)===i&&m.distinct[d]<=800).slice(0,4);
  const mSel=h('select',{'aria-label':'Number',style:'width:auto'},m.measures.map(x=>h('option',{selected:x===c.measure},x)));mSel.onchange=()=>set({measure:mSel.value,pivot:{...c.pivot,measure:mSel.value}});
  const chips=Object.entries(c.filters).map(([d,vs])=>h('span',{class:'fchip'},`${d}: ${vs.length>1?vs.length+' selected':vs[0]}`,h('button',{'aria-label':'Remove filter',onclick:()=>{const f={...c.filters};delete f[d];set({filters:f})}},'✕')));
  const fbar=h('div',{class:'fbar'},seg,h('label',{class:'field inline'},h('span',{},'Number'),mSel),...slicerDims.map(d=>slicer(m,d,c,toggle,set)),...chips,Object.keys(c.filters).length?h('button',{class:'btn ghost sm',onclick:()=>set({filters:{}})},'Clear all'):'',h('span',{style:'flex:1'}),
    h('button',{class:'btn sm',onclick:()=>{window.DECK_PRESET={dsId:ST.dsId,range:c.range,from:c.from,to:c.to,filters:c.filters,measure:c.measure,dimA:c.dimA,dimB:c.dimB};go('deck')}},'Make deck'),h('button',{class:'btn sm',onclick:()=>exportStudio(rowsAll)},'Export Excel'));
  const per=range?`${pretty(range.from)} – ${pretty(range.to)}`:(m.ds.minDate?`${pretty(m.ds.minDate)} – ${pretty(m.ds.maxDate)}`:'All rows');
  /* KPIs */
  const gran=Studio.gran(range,m);
  const kpiMs=[c.measure,...(c.kpis||[]).filter(x=>x!==c.measure&&m.measures.includes(x))].slice(0,4);
  const kpis=h('div',{class:'kpis'},kpiMs.map(k=>{const v=Studio.val(m,rowsAll,k),p=rowsPrev?Studio.val(m,rowsPrev,k):null;const d=p?v/p-1:null;const good=/cancel|refund|cost|spend|burn|complaint/i.test(k)?-1:1;const sp=m.dateCol?Studio.series(m,rowsAll,k,gran).map(x=>x.v):[];
    return h('button',{class:'kpi'+(k===c.measure?' on':''),onclick:()=>set({measure:k,pivot:{...c.pivot,measure:k}}),title:'Show '+k},h('span',{class:'label'},k),h('b',{},F(k,v)),h('span',{class:'delta '+(d==null?'muted':d*good>=0?'up':'down')},d==null?per:`${d>=0?'▲':'▼'} ${Math.abs(d*100).toFixed(1)}% vs previous`),h('span',{html:sparkSvg(sp,k===c.measure?'var(--accent)':'var(--c1)')}))}));
  /* trend */
  let trend='';if(m.dateCol){const cur=Studio.series(m,rowsAll,c.measure,gran);let prevVals=null;if(rowsPrev&&rowsPrev.length){const pv=Studio.series(m,rowsPrev,c.measure,gran);prevVals=cur.map((_,i)=>pv[i]?pv[i].v:null)}
    trend=h('div',{class:'card w8'},h('div',{class:'ch-head'},h('h3',{},`${c.measure} by ${gran}`),h('span',{class:'small muted'},per)),areaChart({labels:cur.map(x=>x.k),cur:cur.map(x=>x.v),prev:prevVals,fmtY:v=>F(c.measure,v)}))}
  /* top by dimA */
  const dimSel=(key)=>{const s=h('select',{'aria-label':'Split by'},m.dims.map(d=>h('option',{selected:d===c[key]},d)));s.onchange=()=>set({[key]:s.value});return s};
  const gA=c.dimA?Studio.group(m,Studio.filter(m,{range,filters:c.filters,exclude:c.dimA}),c.dimA,c.measure).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v):[];
  const selA=new Set((c.filters[c.dimA]||[]).map(String));
  const top=h('div',{class:'card '+(m.dateCol?'w4':'w6')},h('div',{class:'ch-head'},h('h3',{},'Top 10'),dimSel('dimA')),gA.length?hbars(gA.slice(0,10),{fmtV:v=>F(c.measure,v),onPick:k=>toggle(c.dimA,k),selected:selA}):h('p',{class:'small muted'},'No text column to split by.'));
  /* mix donut */
  const gB=c.dimB?Studio.group(m,Studio.filter(m,{range,filters:c.filters,exclude:c.dimB}),c.dimB,c.measure).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v):[];
  let mixItems=gB.slice(0,6);if(gB.length>6)mixItems.push({key:'Others',v:gB.slice(6).reduce((a,x)=>a+(x.v||0),0)});
  const mix=Studio.isRate(m,c.measure)?'':h('div',{class:'card w5'},h('div',{class:'ch-head'},h('h3',{},'Share'),dimSel('dimB')),mixItems.length?donut(mixItems,{onPick:k=>k!=='Others'&&toggle(c.dimB,k),selected:new Set((c.filters[c.dimB]||[]).map(String))}):h('p',{class:'small muted'},'Nothing to split.'));
  /* movers */
  let movers='';if(rowsPrev&&c.dimA){const pm=new Map(Studio.group(m,Studio.filter(m,{range:prevR,filters:c.filters,exclude:c.dimA}),c.dimA,c.measure).map(x=>[x.key,x.v||0]));
    const ch=gA.map(x=>({key:x.key,v:(x.v||0)-(pm.get(x.key)||0)}));for(const[k,v]of pm)if(!gA.find(x=>x.key===k))ch.push({key:k,v:-v});
    const up=ch.filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,5),dn=ch.filter(x=>x.v<0).sort((a,b)=>a.v-b.v).slice(0,5);
    movers=h('div',{class:'card w7'},h('div',{class:'ch-head'},h('h3',{},`Movers vs previous period · ${c.dimA}`)),up.length||dn.length?hbars([...up,...dn],{fmtV:v=>F(c.measure,Math.abs(v)),signed:true,onPick:k=>toggle(c.dimA,k),selected:selA}):h('p',{class:'small muted'},'No change to show.'))}
  /* weekday */
  let wk='';if(m.dateCol&&gran==='day'){const by=[0,1,2,3,4,5,6].map(()=>[]);for(const r of rowsAll){const d=r[m.dateCol];if(d)by[parseD(d).getDay()].push(r)}
    const items=[1,2,3,4,5,6,0].map(i=>{const days=new Set(by[i].map(r=>r[m.dateCol])).size||1;const v=Studio.val(m,by[i],c.measure);return{key:WD[i],v:Studio.isRate(m,c.measure)?v:(v||0)/days}});
    wk=h('div',{class:'card w4'},h('div',{class:'ch-head'},h('h3',{},'Average day of week')),hbars(items,{fmtV:v=>F(c.measure,v)}))}
  /* insights */
  const ins=insights(m,c,rowsAll,rowsPrev,gA,F,per);const exBox=h('div',{});
  const insCard=h('div',{class:'card w12'},h('div',{class:'ch-head'},h('h3',{},'What Nila sees'),h('button',{class:'btn sm teal',onclick:()=>explain('dashboard',{report:m.ds.name,period:per,measure:c.measure,filters:c.filters,insights:ins.map(x=>x.text),top:gA.slice(0,10).map(x=>({[c.dimA]:x.key,value:x.v}))},exBox)},'Explain with Nila')),h('div',{class:'insights'},ins.map(x=>h('div',{class:'insight'},h('span',{class:'ico',style:`background:${x.bg};color:${x.fg}`},x.icon),h('span',{},x.text)))),exBox);
  /* pivot */
  const piv=pivotCard(m,c,rowsAll,F,set);
  body.replaceChildren(fbar,kpis,h('div',{class:'dash'},insCard,trend,top,movers,mix,wk,piv));
  if(!rowsAll.length)body.insertBefore(h('div',{class:'banner'},'No rows match these filters. Clear a filter or widen the period.'),kpis)}
function slicer(m,dim,c,toggle,set){const sel=new Set((c.filters[dim]||[]).map(String));let pop=null;
  const btn=h('button',{class:sel.size?'on':'','aria-haspopup':'true'},h('span',{},dim),h('small',{},sel.size?`· ${sel.size}`:'· all'),h('span',{html:'<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="m7 10 5 5 5-5"/></svg>',style:'display:contents'}));
  const wrap=h('div',{class:'slicer'},btn);
  const close=()=>{if(pop){pop.remove();pop=null;document.removeEventListener('click',outside,true)}};const outside=e=>{if(!wrap.contains(e.target))close()};
  btn.onclick=()=>{if(pop){close();return}const vals=Studio.group(m,Studio.filter(m,{range:Studio.range(m,c.range,c.from,c.to),filters:c.filters,exclude:dim}),dim,c.measure).sort((a,b)=>(b.v||0)-(a.v||0));
    const q=h('input',{type:'search',placeholder:'Search '+dim});const list=h('div',{});const draw=()=>{const s=q.value.toLowerCase();list.replaceChildren(...vals.filter(x=>!s||x.key.toLowerCase().includes(s)).slice(0,200).map(x=>{const cb=h('input',{type:'checkbox',checked:sel.has(x.key)});cb.onchange=()=>{cb.checked?sel.add(x.key):sel.delete(x.key)};return h('label',{},cb,h('span',{style:'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'},x.key),h('span',{class:'mono small muted'},Studio.fmt(m,c.measure,x.v)))}))};q.oninput=draw;draw();
    pop=h('div',{class:'pop'},q,list,h('div',{class:'row'},h('button',{class:'btn sm primary',onclick:()=>{close();const f={...c.filters};if(sel.size)f[dim]=[...sel];else delete f[dim];set({filters:f})}},'Apply'),h('button',{class:'btn sm ghost',onclick:()=>{sel.clear();draw()}},'Clear')));wrap.append(pop);setTimeout(()=>document.addEventListener('click',outside,true));q.focus()};
  return wrap}
function insights(m,c,rows,prev,gA,F,per){const out=[];const v=Studio.val(m,rows,c.measure);const p=prev&&prev.length?Studio.val(m,prev,c.measure):null;
  if(p){const d=v/p-1;out.push({icon:d>=0?'▲':'▼',bg:d>=0?'var(--good-soft)':'var(--bad-soft)',fg:d>=0?'var(--good)':'var(--bad)',text:`${c.measure} is ${F(c.measure,v)} for ${per}, ${d>=0?'up':'down'} ${Math.abs(d*100).toFixed(1)}% vs the previous period (${F(c.measure,p)}).`})}
  else out.push({icon:'Σ',bg:'var(--teal-soft)',fg:'var(--teal)',text:`${c.measure} is ${F(c.measure,v)} for ${per}.`});
  if(prev&&c.dimA&&!Studio.isRate(m,c.measure)){const pm=new Map(Studio.group(m,prev,c.dimA,c.measure).map(x=>[x.key,x.v||0]));const ch=gA.map(x=>({k:x.key,d:(x.v||0)-(pm.get(x.key)||0),p:pm.get(x.key)||0}));ch.sort((a,b)=>b.d-a.d);
    const up=ch[0],dn=ch.at(-1);if(up&&up.d>0)out.push({icon:'↗',bg:'var(--good-soft)',fg:'var(--good)',text:`Biggest riser: ${up.k}, +${F(c.measure,up.d)}${up.p?` (+${(up.d/up.p*100).toFixed(0)}%)`:''}.`});
    if(dn&&dn.d<0)out.push({icon:'↘',bg:'var(--bad-soft)',fg:'var(--bad)',text:`Biggest drop: ${dn.k}, −${F(c.measure,-dn.d)}${dn.p?` (${(dn.d/dn.p*100).toFixed(0)}%)`:''}. Worth a call.`})}
  if(gA.length>3&&!Studio.isRate(m,c.measure)){const tot=gA.reduce((a,x)=>a+(x.v||0),0);if(tot>0){const s1=gA[0].v/tot,s3=gA.slice(0,3).reduce((a,x)=>a+x.v,0)/tot;out.push({icon:'◔',bg:'var(--violet-soft)',fg:'var(--violet)',text:`${gA[0].key} gives ${(s1*100).toFixed(0)}% of ${c.measure}; the top 3 give ${(s3*100).toFixed(0)}%.${s3>.6?' High dependence on a few accounts.':''}`})}}
  return out}
function pivotCard(m,c,rows,F,set){const p=c.pivot||{};const rD=m.dims.includes(p.rows)?p.rows:c.dimA;const cD=m.dims.includes(p.cols)?p.cols:'';const meas=m.measures.includes(p.measure)?p.measure:c.measure;
  const mk=(opts,val,blank,key)=>{const s=h('select',{},blank!=null?h('option',{value:''},blank):'',opts.map(o=>h('option',{selected:o===val},o)));s.onchange=()=>set({pivot:{...p,rows:rD,cols:cD,measure:meas,[key]:s.value}});return s};
  if(!rD)return'';
  const gr=Studio.group(m,rows,rD,meas).sort((a,b)=>(b.v||0)-(a.v||0)).slice(0,60);
  let colKeys=[];if(cD){colKeys=Studio.group(m,rows,cD,meas).sort((a,b)=>(b.v||0)-(a.v||0)).slice(0,8).map(x=>x.key)}
  const mx=Math.max(...gr.map(x=>Math.abs(x.v||0)),1);
  const heads=[rD,...(cD?colKeys:[]),meas+(cD?' (total)':'')];
  const trs=gr.map(g=>{const cells=[g.key];if(cD){const byC=new Map(Studio.group(m,g.rows,cD,meas).map(x=>[x.key,x.v]));for(const k of colKeys)cells.push(byC.has(k)?F(meas,byC.get(k)):'')}const pc=Math.round(Math.abs(g.v||0)/mx*28);cells.push(h('span',{style:`display:inline-block;padding:1px 6px;border-radius:6px;background:color-mix(in srgb,var(--accent) ${pc}%,transparent)`},F(meas,g.v)));return cells});
  const tot=[ 'Total',...(cD?colKeys.map(k=>F(meas,Studio.val(m,rows.filter(r=>String(r[cD]??'(blank)')===k),meas))):[]),F(meas,Studio.val(m,rows,meas))];
  const numIdx=heads.map((_,i)=>i).slice(1);
  const t=tbl(heads,trs,numIdx);const tb=t.querySelector('tbody');if(tb){const tr=h('tr',{class:'total'},tot.map((x,i)=>h('td',{class:i?'n':''},x)));tb.append(tr)}t.style.maxHeight='460px';
  return h('div',{class:'card '+(m.dateCol&&Studio.gran(Studio.range(m,c.range,c.from,c.to),m)==='day'?'w8':'w12')},h('div',{class:'ch-head'},h('h3',{},'Pivot table'),h('div',{class:'pivot-cfg'},h('span',{class:'small muted'},'Rows'),mk(m.dims,rD,null,'rows'),h('span',{class:'small muted'},'Columns'),mk(m.dims,cD,'None','cols'),h('span',{class:'small muted'},'Value'),mk(m.measures,meas,null,'measure'))),t,gr.length>=60?h('p',{class:'small muted'},'Top 60 rows shown. Filter to see more.'):'')}

/* ---------- fields + joins ---------- */
function openFields(){const ds=dsById(ST.dsId);if(!ds)return;const list=h('div',{class:'calc-list'});
  const draw=()=>list.replaceChildren(...(ST.cfg.calc.length?ST.cfg.calc.map((f,i)=>h('span',{class:'chip violet'},`${f.name} = ${f.formula}`,h('button',{class:'btn ghost sm',style:'padding:0 4px',onclick:()=>{ST.cfg.calc=ST.cfg.calc.filter((_,j)=>j!==i);draw()}},'✕'))):[h('span',{class:'small muted'},'No formulas yet.')]));draw();
  const nm=h('input',{type:'text',placeholder:'Avg fare'}),fm=h('input',{type:'text',placeholder:'[GMV] / [Seats Sold]'}),err=h('p',{class:'small',style:'color:var(--bad)'});
  const cols=h('div',{class:'colnames'},ST.m.measures.map(x=>h('span',{style:'cursor:pointer',onclick:()=>{fm.value+=(fm.value&&!/[\s(+\-*/]$/.test(fm.value)?' ':'')+`[${x}]`;fm.focus()}},x)));
  openSheet('Fields & formulas',h('p',{class:'small muted'},'Make your own numbers from the columns. Tap a column to add it. Use + − × ÷ and brackets. Formulas work on totals, so [GMV] / [Seats] gives the true average fare.'),list,
    h('div',{class:'grid2'},h('label',{class:'field'},h('span',{},'Name'),nm),h('label',{class:'field'},h('span',{},'Formula'),fm)),cols,err,
    h('div',{class:'row'},h('button',{class:'btn primary',onclick:async()=>{try{const name=nm.value.trim();if(!name)throw new Error('Give it a name');if(ST.m.measures.includes(name)&&!ST.cfg.calc.find(c=>c.name===name))throw new Error('That name is already a column');const cpl=Formula.compile(fm.value);const miss=cpl.vars.filter(v=>!ST.m.measures.some(x=>x.toLowerCase()===v.toLowerCase()));if(miss.length)throw new Error('Unknown column: '+miss.join(', '));ST.cfg.calc=[...ST.cfg.calc.filter(c=>c.name!==name),{name,formula:fm.value.trim()}];await applyModelCfg();closeSheet();toast('Added '+name)}catch(e){err.textContent=e.message}}},'Add field'),h('button',{class:'btn',onclick:async()=>{await applyModelCfg();closeSheet()}},'Done')))}
async function applyModelCfg(){const ds=dsById(ST.dsId);ds.studio={...(ds.studio||{}),calc:ST.cfg.calc,joins:ST.cfg.joins};stSave();ST.m=await Studio.model(ds);studioView()}
function openJoin(){const ds=dsById(ST.dsId);const others=S.datasets.filter(d=>d.id!==ds.id);if(!others.length){toast('Upload a second report first, like targets or an account list');return}
  const oSel=h('select',{},others.map(d=>h('option',{value:d.id},d.name)));const kHere=h('select',{},ds.columns.filter(c=>(ds.types||{})[c]==='text').map(c=>h('option',{selected:c===ds.operatorCol},c)));const kThere=h('select',{});const colsBox=h('div',{class:'checks'});
  const fill=()=>{const o=dsById(oSel.value);kThere.replaceChildren(...o.columns.filter(c=>(o.types||{})[c]==='text').map(c=>h('option',{selected:c===o.operatorCol},c)));colsBox.replaceChildren(...o.columns.filter(c=>c!==o.dateCol).map(c=>h('label',{},h('input',{type:'checkbox',value:c}),c)))};oSel.onchange=fill;fill();
  const cur=h('div',{class:'calc-list'},(ST.cfg.joins||[]).map((j,i)=>h('span',{class:'chip teal'},`${(dsById(j.ds)||{}).name||'?'}: ${j.cols.join(', ')}`,h('button',{class:'btn ghost sm',style:'padding:0 4px',onclick:async()=>{ST.cfg.joins=ST.cfg.joins.filter((_,k)=>k!==i);await applyModelCfg();closeSheet()}},'✕'))));
  openSheet('Link another file',h('p',{class:'small muted'},'Bring columns from another report by matching a name, like targets per account or the account owner and tier. Linked numbers count once per account, so targets add up correctly.'),cur,
    h('div',{class:'grid2'},h('label',{class:'field'},h('span',{},'Other report'),oSel),h('label',{class:'field'},h('span',{},'Match this column here'),kHere),h('label',{class:'field'},h('span',{},'…with this column there'),kThere)),h('div',{class:'field'},h('span',{},'Columns to bring'),colsBox),
    h('button',{class:'btn primary',onclick:async()=>{const cols=$$('input:checked',colsBox).map(i=>i.value);if(!cols.length){toast('Pick at least one column');return}ST.cfg.joins=[...(ST.cfg.joins||[]),{ds:oSel.value,key:kHere.value,otherKey:kThere.value,cols}];await applyModelCfg();closeSheet();toast('Linked')}},'Link'))}

/* ---------- export ---------- */
async function exportStudio(rows){if(typeof XLSX==='undefined'){toast('Excel tools are still loading');return}if(!S.downloads){toast('Downloads are not available here');return}
  const m=ST.m,c=ST.cfg;const wb=XLSX.utils.book_new();
  const kp=[['Report',m.ds.name],['Exported',today()],['Filters',JSON.stringify(c.filters)],[],['Number','Value'],...m.measures.map(x=>[x,Studio.val(m,rows,x)])];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(kp),'Summary');
  if(c.dimA){const g=Studio.group(m,rows,c.dimA,c.measure).sort((a,b)=>(b.v||0)-(a.v||0));const aoa=[[c.dimA,...m.measures]];for(const x of g)aoa.push([x.key,...m.measures.map(ms=>Studio.val(m,x.rows,ms))]);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'By '+c.dimA.slice(0,24))}
  const cols=[...m.ds.columns,...m.dims.filter(d=>!m.ds.columns.includes(d))];const data=rows.map(r=>{const o={};for(const k of cols){const v=r[k];o[k]=k===m.dateCol&&v?new Date(v+'T00:00:00'):v}return o});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data,{header:cols,cellDates:true}),'Data');
  const buf=XLSX.write(wb,{type:'array',bookType:'xlsx',cellDates:true});
  try{await S.downloads.save({filename:`${m.ds.name.replace(/[\\/:*?"<>|]+/g,' ')} · Nila ${today()}.xlsx`,data:new Blob([buf])});toast('Excel saved. The Data sheet opens cleanly in Power BI and Tableau.')}catch(e){if(!(e&&e.code==='declined'))toast('Could not save the file')}}

/* ---------- hooks ---------- */
(window.NILA_VIEWS=window.NILA_VIEWS||{}).studio=()=>{if(ST.wantNew&&S.datasets[0]){ST.dsId=S.datasets[0].id;ST.m=null;ST.wantNew=false}studioView()};
(window.NILA_HOOKS=window.NILA_HOOKS||[]).push(()=>{if(ST.dsId&&!dsById(ST.dsId)){ST.dsId=null;ST.m=null}if(ST.wantNew&&S.datasets[0]&&S.datasets[0].id!==ST.dsId){ST.dsId=S.datasets[0].id;ST.m=null;ST.wantNew=false;closeSheet()}if(S.view==='studio')studioView()});
