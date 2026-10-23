/* ===== Nila guide: theme, welcome, home extras, help, tour, Claude app bridge ===== */
"use strict";
/* ---------- theme ---------- */
const THEMES=[
 ['liquid','Liquid Glass','Clear frosted glass, iPhone style',true,'#EEF3FB','Trending'],
 ['aurora','Aurora Glass','Pastel aurora, violet to pink',true,'#F4F1FF',''],
 ['nebula','Nebula Glass','Aurora glass at night',false,'#0A0720',''],
 ['midnight','Midnight Pro','Sharp dark, one violet accent',false,'#08090C','Most loved'],
 ['royal','Royal Navy & Gold','Navy, gold, serif luxury',false,'#0A1430',''],
 ['bento','Bento Pastel','Friendly pastel tiles',true,'#F4F4F1','Trending'],
 ['emerald','Emerald Executive','Crisp white and deep green',true,'#F6FAF8',''],
 ['neon','Neon Night','Cyan and magenta glow',false,'#05040D',''],
 ['crimson','Crimson Pro','White, black, sharp red',true,'#F7F7F9',''],
 ['dark','Eclipse','Deep space with gold moon',false,'#07080E',''],
 ['light','Pearl','Plain light, print friendly',true,'#F2F3F9',''],
 ['auto','Auto','Liquid Glass by day, Nebula at night',true,'#EEF3FB','']];
const TH=Object.fromEntries(THEMES.map(t=>[t[0],t]));
function resolveTheme(t){return t==='auto'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'nebula':'liquid'):(TH[t]?t:'liquid')}
function currentPref(){return lsGet('nila.theme2','aurora')}
function applyTheme(t){lsSet('nila.theme2',t);const r=resolveTheme(t);document.documentElement.dataset.theme=r;const meta=TH[r];const light=meta[3];const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=meta[4];
  try{if(window.NilaAndroid&&NilaAndroid.setBars)NilaAndroid.setBars(meta[4],light)}catch(e){}
  const b=$('#themeBtn');if(b)b.innerHTML='<svg class="i" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9A4.7 4.7 0 0 0 21 11c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/></svg>'}
function isLight(){const m=TH[document.documentElement.dataset.theme];return m?m[3]:true}
try{window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(currentPref()==='auto')applyTheme('auto')})}catch(e){}
function themeMock(id){const r=id==='auto'?'liquid':id;return h('div',{class:'tm','data-theme':r,'aria-hidden':'true'},h('div',{class:'sd'},h('i',{class:'on'}),h('i'),h('i'),h('i'),h('i')),h('div',{class:'mn'},h('div',{class:'h1'},'Good morning'),h('div',{class:'ks'},h('span',{},h('b',{},'₹2.78 Cr'),h('em',{},'▲ 7.7%')),h('span',{},h('b',{},'29.5 K'),h('em',{},'▲ 7.8%')),h('span',{},h('b',{},'4.3'),h('em',{},'▲ 0.2'))),h('div',{class:'ch'},[40,64,50,82,58,92,74].map(v=>h('i',{style:`height:${v}%`})))))}
function themePicker(onPick){const cur=currentPref();const box=h('div',{class:'tgal'},THEMES.map(([k,l,desc,,,tag])=>h('button',{type:'button','aria-pressed':String(cur===k),title:desc,onclick:ev=>{applyTheme(k);box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===ev.currentTarget)));onPick&&onPick(k)}},themeMock(k),h('span',{class:'nm'},l,tag?h('small',{},tag):''),h('span',{class:'small muted',style:'padding:0 4px'},desc))));return box}
function openThemeGallery(){openSheet('Choose your look',h('p',{class:'small muted'},'Tap any look to try it right away. Change it whenever you like; your choice is saved on this device.'),themePicker(),h('div',{class:'row'},h('button',{class:'btn primary',onclick:()=>closeSheet()},'Done')))}
window.themeSettingsCard=()=>h('div',{class:'card'},h('div',{class:'row between'},h('h3',{},'Look'),h('span',{class:'small muted'},'12 looks')),themePicker());

