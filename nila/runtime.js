/* ===== Nila local runtime: device storage + your own AI key ===== */
(function(){
"use strict";
/* ---------- device storage (IndexedDB) ---------- */
let dbp=null;
function openDb(){return dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('nila-ai',1);r.onupgradeneeded=()=>r.result.createObjectStore('docs');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))}
async function idbGet(k){const db=await openDb();return new Promise((res,rej)=>{const r=db.transaction('docs').objectStore('docs').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbPut(k,v){const db=await openDb();return new Promise((res,rej)=>{const t=db.transaction('docs','readwrite');t.objectStore('docs').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||{code:'quota_exceeded'})})}
async function idbDel(k){const db=await openDb();return new Promise((res,rej)=>{const t=db.transaction('docs','readwrite');t.objectStore('docs').delete(k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function idbList(prefix){const db=await openDb();return new Promise((res,rej)=>{const out=[];const r=db.transaction('docs').objectStore('docs').openCursor(IDBKeyRange.bound(prefix,prefix+'￿'));r.onsuccess=()=>{const c=r.result;if(c){out.push([c.key,c.value]);c.continue()}else res(out)};r.onerror=()=>rej(r.error)})}
const wrapErr=e=>(e&&e.name==='QuotaExceededError')?{code:'quota_exceeded'}:e;
const LDB={
  doc(p){return{id:p.split('/').pop(),path:p,
    async get(){const v=await idbGet(p);return{id:p.split('/').pop(),exists:v!==undefined,data:()=>v,metadata:{fromCache:false,hasPendingWrites:false}}},
    async set(d){try{await idbPut(p,JSON.parse(JSON.stringify(d)))}catch(e){throw wrapErr(e)}},
    async delete(){await idbDel(p)}}},
  collection(c){const q={limit:()=>q,async get(){const all=await idbList(c+'/');const docs=all.filter(([k])=>!k.slice(c.length+1).includes('/')).map(([k,v])=>({id:k.slice(c.length+1),exists:true,data:()=>v}));return{docs,size:docs.length,empty:!docs.length}}};return q}};

/* ---------- downloads ---------- */
const DL={async save({filename,data}){if(window.NilaAndroid&&NilaAndroid.saveFile){const blob=data instanceof Blob?data:new Blob([data]);const b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]||'');fr.onerror=rej;fr.readAsDataURL(blob)});const ok=NilaAndroid.saveFile(filename,b64);if(!ok)throw{code:'unavailable'};return{status:'saved'}}const blob=data instanceof Blob?data:new Blob([data]);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);return{status:'saved'}}};

/* ---------- AI settings ---------- */
const AI_DEFAULT={provider:'claude-app',claudeKey:'',geminiKey:'',claudeModels:{quick:'claude-haiku-5-5',default:'claude-sonnet-5-5',complex:'claude-opus-5-5'},geminiModel:'gemini-3.6-flash'};
window.aiCfg=()=>{try{const c=JSON.parse(localStorage.getItem('nila.ai')||'{}');return{...AI_DEFAULT,...c,claudeModels:{...AI_DEFAULT.claudeModels,...(c.claudeModels||{})}}}catch{return{...AI_DEFAULT}}};
window.aiSave=c=>{try{localStorage.setItem('nila.ai',JSON.stringify(c))}catch{}};

/* ---------- AI engine with tool use ---------- */
async function httpErr(res,provider){let msg='';try{const j=await res.json();msg=(j.error&&(j.error.message||j.error.status))||JSON.stringify(j).slice(0,200)}catch{}
  const m=String(msg).toLowerCase();
  if(res.status===401||res.status===403||/api key|api_key|authentication|permission/.test(m)&&res.status<500)return{code:'bad_key',message:msg};
  if(/credit balance|billing|insufficient|exhausted|quota/.test(m)&&res.status!==429)return{code:'no_credit',message:msg};
  if(res.status===429)return{code:'rate_limited',message:msg};
  if(res.status===404||/not found|model/.test(m)&&res.status===400)return{code:'bad_model',message:msg};
  if(res.status===413)return{code:'prompt_too_large',message:msg};
  return{code:'upstream_error',message:`${provider} ${res.status}: ${msg}`}}
function mergeTurns(input){const turns=typeof input==='string'?[{role:'user',content:input}]:input;const out=[];for(const t of turns){const l=out[out.length-1];if(l&&l.role===t.role)l.content+='\n\n'+t.content;else out.push({role:t.role,content:String(t.content)})}return out}
async function runTool(tools,name,input,signal){const t=(tools||[]).find(x=>x.name===name);if(!t)return{error:true,content:'Error: unknown tool '+name};try{const r=await t.execute(input||{},{signal});return{error:false,content:typeof r==='string'?r:JSON.stringify(r===undefined?null:r).slice(0,60000),raw:r}}catch(e){return{error:true,content:'Error: '+(e&&e.message||String(e))}}}
const MAX_ROUNDS=8;
async function claudeRun(msgs,opts,cfg){
  const model=cfg.claudeModels[opts.modelTier||'default']||cfg.claudeModels.default;
  const messages=msgs.map(m=>({role:m.role,content:m.content}));
  const tools=(opts.tools||[]).map(t=>({name:t.name,description:t.description,input_schema:t.inputSchema||{type:'object',properties:{}}}));
  let all='',last='';
  for(let round=0;round<MAX_ROUNDS;round++){
    const body={model,max_tokens:opts.modelTier==='quick'?2000:8000,messages};
    if(tools.length){body.tools=tools;if(round===MAX_ROUNDS-1)body.tool_choice={type:'none'}}
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:opts.signal,headers:{'content-type':'application/json','x-api-key':cfg.claudeKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify(body)});
    if(!res.ok)throw Object.assign(await httpErr(res,'Claude API'),{text:all||undefined});
    const j=await res.json();const blocks=j.content||[];
    const text=blocks.filter(c=>c.type==='text').map(c=>c.text).join('');
    if(text){last=text;all+=(all?'\n\n':'')+text;opts.onText&&opts.onText({text:all,delta:text})}
    const uses=blocks.filter(c=>c.type==='tool_use');
    if(j.stop_reason!=='tool_use'||!uses.length)return{text:all,last,truncated:j.stop_reason==='max_tokens'};
    messages.push({role:'assistant',content:blocks});
    const results=await Promise.all(uses.map(async u=>{const r=await runTool(opts.tools,u.name,u.input,opts.signal);return{type:'tool_result',tool_use_id:u.id,content:r.content,is_error:r.error||undefined}}));
    messages.push({role:'user',content:results})}
  return{text:all,last,truncated:true}}
