/* ===== Nila Deck Builder: pick slides, get a stylish editable PowerPoint from your report ===== */
"use strict";
const SLIDES=[
  {id:'title',name:'Title',desc:'Cover with period and your name',on:true,art:'title'},
  {id:'summary',name:'Executive summary',desc:'4 KPI cards with change vs previous period, plus key insights',on:true,art:'kpi'},
  {id:'trend',name:'Trend',desc:'Line chart: this period vs previous, with peak and low',on:true,art:'line',need:'date'},
  {id:'top',name:'Top 10',desc:'Bar chart of the biggest accounts, routes or products',on:true,art:'bars',need:'dimA'},
  {id:'movers',name:'Movers',desc:'Who grew and who dropped the most',on:true,art:'movers',need:'prev'},
  {id:'mix',name:'Mix and share',desc:'Doughnut chart with share table',on:true,art:'donut',need:'dimB'},
  {id:'table',name:'Breakdown table',desc:'Top 12 with this period, previous, change and share',on:false,art:'table',need:'dimA'},
  {id:'weekday',name:'Day-of-week pattern',desc:'Which days sell best',on:false,art:'cols',need:'daily'},
  {id:'deep',name:'Account deep-dives',desc:'One slide per top account: KPIs, trend, top split',on:true,art:'deep',need:'dimA'},
  {id:'forecast',name:'Outlook (forecast)',desc:'Next 8 weeks with likely range and tested accuracy',on:true,art:'fc',need:'date'},
  {id:'kra',name:'KRA scorecard',desc:'This month\'s KRAs, achievement and rating',on:false,art:'table',need:'kra'},
  {id:'actions',name:'Action plan',desc:'Open follow-ups with owner and due date',on:false,art:'table',need:'actions'},
  {id:'next',name:'Next steps',desc:'Your asks and plan, written by you (Nila suggests)',on:true,art:'bullets'},
  {id:'thanks',name:'Thank you',desc:'Closing slide',on:true,art:'title'}];
const DK={dsId:null,range:'30',from:'',to:'',account:'',measure:'',dimA:'',dimB:'',style:(()=>{try{return JSON.parse(localStorage.getItem('nila.deckstyle'))||'aurora'}catch(e){return'aurora'}})(),title:'',picks:new Set(SLIDES.filter(s=>s.on).map(s=>s.id)),deepN:5,next:'',filters:{}};

async function deckData(){const ds=dsById(DK.dsId);const m=(typeof ST!=='undefined'&&ST.m&&ST.m.ds===ds)?ST.m:await Studio.model(ds);
  const measure=m.measures.includes(DK.measure)?DK.measure:Studio.pickMeasures(m)[0];const dims=Studio.pickDims(m);const dimA=m.dims.includes(DK.dimA)?DK.dimA:dims[0]||'';const dimB=m.dims.includes(DK.dimB)?DK.dimB:(dims.find(d=>d!==dimA)||'');
  const filters={...(DK.filters||{})};if(DK.account&&dimA)filters[dimA]=[DK.account];
  const range=Studio.range(m,DK.range,DK.from,DK.to);const prevR=Studio.prevRange(range);
  const rows=Studio.filter(m,{range,filters}),prev=prevR?Studio.filter(m,{range:prevR,filters}):null;
  const F=(c,v)=>Studio.fmt(m,c,v);const per=range?`${prettyY(range.from)} – ${prettyY(range.to)}`:(ds.minDate?`${prettyY(ds.minDate)} – ${prettyY(ds.maxDate)}`:'All data');
  const ks=[measure,...Studio.pickMeasures(m).filter(x=>x!==measure)].slice(0,4);
  const kpis=ks.map(k=>{const v=Studio.val(m,rows,k),p=prev&&prev.length?Studio.val(m,prev,k):null;return{label:k,value:F(k,v),raw:v,delta:p?v/p-1:null,bad:/cancel|refund|cost|spend|burn/i.test(k)}});
  const gran=Studio.gran(range,m);
  const s1=m.dateCol?Studio.series(m,rows,measure,gran):[];let s0=null;if(prev&&prev.length&&m.dateCol){const pv=Studio.series(m,prev,measure,gran);s0=s1.map((_,i)=>pv[i]?pv[i].v:null)}
  const gA=dimA?Studio.group(m,DK.account?Studio.filter(m,{range,filters:DK.filters||{}}):rows,dimA,measure).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v):[];
  const pmA=new Map(prev&&dimA?Studio.group(m,DK.account?Studio.filter(m,{range:prevR,filters:DK.filters||{}}):prev,dimA,measure).map(x=>[x.key,x.v||0]):[]);
  const ch=gA.map(x=>({key:x.key,v:(x.v||0)-(pmA.get(x.key)||0)}));
  const totA=gA.reduce((a,x)=>a+(x.v||0),0);
  const gB=dimB?Studio.group(m,rows,dimB,measure).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v):[];
  let mix=gB.slice(0,6).map(x=>({key:x.key,v:x.v}));if(gB.length>6)mix.push({key:'Others',v:gB.slice(6).reduce((a,x)=>a+(x.v||0),0)});
  let weekday=null;if(m.dateCol&&gran==='day'){const by=[0,1,2,3,4,5,6].map(()=>[]);for(const r of rows){const d=r[m.dateCol];if(d)by[parseD(d).getDay()].push(r)}weekday=[1,2,3,4,5,6,0].map(i=>{const n=new Set(by[i].map(r=>r[m.dateCol])).size||1;const v=Studio.val(m,by[i],measure);return{key:WD[i],v:Studio.isRate(m,measure)?v:(v||0)/n}})}
  const deepList=(DK.account?gA.filter(x=>x.key===DK.account):gA).slice(0,DK.account?1:DK.deepN).map((x,i)=>{const all=Studio.filter(m,{filters:{...(DK.filters||{}),[dimA]:[x.key]}});let wk=m.dateCol?Studio.series(m,all,measure,'week'):[];if(wk.length&&addDays(wk.at(-1).k,6)>(ds.maxDate||today()))wk=wk.slice(0,-1);wk=wk.slice(-12);const p=pmA.get(x.key)||0;
    return{key:x.key,v:x.v,rank:gA.indexOf(x)+1,delta:p?x.v/p-1:null,share:totA?x.v/totA:null,weeks:wk,split:dimB?Studio.group(m,x.rows,dimB,measure).filter(y=>y.v!=null).sort((a,b)=>b.v-a.v).slice(0,6):[],second:ks[1]?{label:ks[1],value:F(ks[1],Studio.val(m,x.rows,ks[1]))}:null}});
  let fc=null;if(m.dateCol){try{const all=Studio.filter(m,{filters});const wk=Studio.series(m,all,measure,'week').map(x=>({period:x.k,value:x.v}));const last=wk.at(-1);if(last&&addDays(last.period,6)>(ds.maxDate||today()))last.partial=true;fc=forecastSeries(wk,8,'week',0);fc.hist=fc.history.slice(-12)}catch(e){fc={error:e.message}}}
  const ins=insights(m,{measure,dimA,filters},rows,prev,gA,F,per).map(x=>x.text);
  const kraM=today().slice(0,7);const kraDoc=typeof kraGet==='function'?kraGet(kraM):null;
  const acts=openFollowups().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,10);
  const head=kpis[0]&&kpis[0].delta!=null?`${measure} ${kpis[0].delta>=0?'up':'down'} ${Math.abs(kpis[0].delta*100).toFixed(1)}% to ${kpis[0].value}`:`${measure}: ${kpis[0]?kpis[0].value:'–'}`;
  const nextDefault=[...ch.filter(x=>x.v<0).sort((a,b)=>a.v-b.v).slice(0,2).map(x=>`Recover ${x.key}: down ${F(measure,-x.v)} vs previous period`),...ch.filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,2).map(x=>`Scale what works at ${x.key}: up ${F(measure,x.v)}`),...acts.slice(0,2).map(a=>`${a.operator?a.operator+': ':''}${a.nextAction}${a.due?' by '+pretty(a.due):''}`)].join('\n');
  return{ds,m,measure,dimA,dimB,range,prevR,rows,prev,F,per,prevPer:prevR?`${pretty(prevR.from)} – ${pretty(prevR.to)}`:'',kpis,gran,s1,s0,gA,ch,totA,mix,weekday,deepList,fc,ins,kraM,kraDoc,acts,head,nextDefault}}