/* ---------- header extras ---------- */
function wireHeader(){const right=$('#settingsBtn');if(!right||$('#themeBtn'))return;
  const ask=h('button',{class:'head-ask',onclick:()=>{go('ask');setTimeout(()=>{const t=$('#askMount textarea');t&&t.focus()},80)}},h('span',{html:'<svg class="i" viewBox="0 0 24 24"><path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg>',style:'display:contents'}),h('span',{},'Ask Nila anything about your accounts…'),h('kbd',{},'/'));
  const tour=h('button',{class:'icon-btn',id:'tourBtn','aria-label':'Guided tour',title:'Guided tour',onclick:()=>startTour()},h('span',{html:'<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/></svg>',style:'display:contents'}));
  const th=h('button',{class:'icon-btn',id:'themeBtn','aria-label':'Choose look',title:'Choose look',onclick:()=>openThemeGallery()});
  right.before(ask,tour,th);applyTheme(currentPref());
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea|select/i.test((document.activeElement||{}).tagName||'')&&$('#overlay').hidden){e.preventDefault();ask.click()}})}

/* ---------- welcome ---------- */
function startWelcome(){lsSet('nila.welcomed',true);let step=1;const st={name:S.settings.name||'',company:S.settings.company==='My company'?'':(S.settings.company||''),role:S.settings.role||'',acc:acc(),industry:S.settings.industry||''};
  const draw=()=>{const prog=h('div',{class:'row',style:'gap:6px'},[1,2,3].map(i=>h('span',{style:`height:4px;flex:1;border-radius:2px;background:${i<=step?'var(--accent)':'var(--surface-3)'}`})));
    if(step===1){const f=(k,l,ph)=>{const i=h('input',{type:'text',value:st[k],placeholder:ph});i.oninput=()=>st[k]=i.value;return h('label',{class:'field'},h('span',{},l),i)};const sel=h('select',{},ACC_LABELS.map(x=>h('option',{selected:x===st.acc},x)));sel.onchange=()=>st.acc=sel.value;
      openSheet('Welcome to nila AI',h('div',{class:'welcome'},prog,h('p',{class:'big'},'Your private ',h('span',{class:'grad-text'},'business brain'),'.'),h('p',{class:'muted'},'Drop an Excel, get dashboards, decks and answers in seconds. Everything stays on this device.'),
        h('div',{class:'grid2'},f('name','Your name','Suresh'),f('company','Company','redBus'),f('role','Your role','Key Account Manager'),h('label',{class:'field'},h('span',{},'Your accounts are called'),sel),f('industry','Business','Online bus ticketing')),
        h('div',{class:'row'},h('button',{class:'btn primary',onclick:async()=>{S.settings={...S.settings,name:st.name.trim(),company:st.company.trim()||'My company',role:st.role.trim(),accountLabel:st.acc,industry:st.industry.trim(),signoff:S.settings.signoff&&S.settings.signoff!=='Regards,'?S.settings.signoff:`Regards,\n${st.name.trim()}`};S.wsList=S.wsList.map(w=>w.id===S.wsId?{...w,name:S.settings.company}:w);try{if(S.saveOn){await store.set(S.P.base,{settings:S.settings});await saveWsList()}}catch{}renderAll();step=2;draw()}},'Continue'),h('button',{class:'btn ghost',onclick:()=>{closeSheet()}},'Skip for now'))))}
    else if(step===2)openSheet('Pick your look',h('div',{class:'welcome'},prog,h('p',{class:'big'},'Choose a look you will ',h('span',{class:'grad-text'},'love'),' opening.'),themePicker(),h('div',{class:'row'},h('button',{class:'btn primary',onclick:()=>{step=3;draw()}},'Continue'),h('button',{class:'btn ghost',onclick:()=>{step=1;draw()}},'Back'))));
    else openSheet('You are ready',h('div',{class:'welcome'},prog,h('p',{class:'big'},'Start with your ',h('span',{class:'grad-text'},'first report'),'.'),h('p',{class:'muted'},'Download any report (Red Deal revenue, KAM dashboard, service information) and drop it in Studio. Or explore with demo data.'),
      h('div',{class:'qa'},h('button',{class:'hot',onclick:()=>{closeSheet();go('studio')}},h('span',{class:'ico',html:I.up}),h('b',{},'Upload my Excel'),h('small',{},'Get a dashboard in seconds')),h('button',{onclick:()=>{closeSheet();loadDemo();setTimeout(()=>go('studio'),50)}},h('span',{class:'ico',html:I.spark}),h('b',{},'Try demo data'),h('small',{},'Look around safely')),h('button',{onclick:()=>{closeSheet();startTour()}},h('span',{class:'ico',html:I.compass}),h('b',{},'Take the tour'),h('small',{},'60 seconds, every tab')))))};
  draw()}

