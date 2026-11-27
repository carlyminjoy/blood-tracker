(()=>{
'use strict';
const C=window.VitalClinical;
const colors={endurance:['#36815b','#e4f1e6'],heart:['#be6c75','#f9e9eb'],metabolic:['#af802f','#f8efd9'],recovery:['#6485ab','#e8eef8'],nutrients:['#94813e','#f6f0d9'],liver:['#9276ac','#f1eafa']};
const lead={endurance:['ferritin','Ferritin'],heart:['ldl','LDL'],metabolic:['fastingGlucose','Glucose'],recovery:['sleep','Sleep'],nutrients:['vitaminD','Vitamin D'],liver:['alt','ALT']};
const tabs={overview:['Overview','overview'],blood:['Blood','tube'],plan:['Action plan','plan'],sources:['Data sources','sources'],age:['Inner age','age']};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T12:00:00')):'—';
const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const newBook=()=>({blood:[],wear:[],reports:[],wearImports:[],plan:{}});
const key='forma.workspace.v1';
let state;
try{state=JSON.parse(localStorage.getItem(key))}catch{}
if(!state||!state.real||!state.examplePlan)state={real:newBook(),examplePlan:{},mode:'example'};
const demo=newBook();
const sample=[
 ['ferritin',24,30,200,[41,39,43,34,32,27,28]],['haemoglobin',137,115,155],['tsat',24,15,45],['mcv',88,80,100],
 ['ldl',3.4,0,3,[3.8,3.5,3.6,3.1,3.3,3.2,3.5]],['hdl',1.7,1,2.5],['triglycerides',1.1,0,1.7],['totalCholesterol',5.1,0,5.5],
 ['fastingGlucose',4.8,3.5,5.4,[5.3,5.1,5.2,4.9,5,4.8,4.9]],['hba1c',5.1,4,5.6],
 ['vitaminD',68,50,150,[43,47,45,55,52,61,59]],['b12',360,150,650],['folate',23,7,45],
 ['alt',22,5,35,[26,24,27,24,20,21,19]],['ggt',18,5,35],['ast',21,10,35],['crp',1.4,0,5]];
const dates=['2025-02-20','2025-05-20','2025-08-20','2025-11-20','2026-02-20','2026-05-20','2026-08-20','2026-11-20'];
for(const [marker,value,low,high,history] of sample){const unit=C.matchMarker(marker).unit;demo.blood.push({marker,value,low,high,unit,date:dates.at(-1),report:'Example blood panel'});if(history)history.forEach((value,i)=>demo.blood.push({marker,value,low,high,unit,date:dates[i],report:'Example blood panel'}))}
[7.6,7.1,7.8,7.3,7.5,7.2,7.4,6.8].forEach((sleepHours,i)=>demo.wear.push({date:'2026-11-'+(13+i),sleepHours,hrv:[63,65,62,67,64,68,67,65][i],steps:[7212,8003,6790,7613,7103,8102,7251,7715][i],restingHR:[57,58,56,59,54,55,57,56][i]}));
demo.reports=dates.map(date=>({name:'Example blood panel',date,count:demo.blood.filter(r=>r.date===date).length}));
demo.wearImports=[{date:dates.at(-1),name:'Example wearable export',count:8}];
let route='overview',filter='recommended',query='',markerGroup='all';
const dialog=document.getElementById('detail'),main=document.getElementById('main');
const inExample=()=>state.mode==='example';
const book=()=>inExample()?{...demo,blood:state.exampleBlood??demo.blood}:state.real;
const plan=()=>inExample()?state.examplePlan:state.real.plan;
const persist=(next=state)=>{localStorage.setItem(key,JSON.stringify(next));state=next};
function records(){return [...book().blood,...book().wear.flatMap(row=>Object.entries({sleep:'sleepHours',hrv:'hrv',steps:'steps',restingHR:'restingHR'}).filter(([,field])=>row[field]!=null).map(([marker,field])=>({marker,value:row[field],unit:C.matchMarker(marker).unit,date:row.date,report:row.source||'Example wearable export'})))]}
function saveNew(change){const next=structuredClone(state);change(next.real);next.mode='personal';persist(next);render()}
const rowSources=r=>r.sources||[r.report||'Blood report'];
function bloodTests(rows){
 const tests=new Map();
 for(const r of rows){
   if(!tests.has(r.date))tests.set(r.date,{date:r.date,count:0,names:new Set()});
   const test=tests.get(r.date);test.count++;rowSources(r).forEach(n=>test.names.add(n));
 }
 return [...tests.values()].map(t=>({date:t.date,count:t.count,name:[...t.names].join(' · ')}));
}
// Keep original records locally so misclassified historical OCR is recoverable.
function cleanImportedProse(workspace){
 const suspect=workspace.blood.filter(r=>r.marker.startsWith('lab:')&&C.reportProse(r.markerName||r.marker.slice(4),r.unit));
 if(!suspect.length)return false;
 const rejected=new Set(suspect);
 workspace.excludedReportText=[...(workspace.excludedReportText||[]),...suspect];
 workspace.blood=workspace.blood.filter(r=>!rejected.has(r));workspace.reports=bloodTests(workspace.blood);
 return true;
}
if(cleanImportedProse(state.real)){try{persist()}catch{}}
const readingKey=r=>JSON.stringify([r.date,r.marker,r.unit,r.value,r.qualifier||'',r.low??null,r.high??null,!!r.lowExclusive,!!r.highExclusive,r.referenceText||'']);

// Stable identities for blood markers outside the category catalogue.
const bloodMarkerAliases=[
 ['albumin','Albumin',['Alb','Serum albumin']],
 ['alp','Alkaline phosphatase',['ALP','Alk. Phos.','Alk phos','Alkaline phosph']],
 ['anionGap','Anion gap',['Anion Gap']],
 ['calcium','Calcium',['Ca','Total calcium']],
 ['adjustedCalcium','Adjusted calcium',['Corrected calcium','Albumin adjusted calcium','Calcium adjusted for albumin','Adjusted for Albumin','Calcium corrected']],
 ['sodium','Sodium',['Na']],
 ['potassium','Potassium',['K','Potass.']],
 ['chloride','Chloride',['Cl']],
 ['bicarbonate','Bicarbonate',['HCO3','Bicarb']],
 ['creatinine','Creatinine',['Creat','Serum creatinine']],
 ['urea','Urea',[]],
 ['egfr','eGFR',['Estimated glomerular filtration rate']],
 ['totalProtein','Total protein',['T.Prot','Total prot']],
 ['globulin','Globulin',['Globulins','Glob']],
 ['bilirubin','Total bilirubin',['T.Bili','Bilirubin','Bilirubin total']],
 ['directBilirubin','Direct bilirubin',['Conjugated bilirubin']],
 ['magnesium','Magnesium',['Mg']],
 ['phosphate','Phosphate',['Phosphorus']],
 ['rbc','Red blood cell count',['RBC','RCC','Red cell count']],
 ['wbc','White blood cell count',['WBC','WCC','White cell count']],
 ['platelets','Platelets',['Platelet count','PLT']],
 ['haematocrit','Haematocrit',['Hematocrit','HCT','PCV']],
 ['mch','MCH',['Mean cell haemoglobin','Mean corpuscular haemoglobin']],
 ['mchc','MCHC',['Mean cell haemoglobin concentration','Mean corpuscular haemoglobin concentration']],
 ['rdw','RDW',['Red cell distribution width']],
 ['tsh','TSH',['Thyroid stimulating hormone']],
 ['freeT4','Free T4',['FT4']],
 ['freeT3','Free T3',['FT3']],
 ['amh','AMH',['Anti-Mullerian hormone','Anti Müllerian hormone']],
 ['iron','Iron',['Serum iron']],
 ['transferrin','Transferrin',[]]
];
const markerNameKey=name=>String(name??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
const bloodAliases=new Map(bloodMarkerAliases.flatMap(([id,name,aliases])=>
 [id,name,...aliases].map(alias=>[markerNameKey(alias),{id:'lab:'+id,name}])
));
function resolveBloodName(label){
 const known=C.matchMarker(label);
 return known?{id:known.id,name:known.name}:bloodAliases.get(markerNameKey(label));
}
function normaliseBloodRecord(record){
 const label=String(record.markerName||record.marker||'').replace(/^lab:/,'').trim();
 const exact=resolveBloodName(label)||resolveBloodName(String(record.marker||'').replace(/^lab:/,''));
 // Only remove a purely numerical suffix when its prefix is a recognised marker.
 // Digits inside B12, HbA1c, Free T4 and other meaningful names are retained.
 const suffix=label.match(/^(.*?)\s+([<>≤≥=+\-\d.\s–—]+)$/);
 const repaired=!exact&&suffix?resolveBloodName(suffix[1]):null;
 const match=exact||repaired;
 const name=match?.name||label.normalize('NFKC').replace(/\s+/g,' ');
 const marker=match?.id||'lab:'+markerNameKey(name);
 const changed=marker!==record.marker||name!==record.markerName;
 return {...record,marker,markerName:name,
   ...(changed?{originalMarker:record.originalMarker||record.marker,originalMarkerName:record.originalMarkerName||label}:{}),
   ...(repaired?{markerNeedsReview:true}:{})
 };
}
function normaliseBloodRecords(records){
 const unique=new Map();
 for(const record of records){
   const row=normaliseBloodRecord(record);
   // Reference metadata and qualifiers are part of reading identity. Conflicts survive.
   const key=JSON.stringify([row.marker,row.date,row.unit,row.value,row.qualifier||'',row.comparator||'',
     row.low??null,row.high??null,!!row.lowExclusive,!!row.highExclusive,row.referenceText||'']);
   const previous=unique.get(key);
   if(!previous){unique.set(key,row);continue;}
   previous.sources=[...new Set([...rowSources(previous),...rowSources(row)])];
   previous.markerNeedsReview=Boolean(previous.markerNeedsReview||row.markerNeedsReview);
   previous.originalMarkerNames=[...new Set([
     ...(previous.originalMarkerNames||[]),previous.originalMarkerName||previous.markerName,
     ...(row.originalMarkerNames||[]),row.originalMarkerName||row.markerName
   ])];
 }
 return [...unique.values()];
}
function normaliseWorkspaceBlood(workspace){
 workspace.blood=normaliseBloodRecords(workspace.blood);
 workspace.reports=bloodTests(workspace.blood);
}

const normalisedState=structuredClone(state);
normaliseWorkspaceBlood(normalisedState.real);
if(normalisedState.exampleBlood)normalisedState.exampleBlood=normaliseBloodRecords(normalisedState.exampleBlood);
if(JSON.stringify(normalisedState)!==JSON.stringify(state)){
 try{persist(normalisedState)}catch{state=normalisedState}
}
window.formaSaveBlood=(rows,reportName,options={})=>{
 if(!rows?.length)throw Error('No results to save.');
 rows=normaliseBloodRecords(rows);
 if(options.automatic&&rows.some(r=>r.markerNeedsReview))throw Error('A marker name contains possible result or range digits. Review these readings against the report.');
 let added=0;
 saveNew(real=>{
   normaliseWorkspaceBlood(real);
   const existing=new Map(real.blood.map(r=>[readingKey(r),r]));
   for(const r of rows){
     const key=readingKey(r),previous=existing.get(key);
     if(previous){previous.sources=[...new Set([...rowSources(previous),reportName])];continue;}
     const row={...r,report:reportName,sources:[reportName]};real.blood.push(row);existing.set(key,row);added++;
   }
   real.reports=bloodTests(real.blood);
 });
 toast(added?added+' new readings saved':'Matching readings already recorded');
};
window.formaPersonalActive=()=>!inExample();
window.formaSaveWear=(rows,source,quiet=false)=>{if(!rows.length)throw Error('No daily readings to save.');const prior=new Map(state.real.wear.map(r=>[r.date,r]));if(!inExample() && rows.every(r=>Object.entries(r).every(([k,v])=>prior.get(r.date)?.[k]===v))){if(!quiet)toast('Your wearable data is up to date');return}saveNew(real=>{const map=new Map(real.wear.map(r=>[r.date,r]));for(const row of rows)map.set(row.date,{...map.get(row.date),...row,source});real.wear=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));real.wearImports.unshift({name:source,date:day(),count:rows.length})});if(!quiet)toast(`${rows.length} days saved to your workspace`)};
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',3200)}
function tile(id,size=22){return `<span class="icon-tile" style="--accent:${colors[id]?.[0]||'#367159'};--light:${colors[id]?.[1]||'#e4efe6'}">${icon(id,size)}</span>`}
const tag=s=>`<span class="tag">${esc(s)}</span>`;
const dateMax=()=>Array.from(C.latestByMarker(records()).values()).map(r=>r.date).sort().at(-1);
function modeButton(){return `<button class="mode" data-do="workspace">${icon(inExample()?'flask':'lock',14)}${inExample()?'Example data':'Personal data'}${icon('down',12)}</button>`}
function heading(title,sub,actions=''){return `<div class="heading"><div><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></div><div class="tools">${modeButton()}${actions}</div></div>`}
const upload=()=>`<button class="btn" data-do="blood">${icon('up',16)}Upload results</button>`;
function sheet(html){document.getElementById('dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();dialog.scrollTop=0}
const closeBtn=()=>`<button class="close" aria-label="Close dialog" data-do="close">${icon('close',17)}</button>`;
const dt=(title,ico='info')=>`<div class="detail-top">${tile(ico)}<h2>${esc(title)}</h2>${closeBtn()}</div>`;
const status=a=>`<span class="badge ${a.status==='in'?'in':['low','high'].includes(a.status)?'out':'neutral'}">${esc(a.label)}</span>`;
function svgPlot(values,color,id,big=false){if(!values.length)return '';const width=big?520:104,height=big?115:32,top=5,base=height-4;
 const vals=values.map(a=>a.value),xs=values.map(a=>Date.parse(a.date));const lo=Math.min(...vals),hi=Math.max(...vals),left=xs[0],right=xs.at(-1);
 const pts=values.map((v,i)=>[right===left?width/2:3+(width-6)*(xs[i]-left)/(right-left),hi===lo?height*.5:base-(base-top)*(v.value-lo)/(hi-lo)]);const line=pts.map(a=>a.map(v=>v.toFixed(1)).join(',')).join(' ');const last=pts.at(-1);
 return `<svg ${big?'class="history-chart" role="img" aria-label="Result history. Exact values follow in the table."':'aria-hidden="true"'} viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".20"/><stop offset="100%" stop-color="${color}" stop-opacity=".01"/></linearGradient></defs><polygon points="${pts[0][0]},${height} ${line} ${last[0]},${height}" fill="url(#g${id})"/><polyline points="${line}" stroke="${color}" stroke-width="${big?2:1.8}" stroke-linejoin="round" stroke-linecap="round" fill="none"/><circle cx="${last[0]}" cy="${last[1]}" r="${big?3:2.1}" fill="${color}"/></svg>`}
function history(marker,rs){const latest=C.latestByMarker(rs).get(marker);if(!latest)return [];return rs.filter(r=>r.marker===marker&&r.unit===latest.unit&&(!r.qualifier||r.qualifier==='=')&&(!r.comparator||r.comparator==='=')&&Number.isFinite(+r.value)).sort((a,b)=>a.date.localeCompare(b.date))}
function catCard(cat,rs){const r=C.categoryResult(cat.id,rs), [m,label]=lead[cat.id],h=history(m,rs);return `<button class="category" style="--accent:${colors[cat.id][0]}" data-do="cat" data-id="${cat.id}"><div class="cat-body"><div class="cat-top">${tile(cat.id)}<h3>${esc(cat.name)}</h3></div><div class="cat-mid"><div><span class="score">${r.score??'—'}</span><span class="denom">/ 100</span><span class="label">${r.total?`${r.within} of ${r.total} in range`:'Awaiting results'}</span></div>${h.length>1?`<div class="spark">${svgPlot(h.slice(-12),colors[cat.id][0],cat.id)}<small>${label} trend</small></div>`:''}</div></div><div class="category-bottom"><span><i></i>${r.available} of ${r.expected} markers available</span>${icon('chev',14)}</div></button>`}
const recordLabel=rs=>rs.length===1?'marker':'markers';
function overview(){const rs=records(),latest=C.latestByMarker(rs),as=[...latest.values()].map(C.assess),within=as.filter(x=>x.status==='in').length,out=as.filter(x=>['low','high'].includes(x.status)).length,un=as.length-within-out;const score=within+out?Math.round(100*within/(within+out)):null;
 const summary=[['In range',within,'#5f9877'],['Outside range',out,'#e7ad60'],['Unscored',un,'#b7c8d8']];let start=0;const donut=summary.map(([,n,c])=>{const end=start+n/(as.length||1)*100;const from=start;start=end;return `${c} ${from}% ${end}%`}).join(',');
 const actions=C.recommendations(rs).slice(0,2);
 return heading('Health overview','Your latest blood results and wearable insights, in one place.',upload())+
 `<div class="summary-grid"><section class="hero"><div class="eyebrow">${icon('pulse',18)}Overall range score</div><div class="hero-score"><b>${score??'—'}</b><span>/ 100</span></div><p>${score==null?'Upload a result to calculate your first score.':`${within} of ${within+out} assessed markers in range`}</p><button class="hero-guide" data-do="guide">${icon('info',15)}How scoring works</button>${dateMax()?`<span class="hero-date">${icon('calendar',13)}Latest reading ${fmt(dateMax())}</span>`:''}</section><section class="panel summary-panel"><div class="panel-title"><h2>Biomarker status</h2>${icon('chart',18)}</div><div class="status-sum"><div class="donut" style="background:${as.length?`conic-gradient(${donut})`:'#e4e9e2'}"><div><b>${as.length}</b><small>markers</small></div></div><div class="legend">${summary.map(([label,n,c])=>`<div class="legend-row"><span><i style="background:${c}"></i>${label}</span><strong>${n}</strong></div>`).join('')}</div></div></section></div>
 <section class="section"><div class="section-head"><div class="flex"><h2>Health categories</h2>${tag('6')}</div><button class="linkbtn" data-do="markers">${icon('list',16)}All biomarkers</button></div><div class="category-grid">${C.categories.map(cat=>catCard(cat,rs)).join('')}</div></section>
 <div class="section lower-grid"><section class="panel"><div class="panel-title"><h2>Recommended actions</h2><button class="linkbtn" data-go="plan">View plan${icon('chev',14)}</button></div>${actions.length?actions.map(a=>`<div class="list-row"><div class="flex">${tile(a.category,17)}<div><b>${esc(a.title)}</b><small>${esc(C.categories.find(c=>c.id===a.category).name)} · Relevance ${a.relevance}/3</small></div></div><button class="linkbtn" data-do="action" data-id="${a.id}" aria-label="View ${esc(a.title)}">${icon('chev',18)}</button></div>`).join(''):`<p class="sub">Actions appear when you add relevant results.</p>`}</section><section class="panel"><div class="panel-title"><h2>Data sources</h2><button class="linkbtn" data-go="sources">Manage${icon('chev',14)}</button></div>${sourceRow('tube','Blood tests',bloodTests(book().blood).length?`${bloodTests(book().blood).length} blood tests`:'No reports yet','blood')}${sourceRow('watch','Garmin data',book().wear.length?`${book().wear.length} days of wearable data`:'No wearable data yet','wear')}</section></div>`}
function sourceRow(i,title,desc,action){return `<div class="source-line"><div class="flex"><span class="outline-icon">${icon(i,18)}</span><div><b>${title}</b><small>${esc(desc)}</small></div></div><button class="linkbtn" data-do="${action}" aria-label="Import ${title}">${icon('plus',17)}</button></div>`}

function cites(keys){return `<ul class="details-list">${[...new Set(keys)].filter(k=>C.sources[k]).map(k=>`<li><a href="${esc(C.sources[k].url)}" target="_blank" rel="noopener noreferrer">${esc(C.sources[k].name)}</a></li>`).join('')}</ul>`}
function guide(){sheet(dt('How scoring works','book')+`<div class="note">A score of 75 means three of four assessed markers fall within their displayed ranges. Fitness, disease risk and exercise clearance require a different assessment.</div>${Object.entries({category:'How the score is calculated',ranges:'Reference intervals',relevance:'Action relevance',evidence:'Research strength'}).map(([k,v])=>`<h3>${v}</h3><p class="sub">${esc(C.methodology[k])}</p>`).join('')}<p class="sub">The overall score counts each assessed marker once. An in-range value does not establish a performance optimum.</p>${cites(['lab','sleep','hrv'])}`)}
const categoryBy=id=>C.categories.find(c=>c.id===id);
const measured=r=>r?`${esc(r.qualifier&&r.qualifier!=='='?r.qualifier:'')}${esc(r.value)} ${esc(r.unit)}`:'—';
function resultsTable(rows){return `<div class="table-scroll"><table><thead><tr><th>Biomarker</th><th>Latest result</th><th>Status</th><th>Reference</th></tr></thead><tbody>${rows.map(({marker:m,record:r,assessment:a})=>`<tr><td><button class="table-link" data-do="marker" data-id="${m.id}">${esc(m.name)}</button></td><td>${measured(r)}${r?`<small>${fmt(r.date)}</small>`:''}</td><td>${status(a)}</td><td>${esc(a.range)}<small>${esc(a.source)}</small></td></tr>`).join('')}</tbody></table></div>`}
function showCategory(id){const c=categoryBy(id),rs=records(),r=C.categoryResult(id,rs),acts=C.recommendations(rs).filter(a=>a.category===id);sheet(dt(c.name,id)+`<p class="sub">${esc(c.description)}</p><span class="score">${r.score??'—'}</span><span class="denom">/ 100</span><div class="meter"><b style="width:${r.score||0}%;background:${colors[id][0]}"></b></div><p class="subtle">${r.within} of ${r.total} assessed markers in range · ${r.available} of ${r.expected} available</p>${resultsTable(r.rows)}<h3>Recommended actions</h3>${acts.length?acts.map(a=>`<div class="list-row"><div><b>${esc(a.title)}</b><small>Relevance ${a.relevance}/3 · Research evidence ${a.evidence}/3</small></div><button class="linkbtn" data-do="action" data-id="${a.id}">Details ${icon('chev',14)}</button></div>`).join(''):'<p class="sub">No action currently matches your latest results in this category.</p>'}<button class="linkbtn" data-do="guide">${icon('info',14)}Score guide and sources</button>`)}
function targetContext(id,r,rs){if(!r)return '';let desc='Forma has no established personal optimisation target for this marker. Use the reporting interval and any individual target agreed with your clinician.',refs=[];const qualify=!r.qualifier||r.qualifier==='=';
 if(id==='ferritin'){desc='For endurance athletes, the Australian Institute of Sport considers ferritin alongside haemoglobin and transferrin saturation. Recent infection or inflammation may increase ferritin, which can make depleted iron stores harder to recognise.';refs=['ais','iron']}
 if(id==='vitaminD'&&C.acceptsUnit(id,r.unit)&&qualify){desc=`The RCPA uses 50 nmol/L as an end-of-winter adequacy threshold. This result is ${r.value>=50?'at or above':'below'} that threshold. The collection season matters.`;refs=['vitaminD']}
 if(id==='ldl')desc='An individual LDL treatment target depends on cardiovascular risk and clinical history. The range score uses the limit on the report.';
 if(id==='sleep'){desc='Australian guidance recommends 7–9 hours of sleep for adults aged 18–64. Review the pattern across nights, allowing for device measurement error.';refs=['sleep']}
 if(['hrv','steps','restingHR'].includes(id)){const h=history(id,rs).filter(x=>x.date<r.date&&Date.parse(r.date)-Date.parse(x.date)<=28*86400000).map(x=>x.value).sort((a,b)=>a-b);desc='The most useful comparison is your own recent trend. Forma uses up to 28 preceding days and needs seven recorded days to display a median.';if(h.length>=7){const mid=Math.floor(h.length/2),median=h.length%2?h[mid]:(h[mid]+h[mid-1])/2;desc=`Your previous ${h.length} recorded days within the past four weeks had a median of ${median} ${r.unit}. Your latest value was ${r.value} ${r.unit}.`};if(id==='hrv')refs=['hrv']}
 return `<h3>Target context</h3><p class="sub">${esc(desc)}</p>${cites(refs)}`;}
function showMarker(id){const m=C.matchMarker(id),rs=records(),r=C.latestByMarker(rs).get(id),a=C.assess(r),all=rs.filter(x=>x.marker===id).sort((x,y)=>y.date.localeCompare(x.date)),h=history(id,rs);
sheet(dt(m.name,m.categories[0])+`<p class="sub">${esc(m.description)}</p>${r?`<span class="score">${esc(r.qualifier&&r.qualifier!=='='?r.qualifier:'')}${esc(r.value)}</span><span class="denom">${esc(r.unit)}</span> ${status(a)}<p class="date-note">Collected ${fmt(r.date)} · ${esc(r.report||'Imported result')}</p><p class="note"><strong>Reference</strong> &nbsp;${esc(a.range)}<br>${esc(a.source)}</p>`:'<p class="note">No result recorded for this marker.</p>'}${targetContext(id,r,rs)}${all.length?`<h3>Result history</h3>${all.length?bloodChart(all.filter(x=>x.unit===r.unit),r.unit):''}<div class="table-scroll"><table><thead><tr><th>Collected</th><th>Result</th><th>Reference</th><th>Source</th></tr></thead><tbody>${all.map(x=>`<tr><td>${fmt(x.date)}</td><td>${measured(x)}</td><td>${esc(C.assess(x).range)}</td><td>${esc(rowSources(x).join(' · '))}</td></tr>`).join('')}</tbody></table></div>`:''}${cites([a.sourceKey])}<div class="detail-actions"><button class="soft" data-do="cat" data-id="${m.categories[0]}">Back to category</button><button class="linkbtn" data-do="markers">All biomarkers</button></div>`)}
function filtered(){const rs=records(),rows=C.categories.flatMap(c=>C.categoryResult(c.id,rs).rows).filter(r=>(markerGroup==='all'||r.marker.categories.includes(markerGroup))&&[r.marker.name,...r.marker.aliases].some(s=>s.toLowerCase().includes(query.toLowerCase())));return rows.length?resultsTable(rows):'<p class="note">No markers match your search.</p>'}
function showAll(){sheet(dt('All biomarkers','tube')+`<p class="sub">Select a marker to see its reference, source and result history.</p><div class="rowtools"><input id="search" class="search" type="search" placeholder="Search biomarkers" aria-label="Search biomarkers"><select id="group" class="search" aria-label="Filter by category"><option value="all">All categories</option>${C.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div id="filtered">${filtered()}</div>`)}
function getAction(id){return C.recommendations(records()).find(a=>a.id===id)||plan()[id]?.snapshot}
function ratings(a){return `<div class="ratings"><span>Relevance &nbsp;<b>${a.relevance} / 3</b></span><span>Research evidence &nbsp;<b>${a.evidence} / 3</b></span></div>`}
function actButton(a){let p=plan()[a.id];return p?`<button class="soft" data-do="log" data-id="${a.id}">${icon('check',15)}${p.dates.includes(day())?'Logged today':'Log today'}</button>`:`<button class="btn" data-do="add" data-id="${a.id}">${icon('plus',15)}Add to plan</button>`}
function showAction(id){const a=getAction(id),p=plan()[id];if(!a)return;const stale=p&&!C.recommendations(records()).some(x=>x.id===id);sheet(dt(a.title,a.category)+(stale?'<p class="note">Saved from earlier results. The ratings below reflect the measurements when this action was added.</p>':'')+`<p class="sub">${esc(a.description)}</p>${ratings(a)}<h3>Why it’s relevant</h3><p class="sub">${esc(a.reason)}</p><h3>What the research supports</h3><p class="sub">${esc(a.evidenceNote)}</p>${cites(a.sources)}${p?`<h3>Tracking history</h3><p class="date-note">Added ${fmt(p.added)}</p>${p.dates.length?p.dates.slice().reverse().map(d=>`<span class="history-day">${fmt(d)}</span>`).join(''):'<p class="sub">Your first check-in will appear here.</p>'}`:''}<div class="detail-actions">${actButton(a)}${p?`<button class="soft" data-do="remove" data-id="${id}">Remove from plan</button>`:''}<button class="linkbtn" data-do="guide">Rating guide</button></div>`)}
function actionCard(a){const p=plan()[a.id];return `<article class="action"><div class="label">${icon(a.category,16)}${esc(categoryBy(a.category).name)}</div><h3>${esc(a.title)}</h3><p class="sub">${esc(a.description)}</p>${ratings(a)}${p?`<p class="date-note">${p.dates.length} check-in${p.dates.length===1?'':'s'} · ${p.dates.length?'Last logged '+fmt(p.dates.at(-1)):'Added '+fmt(p.added)}</p>`:''}<div class="action-foot"><button class="linkbtn" data-do="action" data-id="${a.id}">${icon('book',15)}Evidence & details</button>${actButton(a)}</div></article>`}
function planPage(){const recs=C.recommendations(records()),tracked=Object.keys(plan()).map(getAction).filter(Boolean),arr=filter==='tracked'?tracked:recs;return heading('Action plan','Choose actions linked to your results and log your progress over time.')+`<div class="tabs"><button class="${filter==='recommended'?'active':''}" data-do="recommended">Recommended (${recs.length})</button><button class="${filter==='tracked'?'active':''}" data-do="tracked">My plan (${tracked.length})</button></div><div class="section-head"><h2>${filter==='tracked'?'Your tracked actions':'Recommended for you'}</h2><button class="linkbtn" data-do="guide">${icon('info',15)}Rating guide</button></div>${arr.length?`<div class="action-grid">${arr.map(actionCard).join('')}</div>`:`<div class="blank"><h3>${filter==='tracked'?'Your plan starts here':'No matching actions yet'}</h3><p>${filter==='tracked'?'Select an action to start logging it.':'Add a supported marker to see recommendations.'}</p><button class="soft" data-do="${filter==='tracked'?'recommended':'blood'}">${filter==='tracked'?'Browse recommended actions':'Upload blood results'}</button></div>`}`}
function sourcePage(){const imports=[...bloodTests(book().blood).map(r=>({...r,type:'Blood test'})),...book().wearImports.map(r=>({...r,type:'Wearable data'}))].sort((a,b)=>b.date.localeCompare(a.date));return heading('Data sources','Manage your pathology reports and wearable data.')+`<div class="two-cols"><section class="panel source-card">${tile('tube')}<h2>Blood tests</h2><p class="sub">Upload a pathology PDF, image or CSV. Review the extracted markers, units and report intervals before saving.</p>${upload()}</section><section class="panel source-card">${tile('watch')}<h2>Garmin data</h2><p class="sub">Track sleep, overnight HRV, steps and resting heart rate through a personal Garmin sync file or a wearable export.</p><div class="rowtools"><button class="btn" data-do="sync">${icon('watch',16)}Set up Garmin sync</button><button class="soft" data-do="wear">${icon('up',16)}Import Garmin data</button></div></section></div><section class="section panel"><div class="section-head"><h2>Import history</h2>${tag(imports.length+' imports')}</div>${imports.length?`<div class="table-scroll"><table><thead><tr><th>File or source</th><th>Type</th><th>Collection / import date</th><th>Imported</th><th aria-label="Manage test"></th></tr></thead><tbody>${imports.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.type}</td><td>${fmt(r.date)}</td><td>${r.count} ${r.type==='Blood test'?'results':'days'}</td><td>${r.type==='Blood test'?deleteButton('test',r.date,'Delete test'):''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sub">Your reviewed imports will appear here.</p>'}</section><p class="note">${icon('lock',15)} Results and check-ins are stored in this browser on this device. Clearing site data removes them. Original blood reports are used during review only.</p>`}
function agePage(){return heading('Inner age','A future view of biomarker-based age estimates.')+`<section class="agebox"><span class="tag">${icon('clock',14)}Planned feature</span><h2>Biological age</h2><p>This space is reserved for an age estimate from a published biomarker model. A future release will show the model, required inputs and uncertainty alongside chronological age.</p></section>`}
function workspace(){sheet(dt('Your workspace','lock')+`<p class="sub">The example workspace uses fictional results. Your personal imports and check-ins stay in this browser.</p><div class="list-row"><div><b>Personal workspace</b><small>${state.real.blood.length} blood results · ${state.real.wear.length} wearable days</small></div><button class="soft" data-do="personal">${inExample()?'Open workspace':'Current view'}</button></div><div class="list-row"><div><b>Example workspace</b><small>Explore sample scores, trends and actions.</small></div><button class="soft" data-do="example">${inExample()?'Current view':'View example'}</button></div><p class="note">Your first import opens your personal workspace automatically.</p>`)}

let selectedBlood='';
const chartStyles={
 in:['In range','#347953'],low:['Below range','#ad6226'],high:['Above range','#b43b44'],
 context:['Unassessed','#708078'],unknown:['Unassessed','#708078']
};
function bloodChart(rows,unit){
 const exact=r=>(!r.qualifier||r.qualifier==='=')&&(!r.comparator||r.comparator==='=')&&r.value!=null&&String(r.value).trim()!==''&&Number.isFinite(+r.value);
 const points=rows.filter(exact).sort((a,b)=>a.date.localeCompare(b.date));
 if(!points.length)return '<p class="note">Only exact numerical readings can be plotted. Reported results are listed below.</p>';
 const assessments=points.map(bloodAssessment);
 const values=points.flatMap((r,i)=>[+r.value,assessments[i].low,assessments[i].high].filter(Number.isFinite));
 const lo=Math.min(...values),hi=Math.max(...values);
 const rough=((hi-lo)||Math.max(Math.abs(lo)*.1,1))/3;
 const magnitude=10**Math.floor(Math.log10(rough));
 const step=([1,2,2.5,5,10].find(n=>n*magnitude>=rough)||10)*magnitude;
 const bottom=Math.floor((lo-step*.12)/step)*step,top=Math.ceil((hi+step*.12)/step)*step;
 const y=value=>100*(top-value)/(top-bottom);
 const first=Date.parse(points[0].date),last=Date.parse(points.at(-1).date);
 const pos=points.map(r=>({x:last===first?50:2+96*(Date.parse(r.date)-first)/(last-first),y:y(+r.value)}));
 const labels=[],grid=[];
 for(let i=0;i<=Math.round((top-bottom)/step);i++){
   const value=Number((top-i*step).toPrecision(12)),pct=y(value);
   labels.push(`<span style="top:${pct}%">${value}</span>`);
   grid.push(`<i class="trend-grid" style="top:${pct}%"></i>`);
 }
 const hasRange=a=>Number.isFinite(a.low)||Number.isFinite(a.high);
 const fixed=assessments.every(a=>a.low===assessments[0].low&&a.high===assessments[0].high);
 const band=(a,i)=>{
   if(!hasRange(a))return '';
   const start=a.high==null?0:y(a.high),end=a.low==null?100:y(a.low);
   const style=fixed?'left:0;width:100%':`left:${pos[i].x}%;width:8px;transform:translateX(-50%)`;
   return `<i class="trend-band" style="${style};top:${start}%;height:${Math.max(0,end-start)}%"></i>`;
 };
 const dots=points.map((r,i)=>{
   const a=assessments[i],[,color]=chartStyles[a.status]||chartStyles.context;
   return `<span class="trend-dot" style="left:${pos[i].x}%;top:${pos[i].y}%;--dot:${color}" data-x="${pos[i].x}" data-y="${pos[i].y}" data-date="${fmt(r.date)}" data-value="${measured(r)}" data-detail="${esc(a.label)} · ${esc(a.range)}"></span>`;
 });
 const legend=[...new Set(assessments.map(a=>chartStyles[a.status]||chartStyles.context))].map(([name,color])=>`<span><i style="background:${color}"></i>${name}</span>`).join('');
 return `<figure class="blood-chart"><figcaption>${esc(unit)} · ${points.length} exact reading${points.length===1?'':'s'}</figcaption><div class="trend-frame"><div class="trend-scale" aria-hidden="true">${labels.join('')}</div><div class="trend-plot" tabindex="0" role="group" aria-label="Result trend in ${esc(unit)}. Use left and right arrows to explore readings."><div aria-hidden="true">${fixed?band(assessments[0],0):assessments.map(band).join('')}${grid.join('')}<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pos.map(p=>p.x+','+p.y).join(' ')}" vector-effect="non-scaling-stroke" fill="none" stroke="#4c7969" stroke-width="2"/></svg><i class="trend-cursor" hidden></i>${dots.join('')}</div><output class="trend-tip" hidden><strong></strong><span></span><small></small></output></div><div class="trend-dates ${first===last?'single':''}"><span>${fmt(points[0].date)}</span>${first===last?'':`<span>${fmt(points.at(-1).date)}</span>`}</div></div><div class="trend-legend">${assessments.some(hasRange)?`<span><i class="band-key"></i>${fixed?'Reference range':'Reference at each test'}</span>`:''}${legend}</div></figure>`;
}
function highlightReading(plot,index){
 const dots=plot.querySelectorAll('.trend-dot');
 const dot=dots[index],tip=plot.querySelector('.trend-tip'),cursor=plot.querySelector('.trend-cursor');
 plot.querySelector('.active')?.classList.remove('active');
 dot.classList.add('active');
 plot.dataset.active=index;
 cursor.hidden=false;cursor.style.left=dot.style.left;
 tip.hidden=false;
 tip.querySelector('strong').textContent=dot.dataset.value;
 tip.querySelector('span').textContent=dot.dataset.date;
 tip.querySelector('small').textContent=dot.dataset.detail;
 const x=plot.clientWidth*dot.dataset.x/100,y=plot.clientHeight*dot.dataset.y/100;
 tip.style.left=Math.max(0,Math.min(x-tip.offsetWidth/2,plot.clientWidth-tip.offsetWidth))+'px';
 tip.style.top=(y>tip.offsetHeight+10?y-tip.offsetHeight-9:y+10)+'px';
}
function hideReading(plot){
 plot.querySelector('.trend-tip').hidden=true;
 plot.querySelector('.trend-cursor').hidden=true;
 plot.querySelector('.active')?.classList.remove('active');
 delete plot.dataset.active;
}
function exploreChart(event){
 const plot=event.target.closest('.trend-plot');
 if(!plot)return;
 const rect=plot.getBoundingClientRect(),dots=[...plot.querySelectorAll('.trend-dot')];
 const x=100*(event.clientX-rect.left)/rect.width,y=100*(event.clientY-rect.top)/rect.height;
 let nearest=0;
 for(let i=1;i<dots.length;i++){
   const d=dots[i].dataset,b=dots[nearest].dataset;
   if(Math.abs(d.x-x)<Math.abs(b.x-x)||(d.x===b.x&&Math.abs(d.y-y)<Math.abs(b.y-y)))nearest=i;
 }
 highlightReading(plot,nearest);
}
document.addEventListener('pointermove',exploreChart);
document.addEventListener('pointerdown',e=>{
 const old=document.querySelector('.trend-plot[data-active]');
 if(old&&!old.contains(e.target))hideReading(old);
 exploreChart(e);
});
document.addEventListener('pointerout',e=>{
 const p=e.target.closest('.trend-plot');
 if(p&&e.pointerType!=='touch'&&!p.contains(e.relatedTarget))hideReading(p);
});
document.addEventListener('focusin',e=>{if(e.target.matches('.trend-plot')&&e.target.dataset.active==null)highlightReading(e.target,0)});
document.addEventListener('focusout',e=>{if(e.target.matches('.trend-plot'))hideReading(e.target)});
document.addEventListener('keydown',e=>{
 const p=e.target;
 if(!p.matches('.trend-plot'))return;
 const last=p.querySelectorAll('.trend-dot').length-1,idx=Number(p.dataset.active||0);
 if(e.key==='Escape'&&p.dataset.active!=null){e.preventDefault();hideReading(p);return}
 const next={ArrowLeft:Math.max(0,idx-1),ArrowRight:Math.min(last,idx+1),Home:0,End:last}[e.key];
 if(next!=null){e.preventDefault();highlightReading(p,next)}
});
function bloodAssessment(r){
 if(C.matchMarker(r.marker))return C.assess(r);
 const {low,high,qualifier,value,unit}=r;
 const range=low!=null&&high!=null?((r.lowExclusive?'> ':'')+low+' – '+(r.highExclusive?'< ':'')+high):low!=null?(r.lowExclusive?'> ':'≥ ')+low:high!=null?(r.highExclusive?'< ':'≤ ')+high:'';
 const numeric=typeof value==='number'&&!qualifier&&range;
 const status=numeric?(low!=null&&(value<low||r.lowExclusive&&value===low)?'low':high!=null&&(value>high||r.highExclusive&&value===high)?'high':'in'):'context';
 return {low,high,status,label:({in:'In range',low:'Below range',high:'Above range',context:'Recorded'})[status],range:r.referenceText||(range?range+' '+unit:'No reference supplied'),source:'Reporting laboratory'};
}
function deleteButton(scope,id,label){
 return `<button class="delete-link" data-do="deleteBlood" data-scope="${scope}" data-id="${esc(id)}">${label}</button>`;
}
function bloodDeletionMatch(scope,id){
 return {test:r=>r.date===id,marker:r=>r.marker===id,reading:r=>readingKey(r)===id}[scope];
}
function requestBloodDeletion(scope,id){
 const matches=bloodDeletionMatch(scope,id);
 if(!matches)return;
 const rows=book().blood.filter(matches);
 if(!rows.length)return;
 const r=rows[0],name=C.matchMarker(r.marker)?.name||r.markerName||r.marker.replace(/^lab:/,'');
 const description={
   test:`This removes all ${rows.length} reading${rows.length===1?'':'s'} collected on ${fmt(r.date)}, including readings from files merged into this test.`,
   marker:`This removes every recorded reading for ${esc(name)} (${rows.length} in total).`,
   reading:`This removes the ${esc(name)} reading of ${measured(r)} collected on ${fmt(r.date)}.`
 }[scope];
 sheet(dt(`Delete this ${scope}?`,'tube')+`<p class="sub">${description}</p><div class="detail-actions"><button class="soft" autofocus data-do="close">Cancel</button><button class="btn destructive" data-do="confirmBloodDelete" data-scope="${scope}" data-id="${esc(id)}">Delete ${scope}</button></div>`);
}
function deleteBlood(scope,id){
 const matches=bloodDeletionMatch(scope,id);
 if(!matches)return;
 const next=structuredClone(state);
 if(inExample())next.exampleBlood=book().blood.filter(r=>!matches(r));
 else{
   next.real.blood=next.real.blood.filter(r=>!matches(r));
   next.real.reports=bloodTests(next.real.blood);
 }
 persist(next);dialog.close();render();
 toast(({test:'Blood test deleted',marker:'Marker history deleted',reading:'Reading deleted'})[scope]);
}
function bloodPage(){
 const rs=book().blood,latest=new Map();
 for(const r of rs)if(!latest.has(r.marker)||r.date>=latest.get(r.marker).date)latest.set(r.marker,r);
 const markers=[...latest.values()].map(r=>C.matchMarker(r.marker)||{id:r.marker,name:r.markerName||r.marker.replace(/^lab:/,''),description:'Recorded from your pathology report.'}).sort((a,b)=>a.name.localeCompare(b.name));
 const header=heading('Blood','Explore every recorded blood marker and follow its changes over time.',upload());
 if(!markers.length)return header+'<section class="blank"><h2>Your blood history starts here</h2><p>Upload a pathology report to see your markers and their trends.</p></section>';
 const m=markers.find(m=>m.id===selectedBlood)||markers[0],rows=rs.filter(r=>r.marker===m.id).sort((a,b)=>b.date.localeCompare(a.date)),r=rows[0],a=bloodAssessment(r);
 return header+`<div class="blood-layout"><section class="panel blood-list"><div class="section-head"><h2>Recorded markers</h2>${tag(markers.length)}</div>${markers.map(x=>`<button class="blood-choice ${x===m?'selected':''}" aria-pressed="${x===m}" data-do="selectBlood" data-id="${esc(x.id)}"><span>${esc(x.name)}</span><small>${measured(latest.get(x.id))}</small></button>`).join('')}</section><section class="panel blood-detail"><div class="blood-title"><h2>${esc(m.name)}</h2>${deleteButton('marker',m.id,'Delete marker')}</div><p class="sub">${esc(m.description)}</p><span class="score">${measured(r)}</span> ${status(a)}<p class="date-note">Collected ${fmt(r.date)}</p><div class="note"><strong>Reference</strong> &nbsp;${esc(a.range)}<br>${esc(a.source)}</div><h3>Progress over time</h3>${[...new Set(rows.map(x=>x.unit))].map(u=>bloodChart(rows.filter(x=>x.unit===u),u)).join('')}<div class="table-scroll"><table><thead><tr><th>Collected</th><th>Result</th><th>Reference at test</th><th>Source report</th><th aria-label="Manage reading"></th></tr></thead><tbody>${rows.map(x=>`<tr><td>${fmt(x.date)}</td><td>${measured(x)}${x.markerNeedsReview?'<small>Check original report · marker name repaired</small>':''}</td><td>${esc(bloodAssessment(x).range)}</td><td>${esc(rowSources(x).join(' · '))}</td><td>${deleteButton('reading',readingKey(x),'Delete reading')}</td></tr>`).join('')}</tbody></table></div>${cites([a.sourceKey])}</section></div>`}


function render(){route=location.hash.slice(1);if(!Object.hasOwn(tabs,route))route='overview';document.title=`${tabs[route][0]} · Forma`;document.getElementById('nav').innerHTML=Object.entries(tabs).map(([id,[label,ico]])=>`<a href="#${id}" class="${route===id?'active':''}" ${route===id?'aria-current="page"':''}>${icon(ico,16)}${label}</a>`).join('');main.innerHTML=({overview,blood:bloodPage,plan:planPage,sources:sourcePage,age:agePage}[route])()+`<div class="overview-foot"><span>${icon('lock',13)}${inExample()?'Example workspace · Fictional health data':'Personal workspace · Saved on this device'}</span><button data-do="guide">Scoring methodology</button></div>`}
function mutatePlan(fn){const next=structuredClone(state);fn(next.mode==='example'?next.examplePlan:next.real.plan);persist(next);render()}
document.body.addEventListener('click',e=>{const el=e.target.closest('[data-do],[data-go]');if(!el)return;if(el.dataset.go){location.hash=el.dataset.go;return}const act=el.dataset.do,id=el.dataset.id;
try{switch(act){case'deleteBlood':requestBloodDeletion(el.dataset.scope,id);break;case'confirmBloodDelete':deleteBlood(el.dataset.scope,id);break;case'selectBlood':selectedBlood=id;render();break;case'close':dialog.close();break;case'guide':guide();break;case'workspace':workspace();break;case'personal':case'example':persist({...state,mode:act});dialog.close();render();break;
case'cat':showCategory(id);break;case'markers':query='';markerGroup='all';showAll();break;case'marker':showMarker(id);break;case'action':showAction(id);break;
case'sync':window.openGarminSync();break;case'blood':case'wear':if(dialog.open)dialog.close();(act==='blood'?window.openBloodImport:window.openWearImport)();break;
case'tracked':case'recommended':filter=act;render();break;
case'add':{const a=getAction(id);if(!a||plan()[id])break;mutatePlan(p=>{p[id]={added:day(),dates:[],snapshot:a}});if(dialog.open)showAction(id);toast('Action added to your plan');break}
case'log':if(!plan()[id]||plan()[id].dates.includes(day())){toast('Already logged today');break}mutatePlan(p=>p[id].dates.push(day()));if(dialog.open)showAction(id);toast('Check-in saved');break;
case'remove':sheet(dt('Remove this action?','plan')+`<p class="sub">Removing this action clears its ${plan()[id].dates.length} check-ins from this workspace.</p><div class="detail-actions"><button class="soft" data-do="action" data-id="${id}">Keep action</button><button class="btn" data-do="confirmRemove" data-id="${id}">Remove action</button></div>`);break;
case'confirmRemove':mutatePlan(p=>{delete p[id]});dialog.close();toast('Action removed');break}
}catch(err){toast(err.name==='QuotaExceededError'?'Device storage is full. Your change could not be saved.':'The change could not be completed. Please try again.')}}
);
document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;document.getElementById('filtered').innerHTML=filtered()}});
document.addEventListener('change',e=>{if(e.target.id==='group'){markerGroup=e.target.value;document.getElementById('filtered').innerHTML=filtered()}});
document.getElementById('profile').addEventListener('click',workspace);window.addEventListener('hashchange',()=>{if(dialog.open)dialog.close();render();window.scrollTo(0,0)});
window.addEventListener('storage',e=>{if(e.key===key&&e.newValue){try{const update=JSON.parse(e.newValue);if(update.real&&update.examplePlan){normaliseWorkspaceBlood(update.real);state=update;if(dialog.open)dialog.close();render()}}catch{}}});
render();
})();