function deckAvail(D,id){const s=SLIDES.find(x=>x.id===id);switch(s.need){case'date':return!!D.m.dateCol;case'dimA':return!!D.dimA&&D.gA.length>0;case'dimB':return!!D.dimB&&D.mix.length>1&&!Studio.isRate(D.m,D.measure);case'prev':return!!(D.prev&&D.prev.length)&&!!D.dimA;case'daily':return!!D.weekday;case'kra':return!!(D.kraDoc&&D.kraDoc.items&&D.kraDoc.items.length);case'actions':return D.acts.length>0;default:return true}}

/* ---------- view ---------- */
async function deckView(){const v=$('#view-deck');if(!v)return;
  if(!S.datasets.length){v.replaceChildren(h('div',{class:'view-head'},h('div',{},h('h2',{},'Deck Builder'),h('p',{class:'muted small'},'Pick the slides you want; Nila fills them from your report and gives you an editable PowerPoint with real charts.'))),h('div',{class:'empty'},h('h3',{},'Upload a report first'),h('p',{class:'small muted'},'Any Excel works: Red Deal revenue, KAM dashboard, service information.'),h('div',{class:'row'},h('button',{class:'btn sm primary',onclick:()=>go('studio')},'Open Studio'),h('button',{class:'btn sm',onclick:loadDemo},'Try demo data'))));return}
  if(window.DECK_PRESET){const p=window.DECK_PRESET;window.DECK_PRESET=null;Object.assign(DK,{dsId:p.dsId,range:p.range||'30',from:p.from||'',to:p.to||'',measure:p.measure||'',dimA:p.dimA||'',dimB:p.dimB||'',filters:p.filters||{},account:''})}
  if(!DK.dsId||!dsById(DK.dsId))DK.dsId=(lsGet('nila.studio.last',null)&&dsById(lsGet('nila.studio.last',null)))?lsGet('nila.studio.last',null):S.datasets[0].id;
  const ds=dsById(DK.dsId);const m=(typeof ST!=='undefined'&&ST.m&&ST.m.ds===ds)?ST.m:await Studio.model(ds);
  if(!m.measures.includes(DK.measure))DK.measure=Studio.pickMeasures(m)[0]||'';const dims=Studio.pickDims(m);if(!m.dims.includes(DK.dimA))DK.dimA=dims[0]||'';if(!m.dims.includes(DK.dimB))DK.dimB=dims.find(d=>d!==DK.dimA)||'';
  const D=await deckData();if(!DK.next)DK.next=D.nextDefault;
  const sel=(opts,val,on,blank)=>{const s=h('select',{},blank!=null?h('option',{value:''},blank):'',opts.map(o=>Array.isArray(o)?h('option',{value:o[0],selected:o[0]===val},o[1]):h('option',{selected:o===val},o)));s.onchange=()=>{on(s.value);deckView()};return s};
  const accs=D.gA.slice(0,300).map(x=>x.key);
  if(!DK.title)DK.title=`${S.settings.company&&S.settings.company!=='My company'?S.settings.company+' ':''}${DK.account?DK.account+' ':''}${D.measure} review`;const title=h('input',{type:'text',value:DK.title});title.oninput=()=>DK.title=title.value;
  const nextTa=h('textarea',{rows:5},DK.next);nextTa.oninput=()=>DK.next=nextTa.value;
  const avail=SLIDES.filter(s=>deckAvail(D,s.id));
  const count=()=>{let n=0;for(const s of avail)if(DK.picks.has(s.id))n+=s.id==='deep'?D.deepList.length:1;return n};
  const cnt=h('b',{});const upd=()=>cnt.textContent=`${count()} slides`;
  const picks=h('div',{class:'picks'},avail.map(s=>{const cb=h('input',{type:'checkbox',checked:DK.picks.has(s.id)});const card=h('label',{class:'pick'+(DK.picks.has(s.id)?' on':'')},thumb(s,D),h('span',{class:'lbl'},cb,s.id==='deep'?`${s.name} (${D.deepList.length})`:s.name),h('small',{},s.desc));cb.onchange=()=>{cb.checked?DK.picks.add(s.id):DK.picks.delete(s.id);card.classList.toggle('on',cb.checked);upd()};return card}));upd();
  v.replaceChildren(h('div',{class:'view-head'},h('div',{},h('h2',{},'Deck Builder'),h('p',{class:'muted small'},'Choose a report and the slides you want. Nila fills every slide from your data and builds a stylish PowerPoint with real, editable charts.'))),
    h('div',{class:'card'},h('div',{class:'grid2'},
      h('label',{class:'field'},h('span',{},'Report'),sel(S.datasets.map(d=>[d.id,d.name+(d.demo?' (demo)':'')]),DK.dsId,x=>{DK.dsId=x;DK.measure='';DK.dimA='';DK.dimB='';DK.account='';DK.filters={};DK.next='';DK.title=''})),
      m.dateCol?h('label',{class:'field'},h('span',{},'Period'),sel([['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['mtd','Month to date'],['lm','Last full month'],['all','All data']],DK.range,x=>{DK.range=x;DK.next=''})):'',
      h('label',{class:'field'},h('span',{},'Main number'),sel(m.measures,DK.measure,x=>{DK.measure=x;DK.next='';DK.title=''})),
      DK.dimA?h('label',{class:'field'},h('span',{},'Rank by'),sel(m.dims,DK.dimA,x=>{DK.dimA=x;DK.account=''})):'',
      DK.dimB?h('label',{class:'field'},h('span',{},'Mix by'),sel(m.dims,DK.dimB,x=>DK.dimB=x)):'',
      DK.dimA?h('label',{class:'field'},h('span',{},'For one '+DK.dimA.toLowerCase()+' only'),sel(accs,DK.account,x=>{DK.account=x;DK.next='';DK.title=''},'All')):'',
      h('label',{class:'field'},h('span',{},'Deep-dives'),sel([['3','Top 3'],['5','Top 5'],['8','Top 8'],['10','Top 10']],String(DK.deepN),x=>DK.deepN=Number(x))),
      ),
      h('label',{class:'field'},h('span',{},'Deck title'),title),
      Object.keys(DK.filters||{}).length?h('p',{class:'small muted'},'Using Studio filters: ',Object.entries(DK.filters).map(([k,v])=>`${k}: ${v.join(', ')}`).join(' · '),' ',h('button',{class:'btn ghost sm',onclick:()=>{DK.filters={};deckView()}},'Remove')):''),
    h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},'Deck style'),h('span',{class:'small muted'},'Your pick is remembered')),styleGallery()),
    h('div',{class:'row between'},h('h3',{},'Slides'),h('div',{class:'row'},h('button',{class:'btn ghost sm',onclick:()=>{avail.forEach(s=>DK.picks.add(s.id));deckView()}},'Select all'),h('button',{class:'btn ghost sm',onclick:()=>{DK.picks.clear();DK.picks.add('title');deckView()}},'Clear'))),
    picks,
    DK.picks.has('next')?h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},'Next steps slide'),h('button',{class:'btn ghost sm',onclick:()=>{DK.next=D.nextDefault;nextTa.value=DK.next}},'Reset to Nila\'s suggestion')),h('p',{class:'small muted'},'One line per bullet. Edit freely.'),nextTa):'',
    h('div',{class:'deckbar'},cnt,h('span',{class:'small muted'},`${D.per} · ${(DECK_STYLES.find(x=>x[0]===DK.style)||['',''])[1]} style`),h('span',{style:'flex:1'}),h('button',{class:'btn primary',onclick:ev=>buildDeck(ev.currentTarget)},h('span',{html:'<svg class="i" viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',style:'display:contents'}),'Download PowerPoint')))}
