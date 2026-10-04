const P=require('/opt/npm-tools/node_modules/pptxgenjs');
const path=require('path'),R=path.resolve(__dirname,'..'),S=n=>`${R}/assets/screens/${n}.png`;
const p=new P();p.layout='LAYOUT_16x9';
const N='0B2536',T='0A6C8A',K='6CC8E3',BG='F2F6F8',F='Calibri';
function base(title,sub){const s=p.addSlide();s.background={color:BG};
 s.addText(title,{x:.5,y:.3,w:9,h:.6,fontFace:F,fontSize:28,bold:true,color:N,margin:0});
 if(sub)s.addText(sub,{x:.5,y:.88,w:9,h:.35,fontFace:F,fontSize:14,color:'546675',margin:0});
 s.addText('MediSphere AI  |  Edvergencex x TTIT capstone',{x:.5,y:5.28,w:6,h:.25,fontFace:F,fontSize:9,color:'7A8B98',margin:0});return s;}
function bullets(s,items,o){s.addText(items.map(t=>({text:t,options:{bullet:true,breakLine:true}})),Object.assign({fontFace:F,fontSize:15,color:'26394A',paraSpaceAfter:8,valign:'top',margin:0},o));}
function shot(s,n,x,y,w,ar){s.addImage({path:S(n),x,y,w,h:w*ar,shadow:{type:'outer',color:'000000',opacity:.2,blur:6,offset:2,angle:90}});}
// 1 title
let s=p.addSlide();s.background={color:N};
s.addText('MediSphere AI',{x:.6,y:1.3,w:8.8,h:1,fontFace:F,fontSize:54,bold:true,color:'FFFFFF',margin:0});
s.addText('Clinical intelligence for hospitals that operate in many countries',{x:.6,y:2.4,w:8,h:.5,fontFace:F,fontSize:20,color:K,margin:0});
s.addText('Capstone project  |  11-day AI Application Development course  |  Edvergencex x TTIT',{x:.6,y:4.6,w:8.8,h:.35,fontFace:F,fontSize:13,color:'9FB6C5',margin:0});
// 2 problem
s=base('The problem','Multi-country hospitals run on disconnected tools');
bullets(s,['Emergency triage is slow and varies between sites and nurses','Guidelines are scattered; clinicians need answers with sources','Patient reports arrive as scans and PDFs that nobody can search','Every country has its own language, emergency number and rules for data','Leaders need one view of waits, triage mix and readmission risk'],{x:.5,y:1.5,w:5.2,h:3.4});
[['4','hospital sites'],['4','languages'],['5','user roles']].forEach((a,i)=>{s.addShape('roundRect',{x:6.2,y:1.5+i*1.15,w:3.3,h:1,fill:{color:'FFFFFF'},line:{color:'D8E1E7'},rectRadius:.08});
 s.addText(a[0],{x:6.3,y:1.5+i*1.15,w:1.1,h:1,fontFace:F,fontSize:40,bold:true,color:T,align:'center',valign:'middle',margin:0});
 s.addText(a[1],{x:7.4,y:1.5+i*1.15,w:2,h:1,fontFace:F,fontSize:15,color:'546675',valign:'middle',margin:0});});
// 3 architecture
s=base('Architecture','Each request passes the same safety pipeline');
const L=[['Clinician UI','Role-based screens, voice, 4 languages'],['API','Sign-in, RBAC, rate limits, audit chain'],['Guardrails','PII masking, injection filter, crisis routing'],['RAG, agents, tools','Hybrid search, NEWS2, drug checker'],['Data','SQLite to PostgreSQL, FHIR R4 export']];
L.forEach((a,i)=>{const x=.5+i*1.82;s.addShape('roundRect',{x,y:1.7,w:1.65,h:1.7,fill:{color:N},rectRadius:.08,line:{color:N}});
 s.addText(a[0],{x:x+.1,y:1.8,w:1.45,h:.5,fontFace:F,fontSize:14,bold:true,color:K,margin:0});
 s.addText(a[1],{x:x+.1,y:2.3,w:1.45,h:1,fontFace:F,fontSize:12,color:'FFFFFF',valign:'top',margin:0});});
bullets(s,['Python core with a stdlib server and an optional FastAPI app; same route pipeline for both','Own hybrid retriever (BM25 + LSA vectors) works with no external service','Optional live LLM; offline mode keeps the demo fully working'],{x:.5,y:3.7,w:9,h:1.4,fontSize:14});
// 4 11-day map
s=base('How the 11 days fit in');
const D=[['1','Python for AI','Typed modules, config, tests'],['2','Data and APIs','pandas dashboard, REST routes'],['3','Prompt engineering','Role prompts, structured output'],['4','LLM apps','Tools, memory, follow-ups'],['5','Multimodal','OCR of lab reports, voice input'],['6','Automation','9-step intake workflow'],['7','Embeddings','Vector store and search'],['8','RAG','Cited answers, abstain rule'],['9','Advanced RAG','Hybrid search, guardrails, audit'],['10','Agentic AI','Plan, tools, review, trace'],['11','Deployment','Docker, CI, health checks']];
D.forEach((a,i)=>{const c=i%4,r=Math.floor(i/4),x=.5+c*2.28,y=1.4+r*1.25;
 s.addShape('rect',{x,y,w:2.1,h:1.1,fill:{color:'FFFFFF'},line:{color:'D8E1E7'}});s.addShape('rect',{x,y,w:2.1,h:.07,fill:{color:T},line:{color:T}});
 s.addText('Day '+a[0]+'  '+a[1],{x:x+.1,y:y+.12,w:1.9,h:.35,fontFace:F,fontSize:13,bold:true,color:T,margin:0});
 s.addText(a[2],{x:x+.1,y:y+.5,w:1.9,h:.55,fontFace:F,fontSize:11.5,color:'33475A',valign:'top',margin:0});});
