// Descriptive wellness measures for adults. Preserve laboratory-specific intervals.
(() => {
'use strict';
const rcpa='https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests';
const hd='https://www.healthdirect.gov.au/';
const sources={
 lab:{name:'RCPA · Interpreting pathology tests',url:rcpa},
 iron:{name:'Australian Red Cross Lifeblood · Iron studies',url:'https://www.lifeblood.com.au/health-professionals/clinical-practice/clinical-indications/iron-deficiency-anaemia/diagnosis-investigation'},
 ironDiet:{name:'Healthdirect · Meeting your iron needs',url:hd+'healthy-living/food-and-nutrition/how-to-meet-your-iron-needs-infographic'},
 ironC:{name:'Healthdirect · Vitamin C and iron absorption',url:hd+'healthy-living/food-and-nutrition/vitamin-c-and-your-health'},
 ais:{name:'Australian Institute of Sport · Iron deficiency',url:'https://www.ausport.gov.au/ais/position_statements/iron-deficiency'},
 heart:{name:'Heart Foundation · Wholegrains and heart health',url:'https://www.heartfoundation.org.au/healthy-living/healthy-eating/wholegrains-and-heart-health'},
 oats:{name:'Ho et al. · Oat beta-glucan and LDL, randomised trial meta-analysis',url:'https://pubmed.ncbi.nlm.nih.gov/27724985/'},
 glycaemia:{name:'Diabetes Australia · Screening',url:'https://www.diabetesaustralia.com.au/prevention/reduce-your-risk/screening/'},
 legumes:{name:'Diabetes Australia · Legumes',url:'https://www.diabetesaustralia.com.au/blog/beans-chickpeas-lentils-and-split-peas/'},
 giTrials:{name:'BMJ · Lower-GI diets in diabetes, randomised trial meta-analysis',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC8336013/'},
 sleep:{name:'Australian 24-hour movement guidelines · Sleep evidence',url:'https://www.health.gov.au/sites/default/files/2026-03/australian-24-hour-movement-guidelines-for-adults-18-to-64-years-and-older-adults-65-years.pdf'},
 hrv:{name:'Garmin · Personal HRV baselines',url:'https://www.garmin.com/en-AU/blog/understanding-the-hrv-status-on-your-garmin-smartwatch/'},
 vitaminD:{name:'RCPA · 25-hydroxyvitamin D',url:rcpa+'/V/Vitamin-D'},
 vitSupport:{name:'Healthdirect · Vitamin D deficiency',url:hd+'healthy-living/food-and-nutrition/vitamin-d-deficiency'},
 bVitamins:{name:'Healthdirect · Vitamin B deficiency',url:hd+'healthy-living/food-and-nutrition/vitamin-b-deficiency'},
 mcv:{name:'RCPA · Mean cell volume',url:rcpa+'/M/Mean-cell-volume'},
 glucose:{name:'RCPA · Fasting plasma glucose',url:rcpa+'/G/Glucose'},
 crp:{name:'RCPA · C-reactive protein',url:rcpa+'/C/C-Reactive-Protein'},
 liver:{name:'Healthdirect · Liver function tests',url:hd+'procedures/diagnostic-tests-and-scans/blood-tests/liver-function-tests'}
};
const categories=[
 {id:'endurance',name:'Endurance',description:'Iron availability and red blood cells that carry oxygen.',markers:['ferritin','haemoglobin','tsat','mcv']},
 {id:'heart',name:'Heart health',description:'Blood lipids that inform cardiovascular risk assessment.',markers:['ldl','hdl','triglycerides','totalCholesterol']},
 {id:'metabolic',name:'Metabolic health',description:'Short- and longer-term measures of blood glucose.',markers:['fastingGlucose','hba1c']},
 {id:'recovery',name:'Recovery',description:'Sleep, inflammation and daily wearable trends.',markers:['sleep','hrv','restingHR','steps','crp']},
 {id:'nutrients',name:'Nutrient status',description:'Vitamins involved in bone health and blood cell formation.',markers:['vitaminD','b12','folate']},
 {id:'liver',name:'Liver health',description:'Enzymes used to investigate liver and biliary health.',markers:['alt','ggt','ast']}
];
function marker(id,name,unit,aliases,description,otherUnits=[],kind='blood') {
 return {id,name,unit,aliases,description,otherUnits,kind,categories:categories.filter(c=>c.markers.includes(id)).map(c=>c.id)};
}
const markers=[
 marker('ferritin','Ferritin','µg/L',['Serum ferritin','Ferritin (serum)'],'A measure of stored iron. Infection or inflammation can raise ferritin.',['ng/mL']),
 marker('haemoglobin','Haemoglobin','g/L',['Hemoglobin','HB','HGB'],'The oxygen-carrying protein in red blood cells.'),
 marker('tsat','Transferrin saturation','%',['TSAT','Transferrin sat','Iron saturation'],'The proportion of transferrin carrying iron.'),
 marker('mcv','Mean cell volume','fL',['MCV','Mean corpuscular volume'],'Average red blood cell size. Interpret alongside haemoglobin and iron studies.'),
 marker('ldl','LDL cholesterol','mmol/L',['LDL','LDL-C','Cholesterol LDL','LDL cholesterol calculated'],'LDL carries cholesterol in blood. Your treatment target depends on cardiovascular risk.'),
 marker('hdl','HDL cholesterol','mmol/L',['HDL','HDL-C','Cholesterol HDL'],'Part of a lipid profile used to assess cardiovascular risk.'),
 marker('triglycerides','Triglycerides','mmol/L',['TG','Serum triglycerides','Triglyceride'],'Blood fats influenced by meals, metabolic health and medicines.'),
 marker('totalCholesterol','Total cholesterol','mmol/L',['Cholesterol','Cholesterol total','Total chol'],'The combined cholesterol carried by lipoproteins.'),
 marker('fastingGlucose','Fasting glucose','mmol/L',['Fasting blood glucose','Fasting plasma glucose','Glucose fasting','FBG','FPG'],'A single fasting laboratory blood glucose measurement. Fasting status matters.'),
 marker('hba1c','HbA1c','%',['Glycated haemoglobin','Glycated hemoglobin','Haemoglobin A1c','Hemoglobin A1c','A1c'],'An estimate of average blood glucose over the previous two to three months.',['mmol/mol']),
 marker('crp','C-reactive protein','mg/L',['CRP','C reactive protein'],'An inflammation marker with many possible causes. This entry is for standard CRP.'),
 marker('vitaminD','Vitamin D','nmol/L',['25-hydroxyvitamin D','25-OH vitamin D','25-OH Vit D','25OHD','25 Hydroxy Vitamin D','Vitamin D 25 OH'],'25-hydroxyvitamin D reflects vitamin D status and varies with season.'),
 marker('b12','Vitamin B12','pmol/L',['Total B12','B12','Cobalamin','Serum vitamin B12'],'Total vitamin B12 is used to investigate nerve and red blood cell health.'),
 marker('folate','Serum folate','nmol/L',['Folate','Folate serum'],'Serum folate reflects recent folate availability for cell growth.'),
 marker('alt','ALT','U/L',['Alanine aminotransferase','Alanine transaminase','SGPT'],'An enzyme that can rise with liver cell injury.',['IU/L']),
 marker('ggt','GGT','U/L',['Gamma-glutamyl transferase','Gamma glutamyltransferase','Gamma GT','Gamma-glutamyl transpeptidase'],'An enzyme interpreted alongside the rest of the liver panel.',['IU/L']),
 marker('ast','AST','U/L',['Aspartate aminotransferase','Aspartate transaminase','SGOT'],'An enzyme found in liver and muscle. Several conditions can affect it.',['IU/L']),
 marker('sleep','Sleep duration','h',['Sleep','Sleep hours','Hours slept','Total sleep'],'Device-estimated sleep duration for the recorded day. The guideline shown is for adults aged 18–64.',['hours','hrs','hr'],'wearable'),
 marker('hrv','Overnight HRV','ms',['HRV','Heart rate variability','Nightly HRV'],'Beat-to-beat variation is most informative against your own baseline.',['milliseconds'],'wearable'),
 marker('steps','Daily steps','steps',['Steps','Step count','Total steps'],'A daily movement count. Track changes alongside your own routine.',[],'wearable'),
 marker('restingHR','Resting heart rate','bpm',['RHR','Resting HR','Resting pulse'],'A wearable estimate that can shift with illness, sleep and other factors.',['beats/min'],'wearable')
];
const markerMap=new Map(markers.map(m=>[m.id,m]));
const normName=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const names=new Map(markers.flatMap(m=>[m.id,m.name,...m.aliases].map(n=>[normName(n),m])));
const matchMarker=name=>names.get(normName(name))||null;
const normalUnit=unit=>String(unit??'').trim().toLowerCase().replace(/[µμ]/g,'u').replace(/\s/g,'');
function acceptsUnit(id,unit){
 const m=markerMap.get(id);
 return Boolean(m && [m.unit,...m.otherUnits].some(u=>normalUnit(unit)===normalUnit(u)));
}
Object.assign(sources,{
 survey:{name:'ABS · Australian population screening comparator',url:'https://www.abs.gov.au/methodologies/national-health-measures-survey-methodology/2022-24'},
 hb:{name:'RACGP · Adult female reference interval',url:'https://www.racgp.org.au/getattachment/ec21c057-d128-4236-ba1d-9d44b2370bbd/attachment.aspx'},
 astRef:{name:'WorkCover WA · Adult reference, appendix 13.1',url:'https://www.workcover.wa.gov.au/wp-content/uploads/2024/06/WorkCover-WA-Guidelines-for-thnt-1st-edition-1-July-2024.pdf'},
 b12Ref:{name:'RCPA · Total vitamin B12',url:rcpa+'/V/Vitamin-B12'},
 folateRef:{name:'RCPA · Serum folate',url:rcpa+'/F/Folate'}
});
const fallback={
 ldl:{high:3.5,highExclusive:true,key:'survey'},hdl:{low:1.3,key:'survey',context:'adult female'},
 triglycerides:{high:2,highExclusive:true,key:'survey'},totalCholesterol:{high:5.5,highExclusive:true,key:'survey'},
 hba1c:{high:6,highExclusive:true,key:'survey'},haemoglobin:{low:115,high:165,key:'hb'},
 alt:{high:30,key:'survey',context:'adult female'},ggt:{high:35,key:'survey',context:'adult female'},
 ast:{high:40,highExclusive:true,key:'astRef'},b12:{low:120,high:1000,key:'b12Ref'},folate:{low:7,high:40,key:'folateRef'},
 mcv:{low:80,high:100,key:'mcv'},crp:{high:5,highExclusive:true,key:'crp'},
 fastingGlucose:{low:3.0,high:5.4,key:'glucose'},sleep:{low:7,high:9,key:'sleep'}
};
const decisionThresholds={ferritin:{low:30,key:'iron'},tsat:{low:20,key:'iron'},vitaminD:{low:50,key:'vitaminD'}};
const valueOf=raw=>raw!==null && raw!==undefined && typeof raw!=='boolean' && String(raw).trim()!=='' && Number.isFinite(Number(raw))?Number(raw):null;
const unscored=(label,range='—',source='Reporting laboratory',sourceKey='lab',status='unknown')=>({status,label,range,source,sourceKey,scored:false});
function assess(r){
 if(!r) return unscored('No result','—','',null);
 const m=markerMap.get(r.marker),v=valueOf(r.value);
 if(!m||v===null||v<0||!acceptsUnit(m.id,r.unit)) return unscored('Check value or unit');
 if(m.id==='sleep' && v>24) return unscored('Check sleep duration','—','',null);
 if(m.kind==='wearable'&&m.id!=='sleep') return unscored('Trend only','Personal trend',m.id==='hrv'?sources.hrv.name:'Wearable data',m.id==='hrv'?'hrv':null,'context');
 const qualified=(r.qualifier&&r.qualifier!=='=')||(r.comparator&&r.comparator!=='=');
 const hasLow=r.low!=null&&r.low!=='',hasHigh=r.high!=null&&r.high!=='';
 let low=valueOf(r.low),high=valueOf(r.high),le=r.lowExclusive===true,he=r.highExclusive===true;
 let source='Reporting laboratory',sourceKey='lab';
 if(hasLow&&low===null||hasHigh&&high===null||low!==null&&high!==null&&low>=high) return unscored('Check reference interval');
 if(!hasLow&&!hasHigh||m.kind==='wearable'){
  const f=fallback[m.id];
  if(!f){
   const d=decisionThresholds[m.id];
   if(d&&qualified)return unscored('Qualified result','< '+d.low+' '+r.unit+' flags low',sources[d.key].name,d.key);
   if(d&&v<d.low) return {status:'low',label:'Below threshold',scored:true,range:'< '+d.low+' '+m.unit+' flags low',source:sources[d.key].name,sourceKey:d.key};
   return d?unscored('Low threshold met','< '+d.low+' '+r.unit+' flags low',sources[d.key].name,d.key,'context'):unscored('Check reference interval');
  }
  low=f.low??null;high=m.id==='hba1c'&&normalUnit(r.unit)==='mmol/mol'?42:(f.high??null);le=f.lowExclusive===true;he=f.highExclusive===true;sourceKey=f.key;source=sources[f.key].name+(f.context?' · '+f.context:'');
 }
 const range=(low!=null&&high!=null?(le?'> ':'')+low+' – '+(he?'< ':'')+high:low!=null?(le?'> ':'≥ ')+low:(he?'< ':'≤ ')+high)+' '+r.unit;
 if(qualified)return unscored('Qualified result',range,source,sourceKey);
 const status=low!==null&&(v<low||le&&v===low)?'low':high!==null&&(v>high||he&&v===high)?'high':'in';
 return {low,high,status,label:status==='in'?'In range':status==='low'?'Below range':'Above range',scored:true,range,source,sourceKey};
}
function latestByMarker(records){
 const latest=new Map();
 for(const r of records||[]){
  if(!r||!markerMap.has(r.marker)||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date))) continue;
  if(!latest.has(r.marker)||r.date>=latest.get(r.marker).date) latest.set(r.marker,r);
 }
 return latest;
}
function categoryResult(id,records){
 const cat=categories.find(c=>c.id===id),latest=latestByMarker(records);
 const rows=(cat?.markers||[]).map(id=>{const record=latest.get(id)||null;return {marker:markerMap.get(id),record,assessment:assess(record)};});
 const total=rows.filter(r=>r.assessment.scored).length,within=rows.filter(r=>r.assessment.status==='in').length;
 return {score:total?Math.round(100*within/total):null,within,total,available:rows.filter(r=>r.record).length,expected:rows.length,rows};
}
const methodology={
 category:'A category score is the percentage of its scorable latest measurements within their displayed ranges. Each marker has equal weight. Missing and trend-only values are excluded. Results may have different collection dates. The score is a descriptive summary and has no validated clinical or performance interpretation.',
 ranges:'Use the interval and unit on the original report first. When a report omits its range, Forma uses a cited adult reference interval, population screening comparator or decision threshold. Sex-specific comparisons in this personal workspace use adult female values. Lipid screening limits do not establish individual treatment targets. Unmatched units or missing intervals stay unscored. A single decision threshold only flags results in the direction it supports. Sleep guidance applies to adults aged 18–64.',
 relevance:'3/3 means the latest marker directly matches the action, 2/3 means the link is indirect, and 1/3 means a general habit associated with an in-range marker. Relevance is an app rule about fit to a measurement.',
 evidence:'3/3 means pooled randomised evidence directly supports the stated outcome. 2/3 means practice guidance or indirect intervention evidence. 1/3 means limited evidence or low-certainty guidance. Evidence scores are editorial, distinct from formal GRADE certainty and clinical urgency.'
};
const actions=[
 {id:'iron-followup',category:'endurance',title:'Review your iron studies',description:'Bring the full blood count and iron panel to your GP. Ask what might explain the result and whether follow-up is needed before starting iron.',targets:['ferritin','tsat','haemoglobin','mcv'],directions:['low','high'],evidence:2,evidenceNote:'Australian clinical guidance advises interpreting iron studies and haemoglobin together and investigating the cause of abnormal results.',sources:['iron','ais']},
 {id:'iron-food',category:'endurance',title:'Pair plant iron with vitamin C',description:'Try lentils with capsicum, or iron-fortified cereal with kiwi. This meal pairing helps absorb plant iron. A low ferritin result also warrants a review of the cause.',targets:['ferritin','tsat'],directions:['low'],maintenance:true,evidence:2,evidenceNote:'Australian guidance supports the absorption mechanism. A change in an individual ferritin result depends on the cause of iron loss and overall intake.',sources:['ironDiet','ironC','ais']},
 {id:'oat-fibre',category:'heart',title:'Add oats to a regular meal',description:'Choose porridge or overnight oats in place of a refined-grain breakfast. Oat beta-glucan is a soluble fibre that can lower LDL cholesterol.',targets:['ldl','totalCholesterol'],direct:['ldl'],directions:['high'],maintenance:true,evidence:3,evidenceNote:'A meta-analysis of randomised trials found LDL reductions with regular oat beta-glucan intake. The amount consumed matters.',sources:['oats','heart']},
 {id:'glucose-followup',category:'metabolic',title:'Review your glucose result',description:'Take the result and collection details to your GP. Ask whether fasting status, a repeat test or a different measurement changes its interpretation.',targets:['fastingGlucose','hba1c'],directions:['high','low'],evidence:2,evidenceNote:'Diabetes Australia recommends clinical interpretation and repeat screening when needed.',sources:['glycaemia','glucose']},
 {id:'legume-meal',category:'metabolic',title:'Include lentils in a meal',description:'Swap some refined grains for beans or lentils in a familiar meal. They provide fibre and a slower-digesting carbohydrate source.',targets:['fastingGlucose','hba1c'],directions:['high'],maintenance:true,evidence:2,evidenceNote:'Randomised trials support lower-GI dietary patterns in people with diabetes. Evidence for one meal substitution in a person without diagnosed diabetes is indirect.',sources:['legumes','giTrials']},
 {id:'sleep-routine',category:'recovery',title:'Protect a consistent sleep window',description:'Choose a regular wake time and allow enough time in bed for 7–9 hours of sleep if you are 18–64. Review several nights together.',targets:['sleep'],directions:['low'],maintenance:true,evidence:1,evidenceNote:'The Australian adult guideline recommends 7–9 hours. The panel rated certainty low for duration and very low for timing.',sources:['sleep']},
 {id:'crp-review',category:'recovery',title:'Put inflammation in context',description:'Discuss a raised CRP with your clinician alongside recent illness, symptoms and the reason for the test.',targets:['crp'],directions:['high'],evidence:2,evidenceNote:'Pathology guidance uses CRP as a nonspecific inflammation marker interpreted in clinical context.',sources:['crp']},
 {id:'vitaminD-review',category:'nutrients',title:'Review your vitamin D result',description:'Ask your GP whether the season, dietary intake or medicines affect the result and whether supplementation is appropriate.',targets:['vitaminD'],directions:['low','high'],evidence:2,evidenceNote:'Australian guidance supports assessment of vitamin D status and clinician-directed management where indicated.',sources:['vitaminD','vitSupport']},
 {id:'b-vitamin-review',category:'nutrients',title:'Discuss your B-vitamin result',description:'Bring your supplement list and usual food intake to a clinical review. Ask whether diet, absorption or another factor could explain the result.',targets:['folate','b12'],directions:['low','high'],evidence:2,evidenceNote:'Vitamin B deficiencies can have dietary and medical causes. Management depends on the underlying cause.',sources:['bVitamins','lab']},
 {id:'liver-review',category:'liver',title:'Review your liver panel',description:'Bring your report and list of medicines and supplements to your GP. Ask what the pattern means and whether follow-up tests are appropriate.',targets:['alt','ggt','ast'],directions:['high','low'],evidence:2,evidenceNote:'Healthdirect advises reviewing abnormal liver test results with a doctor who can interpret the pattern and recommend follow-up.',sources:['liver']}
];
function recommendations(records){
 const latest=latestByMarker(records);
 return actions.flatMap(action=>{
  const available=action.targets.filter(id=>latest.has(id)).map(id=>({id,record:latest.get(id),status:assess(latest.get(id)).status}));
  const matches=available.filter(r=>action.directions.includes(r.status));
  const maintenance=available.find(r=>r.status==='in');
  const byFit=matches.find(r=>!action.direct||action.direct.includes(r.id))||matches[0];
  if(!byFit&&(!action.maintenance||!maintenance||available.some(r=>['low','high'].includes(r.status)))) return [];
  if(action.id==='iron-food'&&available.some(r=>r.status==='high')) return [];
  const r=byFit||maintenance;
  const relevance=byFit?(!action.direct||action.direct.includes(r.id)?3:2):1;
  const reason=markerMap.get(r.id).name+' was '+r.record.value+' '+r.record.unit+' on '+r.record.date+'. '+(byFit?'The latest value is '+(r.status==='low'?'below':'above')+' its reference.':'The latest value is in range. This is a general habit.');
  return [{...action,relevance,reason}];
 }).sort((a,b)=>b.relevance-a.relevance||b.evidence-a.evidence);
}
// Strong administrative and narrative signatures also identify legacy OCR rows.
function reportProse(name,unit=''){
 const s=String(name||'').normalize('NFKC');
 return /\b(?:reported|collected|printed|requested|birth|DOB|provider|address|accession|medicare|telephone|patient name|lab no|specimen no)\b/i.test(s)
   || /\b(?:female|male)\b.*\b(?:years?|yrs?)\b/i.test(s)
   || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(s)
   || /\b(?:risk exceeds|absolute risk of|risk of .+ events|clinical interpretation|repeat testing|recommend(?:ed|ation)?|consult your|consistent with|may indicate)\b/i.test(s)
   || (/\b(?:risk|event|follow.up)\b/i.test(s)&&/^(?:years?|months?|weeks?)\.?$/i.test(unit));
}
const api={reportProse,markers,categories,actions,sources,methodology,assess,categoryResult,recommendations,matchMarker,acceptsUnit,latestByMarker};
if(typeof window!=='undefined') window.VitalClinical=api;
if(typeof module!=='undefined') module.exports=api;
})();