function thumb(s,D){const C=DSTY[DK.style]||DSTY.aurora;const light=true;const t=h('div',{class:'thumb',style:`background:#${C.bg};color:#${C.ink}`},h('span',{class:'moon',style:C.decor?'display:none':''}),h('span',{class:'k',style:`color:#${C.gold}`},s.name.toUpperCase()));
  const bars=n=>h('div',{class:'bars'},Array.from({length:n},(_,i)=>h('i',{style:`height:${30+((i*37)%70)}%;background:#${C.pal[i%2]}`})));
  if(s.art==='title')t.append(h('span',{class:'t',style:'margin-top:auto;font-size:.8rem'},s.id==='thanks'?'Thank you':(DK.title||'Review')),h('span',{style:'opacity:.7'},D.per));
  else if(s.art==='kpi')t.append(h('span',{class:'t'},D.head),h('div',{style:'display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:auto'},D.kpis.map(k=>h('span',{style:`border-radius:3px;padding:3px;background:#${C.cards?C.cards[0]:C.panel}`},h('b',{style:'display:block;font-size:.55rem'},k.value),k.label.slice(0,10)))));
  else if(s.art==='donut')t.append(h('span',{class:'t'},'Share by '+D.dimB),h('span',{style:'margin:auto;width:42%;aspect-ratio:1;border-radius:50%;background:conic-gradient(#8C9BFF 0 38%,#F2C46D 0 62%,#5DDB9E 0 80%,#FF8FA3 0 100%);-webkit-mask:radial-gradient(circle,transparent 45%,#000 46%);mask:radial-gradient(circle,transparent 45%,#000 46%)'}));
  else if(s.art==='line'||s.art==='fc')t.append(h('span',{class:'t'},s.art==='fc'?'Next 8 weeks':D.measure+' trend'),h('span',{style:'margin-top:auto',html:`<svg viewBox="0 0 100 34" style="width:100%"><path d="M0 28 L15 22 L30 25 L45 14 L60 17 L75 8 L100 5" fill="none" stroke="#F2C46D" stroke-width="2.4"/>${s.art==='fc'?'<path d="M75 8 L100 3" stroke="#8C9BFF" stroke-width="2" stroke-dasharray="3 2" fill="none"/>':'<path d="M0 30 L20 27 L40 26 L60 22 L80 19 L100 15" fill="none" stroke="#676E8C" stroke-width="1.4" stroke-dasharray="3 2"/>'}</svg>`}));
  else if(s.art==='deep')t.append(h('span',{class:'t'},D.deepList[0]?D.deepList[0].key:'Account'),bars(6));
  else if(s.art==='bullets')t.append(h('span',{class:'t'},'Next steps'),...(DK.next||'').split('\n').filter(Boolean).slice(0,3).map(x=>h('span',{},'• '+x.slice(0,40))));
  else if(s.art==='table')t.append(h('span',{class:'t'},s.name),...[0,1,2,3].map(()=>h('span',{style:`height:5px;border-radius:2px;background:#${C.panel2}`})));
  else t.append(h('span',{class:'t'},s.id==='top'?'Top 10 '+D.dimA:s.name),bars(s.art==='movers'?8:10));
  return t}

