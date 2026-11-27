(() => {
  'use strict';
  const root=typeof window==='undefined'?globalThis:window;
  const C=()=>root.VitalClinical;
  const markers=()=>C().markers.filter(m=>m.kind==='blood');
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blank=()=>({marker:'',value:'',unit:'',low:'',high:'',date:''});
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const lookup=s=>markers().find(m=>[m.id,m.name,...m.aliases].some(a=>norm(a)===norm(s)));
  function dateISO(s){
    let date=String(s||'').trim();
    const dm=date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if(dm)date=[dm[3],dm[2].padStart(2,'0'),dm[1].padStart(2,'0')].join('-');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';
    const d=new Date(date+'T00:00:00Z');
    return Number.isFinite(+d)&&d.toISOString().slice(0,10)===date?date:'';
  }
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  function parseValue(s){
    const m=String(s??'').trim().match(/^(<=|>=|<|>|≥|≤|=)?\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)$/i);
    if(!m||!Number.isFinite(+m[2])||+m[2]<0)return null;
    return m[1]&&m[1]!=='='?{value:+m[2],qualifier:m[1]}:{value:+m[2]};
  }
  function parseRange(raw){
    const s=String(raw??'').trim().replace(/^\((.*)\)$/,'$1').trim();
    if(!s)return {};
    const m=s.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?|\.\d+)$/i);
    if(m)return {low:m[1],high:m[2]};
    const r=parseValue(s);
    if(!r?.qualifier)return null;
    const k=['<','<=','≤'].includes(r.qualifier)?'high':'low';
    return {[k]:String(r.value),[k+'Exclusive']:r.qualifier==='<'||r.qualifier==='>'};
  }
  function validated(rows,reportDate){
    if(!rows.length)throw Error('Add a reading before saving.');
    const seen=new Set();
    return rows.map((r,i)=>{
      const fail=s=>{throw Error('Result '+(i+1)+' · '+s);};
      const label=String(r.marker||'').trim(),known=lookup(label);
      if(!label)fail('Enter a marker name.');
      const id=known?known.id:'lab:'+label.normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
      const raw=String(r.value??'').trim();
      const reading=parseValue(raw)||(!known && raw ? {value:/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)?Number(raw):raw}:null);
      if(!reading)fail('Enter a non-negative numerical result, including any comparison (such as <1).');
      if(known&&!String(r.unit||'').trim())fail('Enter the reported unit.');
      const date=dateISO(r.date||reportDate);
      if(!date||date>today())fail('Enter a valid collection date, today or earlier.');
      const key=id+' '+date+' '+String(r.unit||'');
      
      seen.add(key);
      const out={marker:id,...reading,date,unit:String(r.unit||'').trim(),...(!known?{markerName:label}:{}),...(r.referenceText?{referenceText:r.referenceText}:{})};
      for(const k of ['low','high'])if(String(r[k]??'').trim()){
        const n=parseValue(r[k]);if(!n||n.qualifier)fail('Enter non-negative numerical reference limits.');
        out[k]=n.value;if(r[k+'Exclusive'])out[k+'Exclusive']=true;
      }
      if(out.low!==undefined&&out.high!==undefined&&out.low>=out.high)fail('The lower limit must be below the upper limit.');
      return out;
    });
  }
  function splitCSV(raw){
    const text=raw.replace(/^\uFEFF/,''), head=text.split(/\r?\n/)[0];
    const sep=head.includes('\t')?'\t':head.includes(';')&&!head.includes(',')?';':',';
    const lines=[];let cells=[],cell='',quoted=false;
    const end=()=>{cells.push(cell.trim());if(cells.some(Boolean))lines.push(cells);cells=[];cell='';};
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&c===sep){cells.push(cell.trim());cell='';}
      else if(!quoted&&(c==='\r'||c==='\n')){if(c==='\r'&&text[i+1]==='\n')i++;end();}
      else cell+=c;
    }
    if(quoted)throw Error('The CSV has an unfinished quoted field.');
    end();return lines;
  }
  function parseCsv(raw){
    const [header,...lines]=splitCSV(raw);
    if(!header)throw Error('The CSV is empty.');

    const cols=header.map(norm), select=(...a)=>cols.findIndex(c=>a.includes(c));
    const ix={marker:select('marker','biomarker','test','testname','analyte','name'),value:select('value','result'),unit:select('unit','units'),date:select('date','collectiondate','sampledate','collected'),low:select('low','lower','reflow','referencelow','lowerlimit'),high:select('high','upper','refhigh','referencehigh','upperlimit'),range:select('range','interval','referencerange','referenceinterval'),qualifier:select('qualifier','comparator')};
    if([ix.marker,ix.value].includes(-1))throw Error('Include marker and value column headers.');
    const rows=[],issues=[];
    lines.forEach((cells,i)=>{
      const get=k=>cells[ix[k]]||'',m=lookup(get('marker'));
      
      const r={...blank(),marker:m?.id||get('marker'),value:(get('qualifier')+' '+get('value')).trim(),unit:get('unit'),date:dateISO(get('date'))};
      if(get('date')&&!r.date)issues.push('Row '+(i+2)+' · Confirm the collection date.');
      if(get('range')){const b=parseRange(get('range'));if(b)Object.assign(r,b);else r.referenceText=get('range');}
      for(const k of ['low','high'])if(get(k)){const b=parseRange(get(k));if(b&&b[k]!==undefined)Object.assign(r,b);else r[k]=get(k);}
      rows.push(r);
    });
    return {rows,issues};
  }
  function parseText(raw){
    const aliases=markers().flatMap(m=>[m.name,m.id,...m.aliases].map(a=>({a,m}))).sort((x,y)=>y.a.length-x.a.length);
    const rows=[],seen=new Set();
    for(const rawLine of raw.split(/[\r\n]+/)){
      let line=rawLine.trim().replace(/\|/g,' ').replace(/\s+/g,' ').replace(/\(([HL])\)/gi,' $1 ');
      line=line.replace(/^Blood HbA1c\s+(\d+(?:\.\d+)?)\s*%\s+\d{2}\/\d{2}\/\d{4}.*$/i,'HbA1c $1 %')
        .replace(/^HbA1c Fraction\s+(?=\d)/i,'HbA1c ').replace(/^Vitamin D3\s+/i,'Vitamin D ')
        .replace(/^Glucose\s+(\d+(?:\.\d+)?)\s+mmol\/L\s+fasting\b/i,'Fasting glucose $1 mmol/L')
        .replace(/^LDL\s*\(calculated\)\s*\*?\s*/i,'LDL ')
        .replace(/\((\s*(?:[<>]=?\s*)?\d[\d.\s–-]*)\)\s+[=|~]+$/,'($1)');
      if(/high\s+risk/i.test(raw)&&/^(?:Total Cholesterol|HDL|LDL|Triglycerides)\b/i.test(line))line=line.replace(/\s*\((?:below|above)\b.*$/i,'');
      const hit=aliases.find(({a})=>line.toLowerCase().startsWith(a.toLowerCase())&&/^[\s:=<>≤≥]/.test(line.slice(a.length)));
      if(!hit){
        if(/^(?:date|time|lab no|collected|reported|page|age|phone|fax|in SI units|target|printed|requested|dob)\b/i.test(line))continue;
        const g=line.match(/^([\p{L}][\p{L}\p{N} ()/.*%_-]{0,85}?)\s+([<>≤≥]?\s*[+-]?(?:\d+(?:\.\d+)?|\.\d+)|negative|positive|reactive|non-reactive|detected|not detected)\s*([^\s(]*)\s*(?:fasting\s*)?(?:\(([^)]+)\))?\s*[=|]*$/iu);
        if(!g||(!g[3]&&!g[4]&&!/[a-z]/i.test(g[2])))continue;
        if(g[3]&&!/[a-zµμ%£]/i.test(g[3]))continue;
        const name=g[1].trim().replace(/\*+$/,'').trim();
        const row={...blank(),marker:lookup(name)?.id||name,value:g[2].trim(),unit:g[3],referenceText:g[4]||'',...(parseRange(g[4])||{})};
        const fingerprint=JSON.stringify(row);if(!seen.has(fingerprint)){seen.add(fingerprint);rows.push(row);}continue;
      }
      const val=line.slice(hit.a.length).match(/^[ :]*((?:<=|>=|<|>|≤|≥|=)?\s*[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:[HL]\b\s*)?(.+)$/i);
      if(!val||!parseValue(val[1]))continue;
      const rest=val[2].trim();
      let unit,interval;
      const before=rest.match(/^(\([^()]+\)|[\d.]+\s*[-–—]\s*[\d.]+|[<>≤≥]=?\s*[\d.]+)\s+([^\s()]+)$/);
      if(before){interval=before[1];unit=before[2];}else {const after=rest.match(/^([^\s()]+)(?:\s+(.*))?$/);if(!after)continue;unit=after[1];interval=after[2];}
      if(!C().acceptsUnit(hit.m.id,unit))continue;
      const bounds=parseRange((interval||'').replace(/^[HL]\b\s*/i,''));
      if(bounds===null)continue;
      const r={...blank(),marker:hit.m.id,value:val[1].trim(),unit,...bounds};
      const key=JSON.stringify(r);if(!seen.has(key)){rows.push(r);seen.add(key);}
      
    }
    return rows;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={parseCsv,parseText,parseValue,validated,dateISO};return;}
  const base=new URL('.',document.currentScript?.src||location.href);
  const asset=name=>new URL('forma-vendor/'+name,base).href;
  root.openBloodImport=()=>{
    if(document.querySelector('dialog.fi-import'))return;
    const d=document.createElement('dialog');d.className='fi-import';d.setAttribute('aria-labelledby','fi-title');
    d.innerHTML=`<div class="fi-head"><div><h2 id="fi-title">Upload blood results</h2><p>Import one or more reports from this device.</p></div><button data-close aria-label="Close">×</button></div>
    <div class="fi-scroll"><section class="fi-start"><label class="fi-trust"><input type="checkbox" data-trust><span><strong>I trust the results</strong><small>Save extracted readings automatically, including OCR readings. Files that need more information will open for review.</small></span></label><label class="fi-drop"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg><strong>Choose files or drop them here</strong><span>PDF, JPG, PNG, WebP or CSV · up to 20 MB per file</span><input type="file" multiple aria-label="Choose blood reports" accept=".pdf,.csv,.png,.jpg,.jpeg,.webp"></label><button class="fi-manual" data-manual>Enter results manually</button>
    <details><summary>${markers().length} markers used for category scores</summary><p>${markers().map(m=>escape(m.name)).join(', ')}.</p></details><details><summary>CSV format and template</summary><p>Include marker, value and unit. Add date (YYYY-MM-DD or DD/MM/YYYY), low and high when available. Include comparisons in the value, such as &lt;1.</p><a download="blood-results-template.csv" href="data:text/csv;charset=utf-8,marker%2Cvalue%2Cunit%2Cdate%2Clow%2Chigh%0A">Download blank CSV template</a></details></section>
    <p class="fi-progress" role="status" hidden></p><section class="fi-review" hidden><div class="fi-file"></div><p class="fi-status" role="status"></p><div class="fi-layout"><div class="fi-original" hidden></div><div class="fi-editor"><details class="fi-issues" hidden></details><h3>Report details</h3><div class="fi-pair"><label>Report name<input class="fi-name" maxlength="140" placeholder="Blood test"></label><label>Collection date<input class="fi-date" type="date" max="${today()}"></label></div><div class="fi-results-head"><h3>Results to import</h3><button data-add>+ Add marker</button></div><p>Copy the units, comparisons and reference limits as printed. Leave unavailable limits blank. Qualified results such as &lt;1 appear in history and are excluded from scores.</p><datalist id="fi-marker-options">${markers().map(m=>'<option value="'+escape(m.name)+'"></option>').join('')}</datalist><div class="fi-rows"></div><label class="fi-check"><input type="checkbox"> I checked these values, units, dates and limits against the report.</label></div></div></section></div>
    <div class="fi-footer"><p role="alert"></p><button data-close>Cancel</button><button data-skip hidden>Skip file</button><button class="fi-save" data-save hidden>Save results</button></div>`;
    document.body.append(d); const q=s=>d.querySelector(s);
    let rows=[],busy=false,saving=false,sourceUrl='',pdf=null,pageNo=1,pageEpoch=0,ocrWorker=null;
    const status=s=>q('.fi-status').textContent=s, error=s=>q('[role=alert]').textContent=s;
    const showReview=()=>{q('.fi-start').hidden=true;q('.fi-review').hidden=false;q('[data-save]').hidden=false;};
    function render(){
      q('.fi-rows').innerHTML=rows.map((r,i)=>`<fieldset data-i="${i}"><legend>Result ${i+1}</legend><button class="fi-remove" data-remove="${i}" aria-label="Remove result ${i+1}">Remove</button><div class="fi-grid">
        <label class="fi-wide">Marker<input list="fi-marker-options" data-k="marker" value="${escape(lookup(r.marker)?.name||r.marker)}" placeholder="Type any marker name"></label>
        <label>Value<input data-k="value" value="${escape(r.value)}"></label><label>Unit<input data-k="unit" maxlength="32" value="${escape(r.unit)}"></label>
        ${['low','high'].map(k=>`<label>${k==='low'?'Lower':'Upper'} limit<span class="fi-bound"><select aria-label="Comparison for ${k} limit" data-k="${k}Exclusive"><option value="">${k==='low'?'≥':'≤'}</option><option value="1" ${r[k+'Exclusive']?'selected':''}>${k==='low'?'&gt;':'&lt;'}</option></select><input data-k="${k}" inputmode="decimal" maxlength="28" value="${escape(r[k])}"></span></label>`).join('')}
        <label class="fi-wide">Reference text (optional)<input data-k="referenceText" value="${escape(r.referenceText||'')}"></label><label class="fi-wide">Result date (if different)<input type="date" data-k="date" max="${today()}" value="${escape(r.date)}"></label></div></fieldset>`).join('');
      q('.fi-check input').checked=false;
    }
    function draft(found){rows=found.length?found:[blank()];render();status(found.length?found.length+' suggested result'+(found.length===1?'':'s')+'. Review each reading and add any missing markers.':'Enter the results you can verify against the original.');}
    function reportIssues(issues){const box=q('.fi-issues');box.hidden=!issues.length;box.innerHTML='<summary>Review '+issues.length+' import notes</summary><ul>'+issues.map(s=>'<li>'+escape(s)+'</li>').join('')+'</ul>';}
    function original(html){d.classList.add('fi-with-source');q('.fi-original').hidden=false;q('.fi-original').innerHTML='<details open><summary>Original report</summary>'+html+'</details>';}
    async function renderPage(p){
      const token=++pageEpoch;
      const page=await pdf.getPage(p), v=page.getViewport({scale:1}), viewport=page.getViewport({scale:Math.min(2,1250/Math.max(v.width,v.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label','Report page '+p);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      if(!d.isConnected||token!==pageEpoch)return;
      pageNo=p;q('.fi-pages').replaceChildren(canvas);q('.fi-page-no').textContent=p+' of '+pdf.numPages;
      q('[data-prev]').disabled=p<=1;q('[data-next]').disabled=p>=pdf.numPages;
    }
    function pdfLines(items){
      const lines=[];
      for(const item of items){
        if(!item.str?.trim())continue;
        const y=item.transform[5], x=item.transform[4];let row=lines.find(l=>Math.abs(l.y-y)<=Math.max(1.5,Math.min(3,(item.height||9)*.21)));
        if(!row){row={y,parts:[]};lines.push(row);}row.parts.push({x,s:item.str});
      }
      return lines.sort((a,b)=>b.y-a.y).map(l=>l.parts.sort((a,b)=>a.x-b.x).map(p=>p.s).join(' ')).join('\n');
    }
    let queue=[],pending=[],current=null,total=0,imported=0,readings=0,instant=false,skipped=[],problem='';
    function resetFile(){
      pageEpoch++;if(pdf){pdf.destroy().catch(()=>{});pdf=null;}
      if(sourceUrl){URL.revokeObjectURL(sourceUrl);sourceUrl='';}
      rows=[];pageNo=1;problem='';q('.fi-date').value='';q('.fi-original').hidden=true;
      q('.fi-original').replaceChildren();d.classList.remove('fi-with-source');reportIssues([]);render();error('');
    }
    function summary(){return imported+' of '+total+' files saved · '+readings+' readings'+(skipped.length?' · Skipped: '+skipped.join(', '):'');}
    async function advance(){
      while(d.open){
        resetFile();const review=!queue.length;
        current=review?pending.shift():queue.shift();
        const progress=q('.fi-progress');progress.hidden=false;
        if(!current){q('.fi-review').hidden=true;q('[data-save]').hidden=true;q('[data-skip]').hidden=true;q('.fi-footer [data-close]').textContent='Done';progress.textContent=summary();return;}
        progress.textContent=summary()+' · '+current.file.name;
        await openFile(current.file);if(!d.open)return;
        if(instant&&/\.(png|jpe?g|webp)$/i.test(current.file.name)&&sourceUrl){
          try{await q('.fi-pages img').decode();await ocr();}catch{problem='Image needs manual entry.';}
        }
        if(!instant||review){q('.fi-check').hidden=instant;q('[data-skip]').hidden=false;error(current.reason||problem);return;}
        try{
          if(problem)throw Error(problem);
          const values=validated(rows,q('.fi-date').value);
          await root.formaSaveBlood(values,q('.fi-name').value,{automatic:true});imported++;readings+=values.length;
        }catch(e){current.reason=e.message;pending.push(current);}
      }
    }
    async function startBatch(files){
      if(total||!files.length)return;
      queue=Array.from(files,file=>({file}));total=queue.length;instant=q('[data-trust]').checked;
      q('.fi-start').hidden=true;showReview();await advance();
    }
    async function openFile(file){
      if(!file||busy)return;
      const ext=file.name.split('.').at(-1).toLowerCase();
      if(file.size>20*1024*1024||!['pdf','csv','png','jpg','jpeg','webp'].includes(ext)){problem='Unsupported file type or file larger than 20 MB.';draft([]);q('.fi-file').textContent=file.name;q('.fi-name').value=file.name;error(problem);return;}
      busy=true;showReview();error('');q('.fi-file').textContent=file.name;q('.fi-name').value=file.name.replace(/\.[^.]+$/,'').slice(0,140);status('Reading your file…');
      try{
        if(ext==='csv'){const p=parseCsv(await file.text());if(d.isConnected){draft(p.rows);reportIssues(p.issues);if(p.issues.length)problem=p.issues.join(' ');}}
        else if(ext==='pdf'){
          const lib=await import(asset('pdf.min.mjs'));lib.GlobalWorkerOptions.workerSrc=asset('pdf.worker.min.mjs');
          const doc=await lib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,useSystemFonts:true}).promise;
          if(!d.isConnected){await doc.destroy();return;}pdf=doc;
          original('<div class="fi-pages"></div><div class="fi-tools"><button data-prev>Previous</button><span class="fi-page-no"></span><button data-next>Next</button><button data-ocr>Read page with OCR</button></div>');
          const found=[],seen=new Set(),textDates=new Set(),notes=[];
          let worker;
          try{
            for(let n=1;n<=Math.min(doc.numPages,30)&&d.isConnected;n++){
              const page=await doc.getPage(n);let text=pdfLines((await page.getTextContent()).items);
              const scanned=text.trim().length<40;
              if(scanned){
                status('Reading scanned page '+n+' of '+doc.numPages+' on this device…');
                try{
                  if(!worker){const {default:t}=await import(asset('tesseract.esm.min.js'));worker=await t.createWorker('eng',1,{workerPath:asset('worker.min.js'),corePath:asset('tesseract-core-lstm.js'),langPath:asset('').replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none'});ocrWorker=worker;}
                  const v=page.getViewport({scale:1}),vp=page.getViewport({scale:2050/Math.max(v.width,v.height)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
                  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
                  text=(await worker.recognize(canvas)).data.text;
                }catch{notes.push('Page '+n+' needs manual review.');continue;}
              }
              const md=text.match(/\bCollected(?:\s+Date)?\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i);
              const date=md?dateISO(md[1].replace(/\/(\d{2})$/,'/20$1')):'';
              for(const row of parseText(text)){row.date=date;const mk=row.marker+'|'+date;if(scanned&&(textDates.has(mk)||(row.marker==='hba1c'&&row.unit==='%'&&Number(row.value)>25)))continue;if(!scanned)textDates.add(mk);const key=JSON.stringify([row.marker,row.unit,row.value,row.date]);if(!seen.has(key)){seen.add(key);found.push(row);}}
            }
          }finally{if(worker){await worker.terminate().catch(()=>{});ocrWorker=null;}}
          if(d.isConnected){draft(found);await renderPage(1);if(notes.length||doc.numPages>30)problem='Some pages need review.';notes.push('Check scanned digits against the original. Check for missed rows and add any marker by name. High-risk-only lipid targets are excluded.');if(doc.numPages>30)notes.push('Review pages after page 30 manually.');reportIssues(notes);}

        } else {sourceUrl=URL.createObjectURL(file);original('<div class="fi-pages"><img alt="Original uploaded report"></div><div class="fi-tools"><button data-ocr>Read image with OCR</button></div>');q('.fi-pages img').src=sourceUrl;draft([]);}
      } catch(e){if(d.isConnected){draft([]);status(ext==='csv'?e.message:'Unable to read this PDF. Open the original on your device and enter the readings below.');}}
      finally{busy=false;}
    }
    async function ocr(){
      if(busy)return;busy=true;status('Reading the page on this device…');
      try{
        const {default:t}=await import(asset('tesseract.esm.min.js'));
        const worker=await t.createWorker('eng',1,{workerPath:asset('worker.min.js'),corePath:asset('tesseract-core-lstm.js'),langPath:asset('').replace(/\/$/,''),workerBlobURL:false,cacheMethod:'none',logger:m=>{if(d.isConnected&&m.status==='recognizing text')status('Reading the page · '+Math.round(m.progress*100)+'%');}});
        if(!d.isConnected){await worker.terminate();return;}
        ocrWorker=worker;const {data}=await worker.recognize(q('.fi-pages canvas')||q('.fi-pages img'));
        if(!d.isConnected)return;
        const collected=data.text.match(/\bCollected(?:\s+Date)?\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i);
        if(collected&&!q('.fi-date').value)q('.fi-date').value=dateISO(collected[1].replace(/\/(\d{2})$/,'/20$1'));
        const kept=rows.filter(r=>r.marker||r.value||r.unit), adds=parseText(data.text).filter(r=>!kept.some(k=>k.marker===r.marker&&k.value===r.value&&k.unit===r.unit));
        if(adds.length){rows=kept.concat(adds);render();}
        status(adds.length?adds.length+' suggested results added. Compare each with the original.':'No new supported readings were recognised. Enter results directly from the report.');
      } catch{if(d.isConnected)status('Unable to recognise this page. Enter readings directly from the report.');}
      finally{if(ocrWorker){ocrWorker.terminate().catch(()=>{});ocrWorker=null;}busy=false;}
    }
    d.addEventListener('click',async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-close')){if(!saving)d.close();return;}
      if(b.hasAttribute('data-skip')){if(busy||saving)return;skipped.push(current.file.name);await advance();return;}
      if(b.hasAttribute('data-manual')){showReview();draft([]);q('.fi-name').focus();return;}
      if(b.hasAttribute('data-add')){if(busy){error('Wait for extraction to finish.');return;}rows.push(blank());render();q('.fi-rows').lastElementChild.querySelector('input').focus();return;}
      if(b.hasAttribute('data-remove')){rows.splice(+b.dataset.remove,1);render();return;}
      if(b.hasAttribute('data-ocr')){await ocr();return;}
      if(b.matches('[data-prev],[data-next]')){try{await renderPage(Math.min(pdf.numPages,Math.max(1,pageNo+(b.hasAttribute('data-prev')?-1:1))));}catch{error('Unable to show this page.');}return;}
      if(b.hasAttribute('data-save')){
        if(busy){error('Wait for extraction to finish.');return;}if(saving)return;
        try{error('');const result=validated(rows,q('.fi-date').value);if(!instant&&!q('.fi-check input').checked){q('.fi-check input').focus();throw Error('Confirm that you checked these results.');}
          saving=true;b.disabled=true;await root.formaSaveBlood(result,q('.fi-name').value.trim()||'Blood test');if(total){imported++;readings+=result.length;saving=false;b.disabled=false;await advance();}else d.close();
        }catch(e){error(e.message||'Unable to save this report.');}finally{saving=false;b.disabled=false;}
      }
    });
    d.addEventListener('input',e=>{if(e.target.dataset.k){const k=e.target.dataset.k;rows[+e.target.closest('[data-i]').dataset.i][k]=k.endsWith('Exclusive')?e.target.value==='1':e.target.value;}if(e.target!==q('.fi-check input'))q('.fi-check input').checked=false;error('');});
    q('input[type=file]').addEventListener('change',e=>startBatch(e.target.files));
    q('.fi-drop').addEventListener('dragover',e=>e.preventDefault());
    q('.fi-drop').addEventListener('drop',e=>{e.preventDefault();startBatch(e.dataTransfer.files);});
    d.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    d.addEventListener('close',()=>{pageEpoch++;if(ocrWorker){ocrWorker.terminate().catch(()=>{});ocrWorker=null;}if(pdf)pdf.destroy().catch(()=>{});if(sourceUrl)URL.revokeObjectURL(sourceUrl);d.remove();},{once:true});d.showModal();
  };
})();