/* ---------- icons ---------- */
const svgI=p=>`<svg class="i" viewBox="0 0 24 24">${p}</svg>`;
const I={up:svgI('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),spark:svgI('<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>'),compass:svgI('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),dash:svgI('<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>'),deck:svgI('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4"/>'),mic:svgI('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),target:svgI('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),help:svgI('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>')};

/* ---------- nav additions ---------- */
(function addNav(){const at=i=>NAV.findIndex(n=>n.id===i);const ins=(after,item)=>{const k=at(after);NAV.splice(k+1,0,item)};
  ins('ask',{id:'deck',label:'Deck Builder',icon:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4"/>',isNew:true});ins('ask',{id:'studio',label:'Studio',icon:'<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',isNew:true});ins('ask',{group:'Analyze'});
  const g=NAV.findIndex(n=>n.group==='Analytics');if(g>=0)NAV.splice(g,1);
  const strategy=NAV.findIndex(n=>n.group==='Strategy');const rv=['rev','roi','fc'].map(i=>NAV.splice(at(i),1)[0]).filter(Boolean);NAV.splice(strategy,0,...rv);
  NAV.push({id:'help',label:'Help & tour',icon:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'})})();

/* ---------- home extras ---------- */
function homeExtras(){const home=$('#view-home');if(!home)return;let box=$('#homeX');if(!box){box=h('div',{id:'homeX',class:'view',style:'animation:none'});const hero=home.querySelector('.hero');hero?hero.after(box):home.prepend(box)}
  const qa=h('div',{class:'qa'},
    h('button',{class:'hot',onclick:()=>go('studio')},h('span',{class:'ico',html:I.dash}),h('b',{},'Open Studio'),h('small',{},'Excel in, dashboard out')),
    h('button',{onclick:()=>go('deck')},h('span',{class:'ico',html:I.deck}),h('b',{},'Make a deck'),h('small',{},'Pick slides, get PowerPoint')),
    h('button',{onclick:()=>{go('log');setTimeout(()=>{const b=$('#capRow .btn');b&&b.click()},120)}},h('span',{class:'ico',html:I.mic}),h('b',{},'Log by voice'),h('small',{},'Speak, Nila sorts it')),
    h('button',{onclick:()=>go('ask')},h('span',{class:'ico',html:I.spark}),h('b',{},'Ask Nila'),h('small',{},'Any question, with your data')),
    h('button',{onclick:()=>go('kra')},h('span',{class:'ico',html:I.target}),h('b',{},'My KRAs'),h('small',{},'Score so far this month')));
  const steps=[['Tell Nila who you are',S.settings.company&&S.settings.company!=='My company',()=>startWelcome()],['Upload your first report',S.datasets.some(d=>!d.demo),()=>go('studio')],['Open a dashboard',!!lsGet('nila.did.studio',false),()=>go('studio')],['Add your top accounts',S.ops.filter(o=>!o.demo).length>=3,()=>go('ops')],['Log your day by voice',allEntries().some(e=>!e.demo),()=>go('log')],['Set this month\'s KRAs',typeof kraGet==='function'&&kraGet(today().slice(0,7)).items.length>0,()=>go('kra')],['Make your first deck',!!lsGet('nila.did.deck',false),()=>go('deck')],['Download a backup',!!lsGet('nila.did.backup',false),()=>exportAll()]];
  const done=steps.filter(s=>s[1]).length;const pc=done/steps.length;const C=2*Math.PI*34;
  const ring=`<svg class="ring" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="var(--surface-3)" stroke-width="8"/><circle cx="42" cy="42" r="34" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C*pc} ${C}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" style="font:600 16px var(--f-display);fill:var(--fg)">${done}/${steps.length}</text></svg>`;
  const sh=done<steps.length&&!lsGet('nila.hide.start',false)?h('div',{class:'card glow'},h('div',{class:'row between'},h('h3',{},'Start here'),h('button',{class:'btn ghost sm',onclick:()=>{lsSet('nila.hide.start',true);homeExtras()}},'Hide')),h('div',{class:'starthere'},h('div',{html:ring}),h('div',{class:'steps-list'},steps.map(([l,ok,fn])=>h('button',{class:ok?'done':'',onclick:fn},h('span',{class:'tick'},ok?'✓':''),l))))):'';
  box.replaceChildren(qa,sh)}

/* ---------- help ---------- */
const HELP=[
  ['studio','Studio','Turn any Excel or CSV into a live dashboard.','KPI cards, trend vs previous period, top 10, movers, share, day pattern, pivot table, Excel export for Power BI.','Drop your Red Deal revenue file, tap a route bar to filter everything.'],
  ['deck','Deck Builder','Make a review or JBP deck in one minute.','A stylish PowerPoint with real editable charts, deep-dive slide per top account, forecast and next steps.','Pick "Last month", tick Deep-dives, Download.'],
  ['ask','Ask Nila','Any question about your accounts, numbers or plans.','Answers built from your reports and log, with the source and period.','"Which operators dropped this month and why?"'],
  ['rev','Revenue & products','Compare any number across two periods.','Change by account, route or product with share.','Month to date vs same days last month, split by product.'],
  ['roi','ROI · ROAS','Check if a campaign or discount paid back.','ROAS, ROI, incremental revenue with a control group.','Red Deal promo: spend vs extra GMV.'],
  ['fc','Forecast','See where a number will land.','Next weeks or months with a range and tested accuracy, plus what-if.','GMV next 8 weeks with +8% for festive season.'],
  ['gaps','Gaps & fixes','Find problems before your manager does.','Falling accounts, high cancellations, weak ROAS, no-contact key accounts, with root cause and fix.','Tap "Find root cause & fix" on the top gap.'],
  ['grow','Growth plan','Take the business to the next level.','Levers sized in ₹ and a 30-60-90 day plan.','Plan next quarter with a 20% target.'],
  ['log','Daily log','Capture every call and meeting in seconds.','Clean entries, follow-ups with due dates, overdue alerts.','Press Speak after a call and talk in Tanglish.'],
  ['ops','Accounts','Your operator master list.','Health score, meeting brief, JBP and review decks, negotiation prep, meeting minutes.','Add short names like SMT so Nila never confuses accounts.'],
  ['kra','KRA scorecard','Track your monthly KRAs and appraisal.','Achievement, month-end projection, self and manager ratings, trend.','Copy last month, link GMV to your report.'],
  ['week','Weekly mail','Send your manager update in 2 minutes.','A clean mail from your log and numbers.','Friday: Write this week\'s mail, edit, copy to Gmail.'],
  ['data','Data library','All your uploaded reports in one place.','Update a report with the same dates replaced, never double counted.','Upload this week\'s download onto last week\'s report.']];
function helpView(){const v=$('#view-help');if(!v)return;const icon=id=>{const n=NAV.find(x=>x.id===id);return n?svgI(n.icon):I.help};
  v.replaceChildren(h('div',{class:'view-head'},h('div',{},h('h2',{},'Help & tour'),h('p',{class:'muted small'},'What each tab is for, what you get, and one thing to try. Open any tab from here.')),h('button',{class:'btn primary',onclick:()=>startTour()},h('span',{html:I.compass,style:'display:contents'}),'Start the tour')),
    h('div',{class:'helpgrid'},HELP.map(([id,name,use,get,tr])=>h('div',{class:'hcard'},h('div',{class:'top'},h('span',{class:'ico',html:icon(id)}),h('h3',{},id==='ops'?acc()+'s':name)),h('dl',{},h('dt',{},'Use it'),h('dd',{},use),h('dt',{},'You get'),h('dd',{},get),h('dt',{},'Try'),h('dd',{class:'muted'},tr)),h('button',{class:'btn sm',style:'align-self:flex-start;margin-top:auto',onclick:()=>go(id)},'Open')))),
    h('div',{class:'card'},h('h3',{},'Good to know'),h('div',{class:'md'},md(`- **Your data stays on this device.** Download a backup every week (Settings → Backup), or turn on Google Drive sync.\n- **AI without extra cost:** Settings → AI engine → *Claude app*. Nila prepares your question with the data; you paste it in Claude and paste the answer back. Uses your existing Claude plan.\n- **Everything else works without AI:** Studio, decks, KRAs, forecasts, ROI, gaps, log.\n- **Same report every week?** Upload it onto the same report in Data library; Nila replaces those dates and keeps the rest.\n- **Phone app:** install from the website menu, or use the APK. Laptop: the install icon in the address bar.`))))}

/* ---------- tour ---------- */
const TOUR=[[null,'Welcome to nila AI','A 60-second walk through every tab. Use Next, or press Esc to stop.'],['studio','Studio','Drop any Excel here and get a Power BI style dashboard. Tap a bar to filter everything.'],['deck','Deck Builder','Pick slides and Nila builds a stylish PowerPoint from your report, with real charts.'],['ask','Ask Nila','Ask anything in English or Tanglish. Answers use your data and show the source.'],['rev','Revenue, ROI and Forecast','Compare periods, check if a campaign paid back, and see where numbers will land.'],['gaps','Gaps & fixes','Nila finds problems early and gives the root cause and fix plan.'],['log','Daily log','Speak after every call. Nila turns it into entries and follow-ups.'],['ops','Accounts','Health score, meeting brief, JBP deck and negotiation prep for each account.'],['kra','KRA scorecard','Track your monthly score and get your appraisal draft.'],['data','Data library','All your reports. Upload the same report again to update it.'],['#themeBtn','Your look','Tap here any time to pick from 12 looks: Liquid Glass, Midnight Pro, Royal Navy & Gold, Bento and more.'],['help','Help & tour','Come back here whenever you need a refresher.']];
let TS=null;
function startTour(i=0){closeSheet();endTour(true);TS={i,block:h('div',{class:'tour-block'}),spot:h('div',{class:'tour-spot'}),card:h('div',{class:'tour-card',role:'dialog','aria-live':'polite'})};document.body.append(TS.block,TS.spot,TS.card);document.addEventListener('keydown',tourKey);tourStep()}
function tourKey(e){if(!TS)return;if(e.key==='Escape')endTour();else if(e.key==='ArrowRight')tourGo(1);else if(e.key==='ArrowLeft')tourGo(-1)}
function tourGo(d){if(!TS)return;TS.i+=d;if(TS.i<0)TS.i=0;if(TS.i>=TOUR.length){endTour();toast('Tour done. Find it again in Help & tour.');return}tourStep()}
function endTour(silent){if(!TS)return;TS.block.remove();TS.spot.remove();TS.card.remove();document.removeEventListener('keydown',tourKey);TS=null;closeDrawer();lsSet('nila.toured',true)}
function tourStep(){const[tg,title,text]=TOUR[TS.i];const mobile=window.matchMedia('(max-width:899px)').matches;let el=null;
  if(tg){if(tg[0]==='#')el=$(tg);else{if(mobile)openDrawer();el=$(`.nav[data-view="${tg}"]`)}}
  const place=()=>{const prog=h('div',{class:'prog'},TOUR.map((_,k)=>h('i',{class:k<=TS.i?'on':''})));
    TS.card.replaceChildren(prog,h('span',{class:'label'},`Step ${TS.i+1} of ${TOUR.length}`),h('h3',{},title),h('p',{class:'small'},text),h('div',{class:'row'},h('button',{class:'btn primary sm',onclick:()=>tourGo(1)},TS.i===TOUR.length-1?'Finish':'Next'),TS.i?h('button',{class:'btn sm',onclick:()=>tourGo(-1)},'Back'):'',h('span',{style:'flex:1'}),h('button',{class:'btn ghost sm',onclick:()=>endTour()},'Skip')));
    if(el&&el.getBoundingClientRect().width){el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();Object.assign(TS.spot.style,{display:'block',left:r.left-6+'px',top:r.top-6+'px',width:r.width+12+'px',height:r.height+12+'px'});
      const cw=Math.min(360,window.innerWidth-32);let x=r.right+18,y=r.top-10;if(x+cw>window.innerWidth-16){x=Math.max(16,Math.min(window.innerWidth-cw-16,r.left));y=r.bottom+14}const ch=TS.card.offsetHeight||200;if(y+ch>window.innerHeight-16)y=Math.max(16,r.top-ch-14);Object.assign(TS.card.style,{left:x+'px',top:y+'px',transform:'none'})}
    else{Object.assign(TS.spot.style,{display:'none'});Object.assign(TS.card.style,{left:'50%',top:'50%',transform:'translate(-50%,-50%)'})}};
  place();requestAnimationFrame(place);setTimeout(place,260)}

/* ---------- Claude app bridge ---------- */
window.NILA_BRIDGE_UI=(prompt,{json}={})=>new Promise((resolve,reject)=>{
  const big=prompt.length>7000;const url='https://claude.ai/new'+(big?'':'?q='+encodeURIComponent(prompt));
  const ta=h('textarea',{rows:5,readonly:true,style:'font-family:var(--f-mono);font-size:.74rem'},prompt);
  const ans=h('textarea',{rows:7,placeholder:json?'Paste Claude\'s full reply here (it contains the data Nila needs)':'Paste Claude\'s answer here'});
  const copied=h('span',{class:'small muted'});
  const doCopy=async()=>{try{await navigator.clipboard.writeText(prompt);copied.textContent='✓ Copied with your data'}catch{ta.focus();ta.select();try{document.execCommand('copy');copied.textContent='✓ Copied'}catch{copied.textContent='Select the text below and copy it'}}};
  window.__bridgeReject=reject;
  openSheet('Ask in Claude (free with your plan)',h('div',{class:'steps-list',style:'grid-template-columns:1fr'},
      h('div',{class:'card'},h('div',{class:'row'},h('span',{class:'chip gold'},'1'),h('b',{},'Copy your question with the data'),h('span',{style:'flex:1'}),h('button',{class:'btn sm primary',onclick:doCopy},'Copy')),copied,h('details',{},h('summary',{class:'small muted',style:'cursor:pointer'},`See what is sent (${(prompt.length/1000).toFixed(1)}k characters)`),ta)),
      h('div',{class:'card'},h('div',{class:'row'},h('span',{class:'chip gold'},'2'),h('b',{},'Open Claude and paste'),h('span',{style:'flex:1'}),h('a',{class:'btn sm',href:url,target:'_blank',rel:'noopener',onclick:()=>{doCopy()}},'Open Claude ↗')),h('p',{class:'small muted'},big?'Paste with Ctrl+V (or long-press → Paste on phone), then send.':'Your question may already be filled in. If not, paste it and send.')),
      h('div',{class:'card'},h('div',{class:'row'},h('span',{class:'chip gold'},'3'),h('b',{},'Paste Claude\'s answer back')),ans,h('div',{class:'row'},h('button',{class:'btn primary',onclick:()=>{const t=ans.value.trim();if(!t){toast('Paste the answer first');return}window.__bridgeReject=null;closeSheet();resolve(t)}},'Use this answer'),h('button',{class:'btn ghost',onclick:()=>closeSheet()},'Cancel')))),
    h('p',{class:'small muted'},'No API key, no extra cost: this uses your own Claude plan. Want it fully automatic? Add a Claude or Gemini API key in Settings → AI engine.'));
  doCopy()});
{const _cs=closeSheet;closeSheet=function(){_cs();if(window.__bridgeReject){const r=window.__bridgeReject;window.__bridgeReject=null;r({code:'cancelled'})}}}

/* data pack the Claude app reads in place of tools */
window.NILA_CONTEXT=async(question)=>{const q=String(question||'').toLowerCase();const parts=[];const cap=34000;
  parts.push(`ABOUT: ${ctx()}. Accounts are called "${acc()}". Today ${today()}.`);
  for(const d of S.datasets.slice(0,4)){try{const m=await Studio.model(d);const ms=Studio.pickMeasures(m);const meas=ms[0];const dims=Studio.pickDims(m);const dA=dims[0],dB=dims.find(x=>x!==dA);
      let t=`\n## REPORT "${d.name}" [${d.type}] ${d.minDate?d.minDate+' to '+d.maxDate:''}, ${d.rowCount} rows. Columns: ${d.columns.join(', ')}.${d.note?' Note: '+d.note:''}`;
      if(m.dateCol&&meas){const r=Studio.range(m,'30');const pr=Studio.prevRange(r);const cur=Studio.filter(m,{range:r}),prv=Studio.filter(m,{range:pr});
        t+=`\nTotals last 30 days (${r.from}..${r.to}) vs previous 30 (${pr.from}..${pr.to}): `+ms.map(x=>`${x}: ${Studio.fmt(m,x,Studio.val(m,cur,x))} vs ${Studio.fmt(m,x,Studio.val(m,prv,x))}`).join('; ');
        if(dA){const pm=new Map(Studio.group(m,prv,dA,meas).map(x=>[x.key,x.v||0]));const g=Studio.group(m,cur,dA,meas).sort((a,b)=>(b.v||0)-(a.v||0));t+=`\n${meas} by ${dA} (last 30 vs previous 30):\n`+g.slice(0,25).map(x=>`- ${x.key}: ${Studio.fmt(m,meas,x.v)} vs ${Studio.fmt(m,meas,pm.get(x.key)||0)}`).join('\n')}
        const wk=Studio.series(m,m.rows,meas,'week').slice(-12);t+=`\nWeekly ${meas} (last 12 weeks): `+wk.map(x=>`${x.k} ${Studio.fmt(m,meas,x.v)}`).join(', ');
        if(dB){const g=Studio.group(m,cur,dB,meas).sort((a,b)=>(b.v||0)-(a.v||0)).slice(0,12);t+=`\n${meas} by ${dB} (last 30 days): `+g.map(x=>`${x.key} ${Studio.fmt(m,meas,x.v)}`).join(', ')}
        const hit=dA?[...new Set(m.rows.map(r=>r[dA]).filter(Boolean))].filter(n=>{const s=String(n).toLowerCase();return q.includes(s)||S.ops.some(o=>[o.name,...(o.aliases||[])].some(a=>a&&q.includes(String(a).toLowerCase())&&nameScore(o.name,n)>=.85))}).slice(0,3):[];
        for(const n of hit){const rs=m.rows.filter(r=>r[dA]===n);const w=Studio.series(m,rs,meas,'week').slice(-12);t+=`\nFOCUS ${n}: weekly ${meas}: `+w.map(x=>`${x.k} ${Studio.fmt(m,meas,x.v)}`).join(', ');if(dB)t+=`\n${n} by ${dB} (last 30 days): `+Studio.group(m,rs.filter(r=>r[m.dateCol]>=r0(m)),dB,meas).sort((a,b)=>(b.v||0)-(a.v||0)).slice(0,10).map(x=>`${x.key} ${Studio.fmt(m,meas,x.v)}`).join(', ')}}
      else{t+='\nSample rows: '+JSON.stringify(m.rows.slice(0,15))}
      parts.push(t)}catch(e){parts.push(`\n## REPORT "${d.name}": could not summarise (${e.message})`)}}
  const open=openFollowups().slice(0,20);if(open.length)parts.push('\n## OPEN FOLLOW-UPS\n'+open.map(e=>`- ${e.operator||'General'}: ${e.nextAction}${e.due?' (due '+e.due+')':''}`).join('\n'));
  const recent=allEntries().filter(e=>e.date>=addDays(today(),-14)).slice(0,30);if(recent.length)parts.push('\n## LOG, LAST 14 DAYS\n'+recent.map(e=>`- ${e.date} | ${e.operator||'General'} | ${e.type} | ${e.summary}${e.outcome?' | '+e.outcome:''}`).join('\n'));
  if(typeof kraGet==='function'){const k=kraGet(today().slice(0,7));if(k.items.length){const sc=kraScores(k);parts.push(`\n## KRA ${today().slice(0,7)}: achievement ${sc.achievement!=null?(sc.achievement*100).toFixed(0)+'%':'–'}\n`+k.items.map(i=>`- ${i.kra} / ${i.kpi}: target ${i.target}, actual ${i.actual}, weight ${i.weight}%`).join('\n'))}}
  const hl=S.ops.map(o=>({n:o.name,s:(S.health[o.id]||{}).score})).filter(x=>x.s!=null).sort((a,b)=>a.s-b.s).slice(0,10);if(hl.length)parts.push('\n## LOWEST ACCOUNT HEALTH (0-100)\n'+hl.map(x=>`- ${x.n}: ${x.s}`).join('\n'));
  let out=parts.join('\n');if(out.length>cap)out=out.slice(0,cap)+'\n…(trimmed)';return out};
function r0(m){return addDays(m.ds.maxDate||today(),-29)}

/* ---------- hooks ---------- */
(window.NILA_VIEWS=window.NILA_VIEWS||{}).help=helpView;
const _studioView=window.NILA_VIEWS.studio;window.NILA_VIEWS.studio=()=>{lsSet('nila.did.studio',true);_studioView&&_studioView()};
(window.NILA_HOOKS=window.NILA_HOOKS||[]).push(()=>{wireHeader();homeExtras();if(S.view==='help')helpView()});
{const _ex=exportAll;exportAll=async function(){lsSet('nila.did.backup',true);return _ex.apply(this,arguments)}}
{const _bd=buildDeck;buildDeck=async function(){lsSet('nila.did.deck',true);return _bd.apply(this,arguments)}}