/* ---------- PowerPoint ---------- */
const DSTY={
  consult:{bg:'FFFFFF',panel:'F1F4F8',panel2:'E5EAF1',ink:'0E2240',muted:'5B6B82',gold:'0E7C86',line:'DCE3EC',good:'11865C',bad:'C0392B',pal:['0E2240','0E7C86','5B8DEF','E3A008','9B2C5B','6B7A90','2BB0A6','B0BCCB'],prev:'C5CEDA',
    decor:(s,SH,t)=>{if(t){s.addShape(SH.rect,{x:0,y:0,w:0.38,h:7.5,fill:{color:'0E2240'},line:{color:'0E2240'}});s.addShape(SH.rect,{x:0.38,y:0,w:0.08,h:7.5,fill:{color:'0E7C86'},line:{color:'0E7C86'}})}else s.addShape(SH.rect,{x:0.42,y:0.72,w:0.07,h:0.58,fill:{color:'0E7C86'},line:{color:'0E7C86'}})}},
  blocks:{bg:'FFE45C',panel:'FFFFFF',panel2:'FFF6C2',ink:'111111',muted:'3D3D3D',gold:'111111',line:'E8D24A',good:'0B7A3E',bad:'C62828',pal:['111111','FF5C39','3D5AFE','00A86B','8E24AA','F57C00','00838F','757575'],prev:'9E9E9E',font:'Arial',hfont:'Arial Black',
    decor:(s,SH,t)=>{if(t){s.addShape(SH.rect,{x:8.9,y:0,w:4.43,h:7.5,fill:{color:'FF5C39'},line:{color:'FF5C39'}});s.addShape(SH.rect,{x:8.9,y:5.6,w:4.43,h:1.9,fill:{color:'111111'},line:{color:'111111'}})}else s.addShape(SH.rect,{x:12.33,y:0,w:1.0,h:0.55,fill:{color:'FF5C39'},line:{color:'FF5C39'}})}},
  bento:{bg:'F4F4F1',panel:'FFFFFF',panel2:'ECECE6',ink:'191919',muted:'5A5A5A',gold:'FF6B4A',line:'E4E4DE',good:'1E9E5A',bad:'D9362F',pal:['191919','FF6B4A','22A06B','5B7CFF','F2B705','E05FA0','2BB3B3','8A8A84'],prev:'BDBDB5',cards:['FFE3EC','DFF3E4','E2E8FF','FFF3C9'],
    decor:(s,SH,t)=>{if(t)[[9.0,0.6,3.6,2.9,'FFE3EC'],[9.0,3.7,1.7,3.2,'DFF3E4'],[10.9,3.7,1.7,1.5,'E2E8FF'],[10.9,5.4,1.7,1.5,'FFF3C9']].forEach(([x,y,w,hh,c])=>s.addShape(SH.roundRect,{x,y,w,h:hh,rectRadius:0.25,fill:{color:c},line:{color:c}}))}},
  royal:{bg:'0B1530',panel:'111E40',panel2:'18295A',ink:'F5EEDC',muted:'A9B3CF',gold:'D4AF37',line:'2B3A66',good:'7FD1A3',bad:'F08A8A',pal:['D4AF37','7FA7FF','7FD1A3','E58FA0','9AD8F0','C5A3FF','F0A35E','A9B3CF'],prev:'4A5A8A',hfont:'Georgia',
    decor:(s,SH,t)=>{s.addShape(SH.rect,{x:0.22,y:0.22,w:12.89,h:7.06,fill:{color:'0B1530',transparency:100},line:{color:'D4AF37',width:t?1.5:0.75,transparency:t?20:55}});if(t)s.addShape(SH.ellipse,{x:9.2,y:1.2,w:3.4,h:3.4,fill:{color:'D4AF37',transparency:85},line:{color:'D4AF37',transparency:40}})}},
  mono:{bg:'FFFFFF',panel:'F2F2F2',panel2:'E6E6E6',ink:'000000',muted:'555555',gold:'E3061B',line:'DDDDDD',good:'1B7F3B',bad:'E3061B',pal:['000000','E3061B','6E6E6E','A8A8A8','2B2B2B','C4C4C4','8A8A8A','D0D0D0'],prev:'BBBBBB',font:'Arial',hfont:'Arial Black',
    decor:(s,SH,t)=>{if(t){s.addShape(SH.rect,{x:0,y:0,w:0.28,h:7.5,fill:{color:'E3061B'},line:{color:'E3061B'}});s.addShape(SH.rect,{x:9.6,y:0,w:3.73,h:7.5,fill:{color:'000000'},line:{color:'000000'}})}else s.addShape(SH.rect,{x:12.53,y:0.42,w:0.2,h:0.2,fill:{color:'E3061B'},line:{color:'E3061B'}})}},
  glass:{bg:'EEF3FB',panel:'FFFFFF',panel2:'E3ECFA',ink:'0F172A',muted:'475467',gold:'0A84FF',line:'D6E2F5',good:'12A150',bad:'E5383B',pal:['0A84FF','FF6FB5','30D158','FF9F0A','5AC8FA','5E5CE6','FFD60A','8E8E93'],prev:'B7C4D9',cardT:30,blobs:['9CC8FF','FFC8E6','B8F0DC'],blobT:[55,58,55],blobTT:[45,50,48,40]},
  aurora:{bg:'FFFFFF',panel:'F7F4FF',panel2:'EEE8FF',ink:'1B1640',muted:'5F5A85',gold:'6D4AFF',line:'E6E0F8',good:'0E9F6E',bad:'E0245E',pal:['6D4AFF','FF5FA2','10B98A','FF9F5A','22A6E0','A855F7','F2B705','64748B'],prev:'C9C4E0',blobs:['7C5CFF','FF5FA2','FF9F5A']},
  dark:{bg:'0B0D18',panel:'161A2D',panel2:'1D2238',ink:'EEF0FA',muted:'9AA0BA',gold:'F2C46D',line:'2A3052',good:'5DDB9E',bad:'FF7A8A',pal:['8C9BFF','F2C46D','5DDB9E','FF8FA3','6FD6E8','C9A2FF','F59E62','A3B1C9'],prev:'5C6384'},
  light:{bg:'FFFFFF',panel:'F3F4F9',panel2:'E9EBF4',ink:'11142A',muted:'5A6080',gold:'B47A16',line:'DDE1EC',good:'16865A',bad:'C8344B',pal:['4B5BE0','D4952A','1E9E68','E0567A','1F9FB5','8B5CF6','E07A2F','6B7A99'],prev:'B5BACB'}};
let FONT='Calibri',FONT_T='Calibri';
const barBox=(n,maxH,y)=>{const hh=Math.min(maxH,0.62*n+0.7);return{y:y+(maxH-hh)/2*0,h:hh}};
function scaleOf(m,meas,vals){if(Studio.isRate(m,meas))return{div:1,unit:'',fmt:'0.0'};const mx=Math.max(...vals.map(v=>Math.abs(v||0)),0);const money=MONEY_RE.test(meas);
  if(mx>=1e7)return{div:1e7,unit:money?'₹ Cr':'Cr',fmt:'0.00'};if(mx>=1e5)return{div:1e5,unit:money?'₹ L':'L',fmt:'0.0'};if(mx>=1e4)return{div:1e3,unit:money?'₹ K':'K',fmt:'0.0'};return{div:1,unit:money?'₹':'',fmt:'#,##0'}}
