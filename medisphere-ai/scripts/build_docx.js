const D=require('/opt/npm-tools/node_modules/docx');const fs=require('fs');
const {Document,Packer,Paragraph,TextRun,HeadingLevel,ImageRun,Table,TableRow,TableCell,WidthType,ShadingType,AlignmentType,Footer,PageNumber,PageBreak,LevelFormat,BorderStyle}=D;
const R=__dirname+'/..';
const P=(t,o={})=>new Paragraph({spacing:{after:120,line:300},children:[new TextRun({text:t,...o})]});
const H1=t=>new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun(t)]});
const H2=t=>new Paragraph({heading:HeadingLevel.HEADING_2,children:[new TextRun(t)]});
const B=t=>new Paragraph({numbering:{reference:'b',level:0},spacing:{after:60},children:[new TextRun(t)]});
const bd={style:BorderStyle.SINGLE,size:4,color:'C9D4DB'},borders={top:bd,bottom:bd,left:bd,right:bd};
function table(widths,rows){return new Table({width:{size:widths.reduce((a,b)=>a+b),type:WidthType.DXA},columnWidths:widths,rows:rows.map((r,i)=>new TableRow({tableHeader:i==0,children:r.map((c,j)=>new TableCell({borders,width:{size:widths[j],type:WidthType.DXA},margins:{top:70,bottom:70,left:110,right:110},shading:i==0?{fill:'0B2536',type:ShadingType.CLEAR}:undefined,children:[new Paragraph({children:[new TextRun({text:c,bold:i==0,color:i==0?'FFFFFF':'10212E',size:20})]})]}))}))});}
function img(n,cap){const w=600,h=Math.round(w*1640/2720);return [new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120,after:60},children:[new ImageRun({type:'png',data:fs.readFileSync(`${R}/assets/screens/${n}.png`),transformation:{width:w,height:h},altText:{title:n,description:cap,name:n}})]}),new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[new TextRun({text:cap,italics:true,size:19,color:'546675'})]})];}
const c=[
 new Paragraph({spacing:{before:2400,after:120},children:[new TextRun({text:'MediSphere AI',bold:true,size:72,color:'0B2536'})]}),
 new Paragraph({spacing:{after:600},children:[new TextRun({text:'Clinical intelligence for multinational hospitals',size:32,color:'0A6C8A'})]}),
 P('Capstone project report'),P('11-day AI Application Development course, Edvergencex x TTIT'),
 new Paragraph({children:[new PageBreak()]}),
 H1('1. Summary'),
 P('MediSphere AI is a clinical decision-support platform designed for a hospital group that operates in several countries. One sign-in gives each staff role the tools it needs: guideline answers with sources, AI-assisted triage with early-warning scoring, a live emergency queue, patient-report analysis, a research agent, an operations dashboard and FHIR-ready records. The same system serves four hospital sites (Hyderabad, Dubai, London and Singapore) in English, Hindi, Arabic (right to left) and Spanish.'),
 P('The project applies every topic of the 11-day course in a single working application. All data in the demo is fictional. The system supports clinicians; it does not replace clinical judgement and it needs clinical validation before use with real patients.'),
 H1('2. Problem and goals'),
 B('Triage differs between sites and between staff, and urgent patients can wait too long.'),
 B('Clinicians need quick answers from guidelines, with the source shown.'),
 B('Scanned reports and PDFs cannot be searched or checked for drug interactions.'),
 B('Each country has its own language, emergency number and data rules.'),
 B('Managers need one view of waits, triage mix and readmission risk.'),
 H1('3. Architecture'),
 P('Every request, from the browser or an API client, goes through one route pipeline: authentication, role check, rate limit, guardrails, the AI component, storage and an audit entry.'),
 table([2300,7060],[['Layer','What it does'],['Interface','Role-based screens, voice input, light and dark themes, four languages'],['API','Standard-library server and an optional FastAPI app share one dispatch function'],['Security','PBKDF2 passwords, signed expiring tokens, five roles, lockout, rate limits'],['Guardrails','PII masking, prompt-injection filter, crisis routing, no personal drug doses'],['AI core','Hybrid retriever, RAG answers, triage engine, tool registry, agents, OCR'],['Data','SQLite (WAL) with per-site isolation and optional field encryption; PostgreSQL path documented'],['Interoperability','FHIR R4 export with LOINC codes'],['Audit','SHA-256 hash-chained log that shows tampering']]),
 H1('4. Mapping to the 11 days'),
 table([900,2600,5860],[['Day','Topic','How it appears in MediSphere'],
 ['1','Python for AI development','Typed modules, configuration, a 36-test suite'],
 ['2','Data handling and AI APIs','pandas dashboard over 3,000 synthetic encounters; REST routes'],
 ['3','Prompt engineering and LLM basics','Role prompts and validated structured output (pydantic)'],
 ['4','LLM app development','Tool registry, offline intent router, conversation memory with follow-up detection'],
 ['5','Multimodal AI','Tesseract OCR of lab reports, lab value parsing, voice input'],
 ['6','AI workflow automation','Nine-step intake: validate, mask, triage, route, save, schedule, draft messages, draft note, audit'],
 ['7','Embeddings and vector databases','Own TF-IDF/LSA vector store over 38 knowledge documents'],
 ['8','RAG','Cited answers with an abstain threshold when evidence is weak'],
 ['9','Advanced RAG and enterprise AI','Hybrid BM25 + vector search, synonym expansion, guardrails, RBAC, audit trail'],
 ['10','Agentic AI','Bounded plan-act-review loop with a full trace'],
 ['11','Deployment and production','Dockerfile, compose, CI workflow, health endpoint, deployment guide']]),
 H1('5. Features'),
 H2('5.1 Command Center'),P('Throughput, average wait, triage mix, readmission risk and the live emergency count for the selected site.'),...img('dashboard','Figure 1. Command Center'),
 H2('5.2 Live Queue'),P('Patients are sorted by urgency. Waits turn red when they pass the target for the triage level, and a nurse can start treatment from the queue.'),...img('queue','Figure 2. Live Queue'),
 H2('5.3 Clinical Assistant'),P('Hybrid search finds the best guideline passages and the answer cites them. If the best score is below the threshold the assistant says it does not know. Emergency wording shows a banner with the local emergency number, and medicine lists are checked for interactions.'),...img('assistant','Figure 3. Clinical Assistant'),
 H2('5.4 AI Triage'),P('Vital signs and symptoms produce a validated five-level record with a NEWS2 breakdown and written reasons. Staff can override the level and every change is audited.'),...img('triage','Figure 4. AI Triage'),
 H2('5.5 Patient reports'),P('Scans and PDFs are read with OCR, lab values are parsed and flagged, and the medicine list is checked. The report is analysed in memory and is never stored or indexed.'),...img('documents','Figure 5. Patient report analysis'),
 H2('5.6 Research Agent'),P('The agent plans, calls tools, reviews its own output for safety and returns a report. The full trace is visible.'),...img('agent','Figure 6. Research Agent'),
 H2('5.7 Patients, administration and languages'),...img('patients','Figure 7. Patient registry'),...img('admin','Figure 8. Administration and audit'),...img('arabic','Figure 9. Arabic interface (right to left)'),
 H1('6. Security and privacy'),
 B('Five roles (admin, doctor, nurse, receptionist, analyst) with least-privilege access.'),
 B('Lockout for 15 minutes after 5 failed sign-ins; rate limits on all routes.'),
 B('Signed tokens that expire and can be revoked.'),
 B('Hash-chained audit trail; verification reports the first broken entry.'),
 B('Each hospital site sees only its own records.'),
 B('Names, phone numbers and IDs are masked before text reaches any model.'),
 H1('7. Testing'),
 P('The automated suite has 36 tests, all passing. It covers retrieval and the abstain rule, guardrails, NEWS2 and triage rules, drug interactions, authentication, role checks, lockout, audit-chain tampering, site isolation, FHIR output and OCR parsing. A browser run against the real server visited every screen and found no console errors. The hosted demo runs the same logic in the browser.'),
 H1('8. Limitations'),
 B('Triage rules, the knowledge base and the drug table are demonstration content and need review by clinicians before real use.'),
 B('The optional FastAPI app and live-LLM mode were compiled and checked but not run in the build environment.'),
 B('The demo database is SQLite; a hospital deployment should use PostgreSQL with managed keys.'),
 B('The system is decision support, not a medical device, and has no regulatory clearance.'),
 H1('9. Future work'),
 B('Clinical validation and a one-site pilot.'),
 B('Single sign-on and PostgreSQL.'),
 B('Live connection to the hospital record through HL7/FHIR.'),
 B('A larger multilingual knowledge base reviewed by clinicians.'),
];
const doc=new Document({styles:{default:{document:{run:{font:'Calibri',size:22}}},paragraphStyles:[
 {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:34,bold:true,color:'0B2536',font:'Calibri'},paragraph:{spacing:{before:320,after:160},outlineLevel:0}},
 {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{size:26,bold:true,color:'0A6C8A',font:'Calibri'},paragraph:{spacing:{before:220,after:100},outlineLevel:1}}]},
 numbering:{config:[{reference:'b',levels:[{level:0,format:LevelFormat.BULLET,text:'•',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]}]},
 sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1300,right:1440,bottom:1300,left:1440}}},
 footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'MediSphere AI  |  Page ',size:18,color:'7A8B98'}),new TextRun({children:[PageNumber.CURRENT],size:18,color:'7A8B98'})]})]})},children:c}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(R+'/deliverables/MediSphere_AI_Report.docx',b);console.log('ok')});