// screens
function scr(title,sub,n,pts){const s=base(title,sub);shot(s,n,.5,1.4,5.6,0.5625*1.0);bullets(s,pts,{x:6.4,y:1.5,w:3.1,h:3.4,fontSize:14});}
const ar={dashboard:1,queue:1,assistant:1,triage:1,agent:1};
const im=require('child_process').execSync(`python3 -c "from PIL import Image;import sys;[print(n,Image.open('${R}/assets/screens/'+n+'.png').size[1]/Image.open('${R}/assets/screens/'+n+'.png').size[0]) for n in ['dashboard','queue','assistant','triage','agent','documents','admin','login']]"`).toString().trim().split('\n').reduce((o,l)=>{const[a,b]=l.split(' ');o[a]=+b;return o},{});
function scr2(title,sub,n,pts){const s=base(title,sub);let w=5.7,h=w*im[n];if(h>3.7){h=3.7;w=h/im[n];}shot(s,n,.5,1.4,w,im[n]);bullets(s,pts,{x:6.5,y:1.5,w:3,h:3.4,fontSize:14});}
scr2('Command Center','Hospital view of the last 90 days','dashboard',['Throughput, waits, triage mix and readmission risk','Live emergency count for the selected site','Synthetic, de-identified data']);
scr2('Live Queue','Most urgent patient first','queue',['Waits turn red past the target for the triage level','Nurses start treatment from the queue','Data kept per hospital site']);
scr2('Clinical Assistant','Answers with sources','assistant',['Hybrid search over 38 guideline documents','Says it does not know when evidence is weak','Drug-interaction alert and emergency banner']);
scr2('AI Triage','Structured, explainable','triage',['Validated 5-level triage record','NEWS2 early-warning breakdown and reasons','Staff can override; every change is audited']);
scr2('Research Agent','Plan, tools, review, report','agent',['Bounded loop with a full trace','Safety review before the report is shown','Uses the same tools as the assistant']);
scr2('Patient reports','OCR with lab parsing','documents',['Reads scans and PDFs, flags abnormal values','Checks the medicine list for interactions','Analysed in memory; never stored or indexed']);
// security
s=base('Security and compliance');
bullets(s,['Five roles with least-privilege access: admin, doctor, nurse, receptionist, analyst','PBKDF2 passwords, signed expiring sessions, lockout after 5 failures, rate limits','SHA-256 hash-chained audit trail that detects tampering','Per-site data isolation and optional field encryption','FHIR R4 export with LOINC codes','Guardrails: PII masking, prompt-injection filter, crisis routing, no personal drug doses'],{x:.5,y:1.4,w:9,h:3.6,fontSize:16});
// testing
s=base('Testing and results');
[['36','automated tests passing'],['38','knowledge documents'],['9','workflow steps traced']].forEach((a,i)=>{const x=.5+i*3.1;s.addShape('roundRect',{x,y:1.5,w:2.9,h:1.5,fill:{color:'FFFFFF'},line:{color:'D8E1E7'},rectRadius:.08});
 s.addText(a[0],{x,y:1.55,w:2.9,h:.9,fontFace:F,fontSize:44,bold:true,color:T,align:'center',margin:0});s.addText(a[1],{x,y:2.45,w:2.9,h:.4,fontFace:F,fontSize:14,color:'546675',align:'center',margin:0});});
bullets(s,['Tests cover retrieval, guardrails, triage rules, auth, RBAC, audit chain, site isolation, FHIR and OCR','Browser run on the real server checked every screen and found no console errors'],{x:.5,y:3.3,w:9,h:1.5,fontSize:15});
// limits
s=base('Limits and next steps');
s.addText('Limits',{x:.5,y:1.4,w:4.3,h:.4,fontFace:F,fontSize:18,bold:true,color:T,margin:0});
bullets(s,['Decision support only; not a medical device','Rules, knowledge base and drug table need clinical validation','Demo uses fictional data','FastAPI and live-LLM modes were not run in the build environment'],{x:.5,y:1.85,w:4.3,h:3,fontSize:14});
s.addText('Next',{x:5.2,y:1.4,w:4.3,h:.4,fontFace:F,fontSize:18,bold:true,color:T,margin:0});
bullets(s,['Clinical review and a pilot at one site','PostgreSQL and single sign-on','Live HL7/FHIR connection to the hospital record','Larger multilingual knowledge base'],{x:5.2,y:1.85,w:4.3,h:3,fontSize:14});
// end
s=p.addSlide();s.background={color:N};
s.addText('Thank you',{x:.6,y:1.4,w:5,h:.9,fontFace:F,fontSize:44,bold:true,color:'FFFFFF',margin:0});
s.addText('Scan to open the live demo (fictional data)',{x:.6,y:2.5,w:5,h:.4,fontFace:F,fontSize:16,color:K,margin:0});
s.addShape('roundRect',{x:6.3,y:1.2,w:3,h:3,fill:{color:'FFFFFF'},rectRadius:.1,line:{color:'FFFFFF'}});
s.addImage({path:`${R}/assets/qr.png`,x:6.5,y:1.4,w:2.6,h:2.6});
p.writeFile({fileName:`${R}/deliverables/MediSphere_AI_Presentation.pptx`}).then(()=>console.log('ok'));