async function buildDeck(btn){if(typeof PptxGenJS==='undefined'){toast('PowerPoint tools are still loading. Try again in a moment.');return}if(!S.downloads){toast('Downloads are not available here');return}
  const old=btn.innerHTML;btn.disabled=true;btn.textContent='Building your deck…';
  try{const D=await deckData();const C=DSTY[DK.style]||DSTY.aurora;FONT=C.font||'Calibri';FONT_T=C.hfont||FONT;const p=new PptxGenJS();p.layout='LAYOUT_WIDE';p.author=S.settings.name||'Nila AI';p.company=S.settings.company||'';p.title=DK.title||'Review';
    const SH=p.ShapeType;let page=0;const foot=[S.settings.company,S.settings.name].filter(Boolean).join(' · ');
    const base=(kicker,title,opts={})=>{const s=p.addSlide();page++;s.background={color:C.bg};
      if(C.decor)C.decor(s,SH,false);else if(C.blobs){const T=C.blobT||[88,86,82];[[10.2,-2.2,4.4,C.blobs[0],T[0]],[11.6,-1.4,3.4,C.blobs[1],T[1]],[12.2,-0.4,2.2,C.blobs[2],T[2]]].forEach(([x,y,w,c,t])=>s.addShape(SH.ellipse,{x,y,w,h:w,fill:{color:c,transparency:t},line:{color:c,transparency:100}}))}
      else{s.addShape(SH.ellipse,{x:10.9,y:-1.9,w:4.2,h:4.2,fill:{color:C.gold,transparency:90},line:{color:C.gold,transparency:100}});
      s.addShape(SH.ellipse,{x:11.7,y:-1.1,w:2.6,h:2.6,fill:{color:C.gold,transparency:84},line:{color:C.gold,transparency:100}})}
      if(kicker)s.addText(kicker.toUpperCase(),{x:0.6,y:0.38,w:9.5,h:0.3,fontFace:FONT,fontSize:10.5,bold:true,color:C.gold,charSpacing:3});
      if(title)s.addText(title,{x:0.6,y:0.66,w:10.6,h:0.75,fontFace:FONT_T,fontSize:opts.titleSize||26,bold:true,color:C.ink,valign:'top',fit:'shrink'});
      s.addShape(SH.rect,{x:0.6,y:7.02,w:0.5,h:0.03,fill:{color:C.gold},line:{color:C.gold}});
      s.addText(`${foot}${foot?' · ':''}${D.per}`,{x:1.25,y:6.9,w:9,h:0.28,fontFace:FONT,fontSize:9,color:C.muted});
      s.addText(String(page),{x:12.1,y:6.9,w:0.6,h:0.28,fontFace:FONT,fontSize:9,color:C.muted,align:'right'});return s};
    const card=(s,x,y,w,hh,label,value,sub,subColor,ci=0)=>{s.addShape(SH.roundRect,{x,y,w,h:hh,rectRadius:0.12,fill:{color:C.cards?C.cards[ci%C.cards.length]:C.panel,transparency:C.cardT||0},line:{color:C.line,width:0.75}});
      s.addText(label.toUpperCase(),{x:x+0.2,y:y+0.14,w:w-0.4,h:0.28,fontFace:FONT,fontSize:9.5,bold:true,color:C.muted,charSpacing:1.5,fit:'shrink'});
      s.addText(value,{x:x+0.2,y:y+0.42,w:w-0.4,h:0.7,fontFace:FONT,fontSize:28,bold:true,color:C.ink,fit:'shrink'});
      if(sub)s.addText(sub,{x:x+0.2,y:y+hh-0.46,w:w-0.4,h:0.3,fontFace:FONT,fontSize:10.5,bold:true,color:subColor||C.muted})};
    const axis={catAxisLabelColor:C.muted,valAxisLabelColor:C.muted,catAxisLabelFontFace:FONT,valAxisLabelFontFace:FONT,catAxisLabelFontSize:10,valAxisLabelFontSize:10,valGridLine:{color:C.line,size:0.5},catGridLine:{style:'none'},catAxisLineShow:false,valAxisLineShow:false,legendColor:C.muted,legendFontFace:FONT,legendFontSize:10,plotArea:{fill:{color:C.bg}},chartArea:{fill:{color:C.bg}}};
    const deltaTxt=(d,bad)=>d==null?['vs previous: n/a',C.muted]:[`${d>=0?'▲':'▼'} ${Math.abs(d*100).toFixed(1)}% vs ${D.prevPer}`,(d>=0)!==!!bad?C.good:C.bad];
    const sideNote=(s,lines,x=9.6,y=1.75,w=3.1)=>{s.addShape(SH.roundRect,{x,y,w,h:4.9,rectRadius:0.12,fill:{color:C.panel,transparency:C.cardT||0},line:{color:C.line,width:0.75}});let yy=y+0.25;for(const[l,v]of lines){s.addText(l.toUpperCase(),{x:x+0.25,y:yy,w:w-0.5,h:0.26,fontFace:FONT,fontSize:9,bold:true,color:C.muted,charSpacing:1.5});s.addText(v,{x:x+0.25,y:yy+0.26,w:w-0.5,h:0.5,fontFace:FONT,fontSize:18,bold:true,color:C.ink,fit:'shrink'});yy+=0.92}};
    const order=SLIDES.filter(s=>DK.picks.has(s.id)&&deckAvail(D,s.id));
    for(const sl of order){
      if(sl.id==='title'||sl.id==='thanks'){const s=p.addSlide();page++;s.background={color:C.bg};
        if(C.decor)C.decor(s,SH,true);else if(C.blobs){const T=C.blobTT||[84,82,80,70];[[6.8,-1.6,6.6,C.blobs[0],T[0]],[9.4,0.4,5.2,C.blobs[1],T[1]],[8.2,3.6,4.6,C.blobs[2],T[2]],[10.4,1.6,2.6,C.blobs[1],T[3]]].forEach(([x,y,w,c,t])=>s.addShape(SH.ellipse,{x,y,w,h:w,fill:{color:c,transparency:t},line:{color:c,transparency:100}}))}
        else{s.addShape(SH.ellipse,{x:7.6,y:-0.9,w:7.6,h:7.6,fill:{color:C.gold,transparency:93},line:{color:C.gold,transparency:100}});
        s.addShape(SH.ellipse,{x:8.7,y:0.2,w:5.4,h:5.4,fill:{color:C.gold,transparency:86},line:{color:C.gold,transparency:100}});
        s.addShape(SH.ellipse,{x:9.9,y:1.4,w:3.0,h:3.0,fill:{color:C.gold,transparency:70},line:{color:C.gold,transparency:100}})}
        s.addText(`NILA AI · ${(S.settings.company||'').toUpperCase()}`,{x:0.8,y:1.6,w:8,h:0.35,fontFace:FONT,fontSize:12,bold:true,color:C.gold,charSpacing:4});
        if(sl.id==='title'){s.addText(DK.title||'Business review',{x:0.8,y:2.1,w:8.2,h:1.9,fontFace:FONT_T,fontSize:40,bold:true,color:C.ink,valign:'top',fit:'shrink'});
          s.addText(D.per+(DK.account?` · ${DK.account}`:''),{x:0.8,y:4.1,w:8,h:0.45,fontFace:FONT,fontSize:18,color:C.gold});
          s.addText([S.settings.name,S.settings.role].filter(Boolean).join(' · ')||' ',{x:0.8,y:5.9,w:8,h:0.35,fontFace:FONT,fontSize:13,color:C.muted});s.addText(prettyY(today()),{x:0.8,y:6.25,w:8,h:0.3,fontFace:FONT,fontSize:11,color:C.muted})}
        else{s.addText('Thank you',{x:0.8,y:2.4,w:8,h:1.2,fontFace:FONT_T,fontSize:48,bold:true,color:C.ink});s.addText([S.settings.name,S.settings.role,S.settings.company].filter(Boolean).join(' · '),{x:0.8,y:3.7,w:8,h:0.4,fontFace:FONT,fontSize:16,color:C.gold})}
        continue}
      if(sl.id==='summary'){const s=base('Executive summary',D.head+(DK.account?` · ${DK.account}`:''));const n=D.kpis.length||1;const w=(12.1-(n-1)*0.25)/n;
        D.kpis.forEach((k,i)=>{const[t,c]=deltaTxt(k.delta,k.bad);card(s,0.6+i*(w+0.25),1.7,w,1.75,k.label,k.value,t,c,i)});
        if(D.ins.length)s.addText(D.ins.slice(0,4).map(x=>({text:x,options:{bullet:{code:'25CF',indent:18},breakLine:true,paraSpaceAfter:8}})),{x:0.6,y:3.75,w:12.1,h:2.9,fontFace:FONT,fontSize:15,color:C.ink,valign:'top'});continue}
      if(sl.id==='trend'){const s=base('Trend',`${D.measure} by ${D.gran}`);const sc=scaleOf(D.m,D.measure,[...D.s1.map(x=>x.v),...(D.s0||[])]);const labels=D.s1.map(x=>pretty(x.k));
        const data=[{name:'This period',labels,values:D.s1.map(x=>x.v==null?null:+(x.v/sc.div).toFixed(2))}];if(D.s0)data.push({name:'Previous period',labels,values:D.s0.map(v=>v==null?null:+(v/sc.div).toFixed(2))});
        s.addChart(p.ChartType.line,data,{x:0.5,y:1.6,w:8.9,h:5.1,...axis,chartColors:[C.gold,C.prev],lineSize:3,lineDataSymbol:'none',showLegend:true,legendPos:'b',catAxisLabelFrequency:Math.max(1,Math.ceil(labels.length/10)),valAxisLabelFormatCode:sc.fmt,valAxisTitle:sc.unit,showValAxisTitle:!!sc.unit,valAxisTitleColor:C.muted,valAxisTitleFontSize:10});
        const vs=D.s1.filter(x=>x.v!=null);const pk=vs.reduce((a,x)=>x.v>a.v?x:a,vs[0]||{v:0,k:''}),lo=vs.reduce((a,x)=>x.v<a.v?x:a,vs[0]||{v:0,k:''});
        sideNote(s,[['Total',D.kpis[0].value],['Change',deltaTxt(D.kpis[0].delta)[0].split(' vs')[0]],['Peak '+D.gran,`${D.F(D.measure,pk.v)} · ${pretty(pk.k)}`],['Low '+D.gran,`${D.F(D.measure,lo.v)} · ${pretty(lo.k)}`],['Per '+D.gran+' avg',D.F(D.measure,vs.reduce((a,x)=>a+x.v,0)/(vs.length||1))]]);continue}
      if(sl.id==='top'){const s=base(`Top ${D.dimA}`,`Top 10 ${D.dimA} by ${D.measure}`);const top=D.gA.slice(0,10);const sc=scaleOf(D.m,D.measure,top.map(x=>x.v));
        s.addChart(p.ChartType.bar,[{name:D.measure,labels:top.map(x=>x.key),values:top.map(x=>+(x.v/sc.div).toFixed(2))}],{x:0.5,y:1.55,w:8.9,h:barBox(top.length,5.2,1.55).h,...axis,barDir:'bar',catAxisOrientation:'maxMin',chartColors:[C.pal[0]],barGapWidthPct:45,showValue:true,dataLabelColor:C.ink,dataLabelFontSize:10,dataLabelFormatCode:sc.fmt,valAxisHidden:true,valGridLine:{style:'none'},showLegend:false});
        const s3=D.totA?top.slice(0,3).reduce((a,x)=>a+x.v,0)/D.totA:null;sideNote(s,[['#1',top[0]?top[0].key:'–'],['#1 value',top[0]?D.F(D.measure,top[0].v):'–'],['Top 3 share',s3==null?'–':(s3*100).toFixed(0)+'%'],['Count',String(D.gA.length)+' '+D.dimA.toLowerCase()],['Unit',sc.unit||'as is']]);continue}
      if(sl.id==='movers'){const s=base('Movers','Who moved the most vs previous period');const up=D.ch.filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,6),dn=D.ch.filter(x=>x.v<0).sort((a,b)=>a.v-b.v).slice(0,6);const sc=scaleOf(D.m,D.measure,[...up,...dn].map(x=>x.v));
        const one=(x,items,title,color)=>{s.addText(title,{x,y:1.6,w:5.9,h:0.35,fontFace:FONT,fontSize:13,bold:true,color});if(items.length)s.addChart(p.ChartType.bar,[{name:title,labels:items.map(i=>i.key),values:items.map(i=>+(Math.abs(i.v)/sc.div).toFixed(2))}],{x,y:2.0,w:5.9,h:barBox(items.length,4.7,2).h,...axis,barDir:'bar',catAxisOrientation:'maxMin',chartColors:[color],showValue:true,dataLabelColor:C.ink,dataLabelFormatCode:sc.fmt,valAxisHidden:true,valGridLine:{style:'none'},showLegend:false,barGapWidthPct:50});else s.addText('No one in this group',{x,y:2.2,w:5.9,h:0.4,fontFace:FONT,fontSize:12,color:C.muted})};
        one(0.6,up,`Grew ${sc.unit?'('+sc.unit+')':''}`,C.good);one(6.8,dn,`Dropped ${sc.unit?'('+sc.unit+')':''}`,C.bad);continue}
      if(sl.id==='mix'){const s=base('Mix',`${D.measure} share by ${D.dimB}`);const tot=D.mix.reduce((a,x)=>a+Math.max(0,x.v||0),0)||1;
        s.addChart(p.ChartType.doughnut,[{name:D.dimB,labels:D.mix.map(x=>x.key),values:D.mix.map(x=>Math.max(0,x.v||0))}],{x:0.5,y:1.55,w:6.2,h:5.2,holeSize:62,chartColors:C.pal,showPercent:true,showValue:false,dataLabelColor:C.bg==='FFFFFF'?'FFFFFF':'0B0D18',dataLabelFontSize:10,showLegend:false,chartArea:{fill:{color:C.bg}},plotArea:{fill:{color:C.bg}}});
        const rows=[[{text:D.dimB,options:{bold:true,color:C.muted,fill:{color:C.panel2}}},{text:D.measure,options:{bold:true,color:C.muted,fill:{color:C.panel2},align:'right'}},{text:'Share',options:{bold:true,color:C.muted,fill:{color:C.panel2},align:'right'}}],...D.mix.map((x,i)=>[{text:'■  '+x.key,options:{color:C.ink}},{text:D.F(D.measure,x.v),options:{align:'right',color:C.ink}},{text:(Math.max(0,x.v||0)/tot*100).toFixed(1)+'%',options:{align:'right',bold:true,color:C.pal[i%8]}}])];
        s.addTable(rows,{x:7.0,y:1.8,w:5.7,colW:[3.0,1.6,1.1],fontFace:FONT,fontSize:12,color:C.ink,fill:{color:C.panel},border:{type:'solid',pt:0.5,color:C.line},rowH:0.42,valign:'middle',autoPage:false});continue}
      if(sl.id==='table'){const s=base('Breakdown',`${D.dimA} at a glance`);const pm=new Map(D.ch.map(x=>[x.key,x.v]));
        const head=[D.dimA,'This period','Previous','Change','Share'].map((t,i)=>({text:t,options:{bold:true,color:C.muted,fill:{color:C.panel2},align:i?'right':'left'}}));
        const rows=[head,...D.gA.slice(0,12).map(x=>{const prevV=(x.v||0)-(pm.get(x.key)||0);const d=prevV?x.v/prevV-1:null;return[{text:x.key,options:{color:C.ink}},{text:D.F(D.measure,x.v),options:{align:'right',color:C.ink,bold:true}},{text:D.prev?D.F(D.measure,prevV):'–',options:{align:'right',color:C.muted}},{text:d==null?'–':`${d>=0?'+':''}${(d*100).toFixed(1)}%`,options:{align:'right',bold:true,color:d==null?C.muted:d>=0?C.good:C.bad}},{text:D.totA?(x.v/D.totA*100).toFixed(1)+'%':'–',options:{align:'right',color:C.ink}}]})];
        s.addTable(rows,{x:0.6,y:1.6,w:12.1,colW:[4.9,2,2,1.6,1.6],fontFace:FONT,fontSize:12,color:C.ink,fill:{color:C.panel},border:{type:'solid',pt:0.5,color:C.line},rowH:0.38,valign:'middle',autoPage:false});continue}
      if(sl.id==='weekday'){const s=base('Pattern','Average day of week');const sc=scaleOf(D.m,D.measure,D.weekday.map(x=>x.v));const best=D.weekday.reduce((a,x)=>x.v>a.v?x:a,D.weekday[0]);
        s.addChart(p.ChartType.bar,[{name:D.measure,labels:D.weekday.map(x=>x.key),values:D.weekday.map(x=>+((x.v||0)/sc.div).toFixed(2))}],{x:0.5,y:1.6,w:8.9,h:5.1,...axis,barDir:'col',chartColors:[C.pal[0]],showValue:true,dataLabelColor:C.ink,dataLabelFormatCode:sc.fmt,valAxisHidden:true,valGridLine:{style:'none'},showLegend:false,barGapWidthPct:40});
        sideNote(s,[['Best day',best.key],['Best day avg',D.F(D.measure,best.v)],['Weekend vs weekday',(()=>{const we=(D.weekday[4].v+D.weekday[5].v+D.weekday[6].v)/3,wd=(D.weekday[0].v+D.weekday[1].v+D.weekday[2].v+D.weekday[3].v)/4;return wd?`${we>=wd?'+':''}${((we/wd-1)*100).toFixed(0)}%`:'–'})()],['Unit',sc.unit||'as is']]);continue}
      if(sl.id==='deep'){for(const a of D.deepList){const s=base(`Account deep-dive · #${a.rank}`,a.key);const[t,c]=deltaTxt(a.delta);
          card(s,0.6,1.6,2.9,1.55,D.measure,D.F(D.measure,a.v),t.split(' vs')[0],c,0);card(s,3.7,1.6,2.9,1.55,'Share of total',a.share==null?'–':(a.share*100).toFixed(1)+'%','Rank #'+a.rank,null,1);if(a.second)card(s,6.8,1.6,2.9,1.55,a.second.label,a.second.value,'',null,2);
          if(a.weeks.length>1){const sc=scaleOf(D.m,D.measure,a.weeks.map(x=>x.v));s.addChart(p.ChartType.line,[{name:'Weekly',labels:a.weeks.map(x=>pretty(x.k)),values:a.weeks.map(x=>x.v==null?null:+(x.v/sc.div).toFixed(2))}],{x:0.5,y:3.35,w:6.4,h:3.4,...axis,chartColors:[C.gold],lineSize:3,lineDataSymbol:'circle',lineDataSymbolSize:5,showLegend:false,valAxisLabelFormatCode:sc.fmt,showTitle:true,title:`Weekly ${D.measure}${sc.unit?' ('+sc.unit+')':''}`,titleColor:C.muted,titleFontSize:11,titleFontFace:FONT})}
          if(a.split.length){const sc=scaleOf(D.m,D.measure,a.split.map(x=>x.v));s.addChart(p.ChartType.bar,[{name:D.dimB,labels:a.split.map(x=>x.key),values:a.split.map(x=>+((x.v||0)/sc.div).toFixed(2))}],{x:7.1,y:3.35,w:5.7,h:Math.max(1.6,barBox(a.split.length,3.4,3.35).h),...axis,barDir:'bar',catAxisOrientation:'maxMin',chartColors:[C.pal[0]],showValue:true,dataLabelColor:C.ink,dataLabelFormatCode:sc.fmt,valAxisHidden:true,valGridLine:{style:'none'},showLegend:false,showTitle:true,title:`By ${D.dimB}${sc.unit?' ('+sc.unit+')':''}`,titleColor:C.muted,titleFontSize:11,titleFontFace:FONT})}}continue}
      if(sl.id==='forecast'){if(!D.fc||D.fc.error){const s=base('Outlook','Forecast needs more history');s.addText(D.fc&&D.fc.error||'Upload at least 4 weeks of data.',{x:0.6,y:1.8,w:11,h:0.6,fontFace:FONT,fontSize:16,color:C.muted});continue}
        const f=D.fc;const hist=f.hist;const labels=[...hist.map(x=>pretty(x.period)),...f.forecast.map(x=>pretty(x.period))];const sc=scaleOf(D.m,D.measure,[...hist.map(x=>x.value),...f.forecast.map(x=>x.hi)]);const r=v=>v==null?null:+(v/sc.div).toFixed(2);
        const s=base('Outlook',`Next 8 weeks: about ${D.F(D.measure,f.total)}`);
        s.addChart(p.ChartType.line,[{name:'Actual',labels,values:[...hist.map(x=>r(x.value)),...f.forecast.map(()=>null)]},{name:'Forecast',labels,values:[...hist.map((x,i)=>i===hist.length-1?r(x.value):null),...f.forecast.map(x=>r(x.value))]},{name:'Low',labels,values:[...hist.map(()=>null),...f.forecast.map(x=>r(x.lo))]},{name:'High',labels,values:[...hist.map(()=>null),...f.forecast.map(x=>r(x.hi))]}],
          {x:0.5,y:1.6,w:8.9,h:5.1,...axis,chartColors:[C.pal[0],C.gold,C.prev,C.prev],lineSize:3,lineDataSymbol:'none',showLegend:true,legendPos:'b',valAxisLabelFormatCode:sc.fmt,valAxisTitle:sc.unit,showValAxisTitle:!!sc.unit,valAxisTitleColor:C.muted,valAxisTitleFontSize:10});
        sideNote(s,[['Next 8 weeks',D.F(D.measure,f.total)],['vs last 8 weeks',f.changeVsLast==null?'–':`${f.changeVsLast>=0?'+':''}${(f.changeVsLast*100).toFixed(1)}%`],['Trend per week',`${f.trendPerStep>=0?'+':''}${D.F(D.measure,f.trendPerStep)}`],['Tested accuracy',f.mape!=null?((1-f.mape)*100).toFixed(0)+'%':'more history needed'],['Method','Holt trend']]);continue}
      if(sl.id==='kra'){const doc=D.kraDoc;const sc=kraScores(doc);const s=base('KRA scorecard',`${pretty(D.kraM)} · ${sc.final!=null?'rating '+sc.final.toFixed(2)+' / 5':'achievement '+(sc.achievement!=null?(sc.achievement*100).toFixed(0)+'%':'–')}`);
        const head=['KRA','KPI','Weight','Target','Actual','Achieved','Rating'].map((t,i)=>({text:t,options:{bold:true,color:C.muted,fill:{color:C.panel2},align:i>1?'right':'left'}}));
        const rows=[head,...doc.items.slice(0,10).map(it=>{const a=kpiAch(it);return[{text:it.kra||'',options:{color:C.ink,bold:true}},{text:it.kpi||'',options:{color:C.ink}},{text:(it.weight||0)+'%',options:{align:'right',color:C.muted}},{text:fmt(it.target),options:{align:'right',color:C.ink}},{text:fmt(it.actual),options:{align:'right',color:C.ink}},{text:a==null?'–':(a*100).toFixed(0)+'%',options:{align:'right',bold:true,color:a==null?C.muted:a>=1?C.good:a>=.9?C.gold:C.bad}},{text:String(it.mgr||it.self||'–'),options:{align:'right',color:C.ink}}]})];
        s.addTable(rows,{x:0.6,y:1.6,w:12.1,colW:[2.6,3.6,1.0,1.4,1.4,1.1,1.0],fontFace:FONT,fontSize:11.5,color:C.ink,fill:{color:C.panel},border:{type:'solid',pt:0.5,color:C.line},rowH:0.4,valign:'middle',autoPage:false});continue}
      if(sl.id==='actions'){const s=base('Action plan','Open follow-ups');const head=[acc(),'Action','Due'].map(t=>({text:t,options:{bold:true,color:C.muted,fill:{color:C.panel2}}}));
        const rows=[head,...D.acts.map(a=>[{text:a.operator||'General',options:{color:C.ink,bold:true}},{text:a.nextAction,options:{color:C.ink}},{text:a.due?prettyY(a.due):'–',options:{color:a.due&&a.due<today()?C.bad:C.muted}}])];
        s.addTable(rows,{x:0.6,y:1.6,w:12.1,colW:[3.0,7.3,1.8],fontFace:FONT,fontSize:12,color:C.ink,fill:{color:C.panel},border:{type:'solid',pt:0.5,color:C.line},rowH:0.42,valign:'middle',autoPage:false});continue}
      if(sl.id==='next'){const s=base('Next steps','What we will do next');const lines=(DK.next||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,7);
        lines.forEach((ln,i)=>{const y=1.7+i*0.72;s.addShape(SH.ellipse,{x:0.62,y:y+0.06,w:0.42,h:0.42,fill:{color:C.gold},line:{color:C.gold}});s.addText(String(i+1),{x:0.62,y:y+0.06,w:0.42,h:0.42,fontFace:FONT,fontSize:13,bold:true,color:C.bg,align:'center',valign:'middle'});s.addText(ln,{x:1.25,y,w:11.4,h:0.55,fontFace:FONT,fontSize:17,color:C.ink,valign:'middle',fit:'shrink'})});continue}
    }
    const blob=await p.write({outputType:'blob'});const name=(DK.title||'Nila deck').replace(/[\\/:*?"<>|]+/g,' ').trim();
    await S.downloads.save({filename:`${name} ${today()}.pptx`,data:blob});toast(`Deck ready: ${page} slides`)}
  catch(e){if(e&&e.code==='declined')toast('Download cancelled');else{console.error(e);toast('Could not build the deck: '+(e.message||'try again'))}}
  finally{btn.disabled=false;btn.innerHTML=old}}

(window.NILA_VIEWS=window.NILA_VIEWS||{}).deck=()=>{deckView().catch(e=>{console.error(e);$('#view-deck').replaceChildren(h('div',{class:'banner'},'Could not open Deck Builder: '+(e.message||e)))})};

const DECK_STYLES=[['aurora','Aurora'],['consult','Consulting Clean'],['glass','Liquid Glass'],['blocks','Bold Blocks'],['bento','Bento Grid'],['royal','Royal Navy & Gold'],['mono','Minimal Mono'],['dark','Eclipse Gold'],['light','Pearl']];
function stylePreview(k){const C=DSTY[k];const el=h('div',{class:'ds-prev',style:`background:#${C.bg};color:#${C.ink}`});
  if(C.blobs)C.blobs.forEach((c,i)=>el.append(h('span',{class:'blob',style:`width:${[60,46,34][i]}%;aspect-ratio:1;right:${[-14,-4,4][i]}%;top:${[-40,-22,-6][i]}%;background:#${c};opacity:${C.blobT?.6:.28}`})));
  if(k==='dark')el.append(h('span',{class:'blob',style:'width:46%;aspect-ratio:1;right:-10%;top:-30%;background:radial-gradient(circle,rgba(242,196,109,.45),transparent 70%)'}));
  if(k==='consult')el.append(h('span',{style:'position:absolute;left:6%;top:34%;width:2px;height:16%;background:#0E7C86'}));
  if(k==='blocks')el.append(h('span',{style:'position:absolute;right:0;top:0;bottom:0;width:30%;background:#FF5C39;z-index:-1'}));
  if(k==='royal')el.append(h('span',{style:'position:absolute;inset:5%;border:1px solid rgba(212,175,55,.6);border-radius:3px;z-index:-1'}));
  if(k==='mono')el.append(h('span',{style:'position:absolute;right:6%;top:9%;width:5px;height:5px;background:#E3061B'}));
  el.append(h('span',{class:'k',style:`color:#${C.gold}`},'Executive summary'),h('span',{class:'t',style:`font-family:${k==='royal'?'Georgia,serif':k==='blocks'||k==='mono'?'Arial Black,Arial,sans-serif':'inherit'}`},'GMV up 7.7%'),h('div',{class:'bars'},[45,70,55,88,62,96].map((v,i)=>h('i',{style:`height:${v}%;background:#${k==='bento'?(i%2?'FF6B4A':'191919'):C.pal[i%3===2?1:0]}`}))));
  if(k==='bento'){el.querySelector('.bars').style.cssText='background:#FFF3C9;border-radius:5px;padding:3px'}
  return el}
function styleGallery(){const box=h('div',{class:'dgal'},DECK_STYLES.map(([k,l])=>h('button',{type:'button','aria-pressed':String(DK.style===k),onclick:()=>{DK.style=k;try{localStorage.setItem('nila.deckstyle',JSON.stringify(k))}catch(e){}deckView()}},stylePreview(k),h('span',{class:'nm'},l))));return box}