function gSchema(s){if(!s||typeof s!=='object'||!s.type)return{type:'string',description:(s&&s.description)||'value'};const o={type:s.type};if(s.description)o.description=s.description;if(s.enum)o.enum=s.enum;
  if(s.type==='object'){const p=s.properties&&Object.keys(s.properties).length?s.properties:{column:{type:'string'},op:{type:'string'},value:{type:'string'}};o.properties={};for(const k in p)o.properties[k]=gSchema(p[k]);if(s.required)o.required=s.required.filter(r=>r in o.properties)}
  if(s.type==='array')o.items=gSchema(s.items||{type:'string'});return o}
async function geminiRun(msgs,opts,cfg){
  const model=cfg.geminiModel||AI_DEFAULT.geminiModel;
  const contents=msgs.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
  const decl=(opts.tools||[]).map(t=>{const d={name:t.name,description:t.description};if(t.inputSchema&&t.inputSchema.properties&&Object.keys(t.inputSchema.properties).length)d.parameters=gSchema(t.inputSchema);return d});
  let all='',last='';
  for(let round=0;round<MAX_ROUNDS;round++){
    const body={contents,generationConfig:{maxOutputTokens:opts.modelTier==='quick'?2048:8192}};
    if(decl.length){body.tools=[{functionDeclarations:decl}];if(round===MAX_ROUNDS-1)body.toolConfig={functionCallingConfig:{mode:'NONE'}}}
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.geminiKey)}`,{method:'POST',signal:opts.signal,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok)throw Object.assign(await httpErr(res,'Gemini API'),{text:all||undefined});
    const j=await res.json();const cand=(j.candidates||[])[0];
    if(!cand||!cand.content){if(j.promptFeedback&&j.promptFeedback.blockReason)throw{code:'refused'};throw{code:'empty_completion'}}
    const parts=cand.content.parts||[];
    const text=parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('');
    if(text){last=text;all+=(all?'\n\n':'')+text;opts.onText&&opts.onText({text:all,delta:text})}
    const calls=parts.filter(p=>p.functionCall);
    if(!calls.length)return{text:all,last,truncated:cand.finishReason==='MAX_TOKENS'};
    contents.push(cand.content);
    const resp=await Promise.all(calls.map(async c=>{const r=await runTool(opts.tools,c.functionCall.name,c.functionCall.args,opts.signal);let val;try{val=JSON.parse(r.content)}catch{val=r.content}return{functionResponse:{name:c.functionCall.name,response:{result:val}}}}));
    contents.push({role:'user',parts:resp})}
  return{text:all,last,truncated:true}}
async function run(input,opts){opts=opts||{};const cfg=aiCfg();const msgs=mergeTurns(input);
  if(cfg.provider==='claude-app'){if(!window.NILA_BRIDGE_UI)throw{code:'no_key'};let prompt=msgs.map(m=>(m.role==='assistant'?'ASSISTANT (earlier answer):\n':'')+m.content).join('\n\n---\n\n');
    if(opts.tools&&opts.tools.length&&window.NILA_CONTEXT){const lastUser=[...msgs].reverse().find(m=>m.role==='user');const pack=await window.NILA_CONTEXT(lastUser?lastUser.content:'');prompt+=`\n\n=== DATA PACK (from my Nila app; you have no tools, so use this data in place of tool results) ===\n${pack}\n=== END DATA PACK ===\n\nAnswer now using only the data above. If something needed is missing, say which report to upload.`}
    try{const text=await window.NILA_BRIDGE_UI(prompt,{json:/Return only valid JSON/.test(prompt)});opts.onText&&opts.onText({text,delta:text});return{text,last:text,truncated:false}}catch(e){if(e&&e.code)throw e;throw{code:'cancelled'}}}
  if(cfg.provider==='gemini'?!cfg.geminiKey:!cfg.claudeKey)throw{code:'no_key'};
  try{const r=cfg.provider==='gemini'?await geminiRun(msgs,opts,cfg):await claudeRun(msgs,opts,cfg);if(!r.text||!r.text.trim())throw{code:'empty_completion'};return r}
  catch(e){if(e&&e.name==='AbortError')throw{code:'cancelled'};if(e instanceof TypeError)throw{code:'network',message:e.message};throw e}}
function parseLoose(t){t=String(t||'').trim();try{return JSON.parse(t)}catch{}const f=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(f){try{return JSON.parse(f[1].trim())}catch{}}
  const ia=[t.indexOf('{'),t.indexOf('[')].filter(i=>i>=0);const a=ia.length?Math.min(...ia):-1;const b=Math.max(t.lastIndexOf('}'),t.lastIndexOf(']'));if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}throw{code:'invalid_json',text:t}}
async function SAMPLE(input,opts){const r=await run(input,opts);return{text:r.text,truncated:!!r.truncated,modelTierApplied:(opts&&opts.modelTier)||'default'}}
const ADD='\n\nReturn only valid JSON, with no text before or after it.';
SAMPLE.json=async(input,opts)=>{const inp=typeof input==='string'?input+ADD:input.map((m,i)=>i===input.length-1?{...m,content:m.content+ADD}:m);const r=await run(inp,opts);return parseLoose(r.last||r.text)};
SAMPLE.limits=async()=>({maxPromptBytes:900000,tools:{maxCount:20}});
window.NILA_SAMPLE=SAMPLE;window.NILA_parseLoose=parseLoose;window.NILA_gSchema=gSchema;

/* ---------- local error text ---------- */
window.LOCAL_ERR={no_key:'Set up AI in Settings → AI engine (Claude app is free with your plan). Everything else works without it.',bad_key:'Your AI key was not accepted. Check it in Settings → AI engine.',bad_model:'That AI model is not available on your key. Pick another in Settings → AI engine.',network:'Could not reach the AI service. Check your internet and try again.',no_credit:'Your AI account has no credit or free quota left. Top up, or switch engine in Settings.'};

/* ---------- AI settings card (used by Settings) ---------- */
window.aiSettingsCard=function(){const c=aiCfg();
  const prov=h('select',{id:'aiProv'},h('option',{value:'claude-app',selected:c.provider==='claude-app'},'Claude app · free with your Claude plan (copy and paste)'),h('option',{value:'claude',selected:c.provider==='claude'},'Claude API (Anthropic) · pay per use'),h('option',{value:'gemini',selected:c.provider==='gemini'},'Gemini API (Google) · has a free tier'));
  const ck=h('input',{type:'password',id:'aiCK',value:c.claudeKey,placeholder:'sk-ant-…',autocomplete:'off'});
  const gk=h('input',{type:'password',id:'aiGK',value:c.geminiKey,placeholder:'AIza…',autocomplete:'off'});
  const gm=h('input',{type:'text',id:'aiGM',value:c.geminiModel,list:'gemModels'});const gl=h('datalist',{id:'gemModels'});
  const cm=['quick','default','complex'].map(k=>h('input',{type:'text',value:c.claudeModels[k],id:'aiCM-'+k}));
  const status=h('p',{class:'small muted'});
  const save=()=>{const n={...aiCfg(),provider:prov.value,claudeKey:ck.value.trim(),geminiKey:gk.value.trim(),geminiModel:gm.value.trim()||AI_DEFAULT.geminiModel,claudeModels:{quick:cm[0].value.trim()||AI_DEFAULT.claudeModels.quick,default:cm[1].value.trim()||AI_DEFAULT.claudeModels.default,complex:cm[2].value.trim()||AI_DEFAULT.claudeModels.complex}};aiSave(n);return n};
  async function loadGem(){save();status.textContent='Loading your models…';try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key='+encodeURIComponent(gk.value.trim()));if(!r.ok)throw new Error(String(r.status));const j=await r.json();const ms=(j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/',''));gl.replaceChildren(...ms.map(m=>h('option',{value:m})));const pick=ms.filter(m=>/flash/.test(m)&&!/lite|tts|image|live|audio|embed|transcribe|preview/.test(m)).sort().pop();if(pick&&!ms.includes(gm.value))gm.value=pick;save();status.textContent=`${ms.length} models on your key. Using ${gm.value}.`}catch{status.textContent='Could not load models. Check the Gemini key.'}}
  const test=async()=>{save();status.textContent='Testing…';try{const r=await SAMPLE('Reply with exactly: Nila is connected.',{modelTier:'quick'});status.textContent='✓ '+r.text.slice(0,80)}catch(e){status.textContent=sampleErr(e)}};
  const cWrap=h('div',{class:'grid2'},h('label',{class:'field',style:'grid-column:1/-1'},h('span',{},'Claude API key (console.anthropic.com → API keys)'),ck),h('label',{class:'field'},h('span',{},'Fast model'),cm[0]),h('label',{class:'field'},h('span',{},'Main model'),cm[1]),h('label',{class:'field'},h('span',{},'Deep model'),cm[2]));
  const gWrap=h('div',{class:'grid2'},h('label',{class:'field',style:'grid-column:1/-1'},h('span',{},'Gemini API key (aistudio.google.com → Get API key)'),gk),h('label',{class:'field'},h('span',{},'Model'),gm,gl),h('div',{class:'field'},h('span',{},' '),h('button',{class:'btn sm',type:'button',onclick:loadGem},'Load my models')));
  const appNote=h('p',{class:'help'},h('b',{},'How it works: '),'when you ask something, Nila prepares your question with the right data. You paste it in Claude (app or claude.ai) and paste the answer back. No API key, no extra cost: it uses your existing Claude plan.');const sync=()=>{cWrap.hidden=prov.value!=='claude';gWrap.hidden=prov.value!=='gemini';appNote.hidden=prov.value!=='claude-app'};prov.onchange=()=>{sync();save()};sync();
  return h('div',{class:'card'},h('h3',{},'AI engine'),h('p',{class:'small muted'},'Pick how Nila talks to AI. Studio, decks, KRAs, forecasts, ROI and gaps all work without AI. AI powers Ask, briefs, plans, minutes and explanations.'),
    h('label',{class:'field'},h('span',{},'Engine'),prov),appNote,cWrap,gWrap,
    h('div',{class:'row'},h('button',{class:'btn teal',type:'button',onclick:()=>{save();toast('AI settings saved')}},'Save AI settings'),h('button',{class:'btn',type:'button',onclick:test},'Test connection')),status,
    h('p',{class:'help'},h('b',{},'Company data: '),'on the free Gemini tier, Google may use prompts to improve its products and reviewers may read them. For confidential account data, use the Claude API or a paid Gemini plan.'))};

/* ---------- wire up ---------- */
window.claude={use:async n=>({db:LDB,user:{id:async()=>'local',isOwner:()=>true},sample:SAMPLE,downloads:DL})[n]||null};
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch{}
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
