/* Read local Garmin daily summaries. Daily observations are merged by calendar date. */
(function () {
  'use strict';
  const LIMIT = 32 * 1024 * 1024;
  const columns = {date:'Date', sleepHours:'Sleep (h)', hrv:'HRV (ms)', steps:'Steps', restingHR:'Resting HR (bpm)'};
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value+'T12:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0,10) === value;
  }
  function number(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value !== 'string' || !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value.trim())) return null;
    return Number(value.trim().replace(/,/g,''));
  }
  function normalise(raw) {
    const fields = Object.create(null);
    for (const [key,value] of Object.entries(raw)) fields[key.toLowerCase().replace(/[^a-z0-9]/g,'')] = value;
    const date = [fields.calendardate, fields.date, fields.id].find(validDate);
    if (!date) return null;
    const row = {date};
    function set(key, names, min, max, divisor=1) {
      for (const name of names) {
        const n = number(fields[name]);
        if (n !== null && n >= min && n <= max) {row[key] = n/divisor; return;}
      }
    }
    set('steps',['totalsteps','steps','stepcount','dailysteps'],0,500000);
    if (!Number.isInteger(row.steps)) delete row.steps;
    set('restingHR',['restingheartrate','restinghr','restingheartratebpm','restinghrbpm','rhr','rhrbpm'],1,350);
    set('hrv',['lastnightavg','avgovernighthrv','overnighthrv','overnighthrvms','hrv','hrvms'],0.01,2000);
    set('sleepHours',['sleephours','sleeph','sleeptimehours','sleepdurationhours'],0.001,24);
    if (!row.sleepHours) set('sleepHours',['sleeptimeseconds','sleepsecs','sleeptimeinseconds','sleeptimedurationinseconds'],1,86400,3600);
    if (!row.sleepHours) {
      const stages = ['deepsleepseconds','lightsleepseconds','remsleepseconds'].map(k=>number(fields[k]));
      if (stages.every(n=>n !== null && n >= 0)) {
        const total=stages.reduce((s,n)=>s+n,0);
        if (total>0 && total<=86400) row.sleepHours=total/3600;
      }
    }
    return Object.keys(row).length>1 ? row : null;
  }
  function csv(text) {
    const delimiter=text.split(/\r?\n/,1)[0].includes(';')?';':',';
    const out=[]; let header=null, values=[], cell='', quoted=false;
    function end() {
      values.push(cell.trim());
      if (values.some(Boolean)) {
        if (!header) header=values;
        else {
          if (values.length!==header.length) throw Error('CSV row length differs from its header.');
          const r=normalise(Object.fromEntries(header.map((key,i)=>[key,values[i]])));
          if(r) out.push(r);
        }
      }
      values=[];cell='';
    }
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') {
        if(quoted && text[i+1]==='"') {cell+='"';i++;}
        else quoted=!quoted;
      } else if(c===delimiter && !quoted) {values.push(cell.trim());cell='';}
      else if(c==='\n' && !quoted) end();
      else cell+=c;
    }
    if(quoted) throw Error('A CSV field is missing a closing quote.');
    if(values.length || cell) end();
    return out;
  }
  function fromText(name,text) {
    text=text.replace(/^\uFEFF/,'');
    if (/\.csv$/i.test(name)) return csv(text);
    const out=[];
    function walk(data,depth) {
      if(!data || typeof data!=='object' || depth>7) return;
      if(Array.isArray(data)) {for(const item of data) walk(item,depth+1);return;}
      const row=normalise(data);
      if(row) out.push(row);
      for(const k of ['data','records','wellness','dailySummaries','userDailySummary','dailySleepDTO','sleepData','dailySleepSummaries','hrvSummary','hrvSummaries','userDailySummaries','summaries']) if(data[k]) walk(data[k],depth+1);
    }
    let data;
    try {data=JSON.parse(text);} catch {throw Error('Unable to read this JSON file. Choose an original daily-summary export.');}
    walk(data,0);return out;
  }
  function merge(rows) {
    const grouped=new Map();
    for (const row of rows) grouped.set(row.date,Object.assign(grouped.get(row.date)||{},row));
    return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date));
  }
  async function zipRows(file) {
    const read=async(a,b)=>new Uint8Array(await file.slice(a,b).arrayBuffer());
    const tail=await read(Math.max(0,file.size-65557),file.size), end=new DataView(tail.buffer);
    let i=tail.length-22;
    while(i>=0 && (end.getUint32(i,true)!==0x06054b50 || i+22+end.getUint16(i+20,true)!==tail.length)) i--;
    if(i<0) throw Error('Unzip this archive, then choose daily-summary JSON files.');
    const count=end.getUint16(i+10,true), size=end.getUint32(i+12,true), offset=end.getUint32(i+16,true);
    if(count===65535 || size>24*1024*1024 || offset+size>file.size) throw Error('Unzip this large archive first.');
    const dir=await read(offset,offset+size), view=new DataView(dir.buffer), decoder=new TextDecoder();
    const out=[]; let p=0, total=0;
    for(let k=0;k<count;k++) {
      if(p+46>dir.length || view.getUint32(p,true)!==0x02014b50) throw Error('Incomplete ZIP directory.');
      const flag=view.getUint16(p+8,true), method=view.getUint16(p+10,true), packed=view.getUint32(p+20,true), length=view.getUint32(p+24,true);
      const n=view.getUint16(p+28,true), extra=view.getUint16(p+30,true), comment=view.getUint16(p+32,true), local=view.getUint32(p+42,true);
      const name=decoder.decode(dir.subarray(p+46,p+46+n));p+=46+n+extra+comment;
      if(!/\.(csv|json)$/i.test(name) || !/udsfile|sleep|hrv|wellness|steps|dailysummar|resting.heartrate/i.test(name) || /__MACOSX/.test(name)) continue;
      if((flag&1) || ![0,8].includes(method) || packed>LIMIT || length>LIMIT || (total+=length)>150*1024*1024) throw Error('Choose a smaller set of extracted daily-summary JSON files.');
      const header=await read(local,local+30), hd=new DataView(header.buffer);
      if(header.length!==30 || hd.getUint32(0,true)!==0x04034b50) throw Error('Unreadable ZIP entry.');
      const start=local+30+hd.getUint16(26,true)+hd.getUint16(28,true);
      if(start+packed>file.size) throw Error('Truncated ZIP entry.');
      let stream=file.slice(start,start+packed).stream();
      if(method===8) {
        try {stream=stream.pipeThrough(new DecompressionStream('deflate-raw'));} catch {throw Error('Unzip this file first in your browser or file manager.');}
      }
      const reader=stream.getReader(), data=new Uint8Array(length);let pos=0;
      for(;;) {
        const {done,value}=await reader.read();if(done) break;
        if(pos+value.length>length) {await reader.cancel();throw Error('Unexpected ZIP entry size.');}
        data.set(value,pos);pos+=value.length;
      }
      if(pos!==length) throw Error('Truncated ZIP file.');
      for(const row of fromText(name,decoder.decode(data))) out.push(row);
    }
    return out;
  }
  const api={fromText,merge,zipRows};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  if(typeof window==='undefined') return;
  window.formaWearParser=api;
  window.openWearImport=function() {
    if(document.getElementById('fw-dialog')) return;
    const dlg=document.createElement('dialog');dlg.id='fw-dialog';dlg.className='fw-dialog';dlg.setAttribute('aria-labelledby','fw-title');
    dlg.innerHTML='<header><div><small>Data sources</small><h2 id="fw-title">Import wearable data</h2></div><button type="button" aria-label="Close" class="fw-close">×</button></header><p>Import your daily sleep, overnight HRV, steps and resting heart rate.</p><label class="fw-drop"><strong>Choose wearable files</strong><span>Garmin account ZIP, daily-summary JSON or CSV</span><input type="file" accept=".zip,.json,.csv" multiple></label><details><summary>Where do I find my data?</summary><p>Request a Garmin Connect account export. Choose the downloaded ZIP or its daily-summary JSON files. Availability varies by device.</p><a href="https://support.garmin.com/en-AU/?faq=W1TvTPW8JZ6LfJSfK512Q8" rel="noopener noreferrer" target="_blank">Garmin export instructions</a><p>For another wearable, use a CSV with the date (YYYY-MM-DD) and any of steps, sleepHours, hrv (ms) and restingHR (bpm).</p><button type="button" class="fw-template">Download CSV template</button></details><p class="fw-status" role="status"></p><div class="fw-preview"></div><footer><span>Files are processed in this browser.</span><button type="button" class="fw-save" disabled>Import days</button></footer>';
    document.body.append(dlg);
    const q=s=>dlg.querySelector(s), msg=q('.fw-status'), save=q('.fw-save'), preview=q('.fw-preview');
    let rows=[],source='',generation=0;
    q('.fw-close').onclick=()=>dlg.close();
    dlg.addEventListener('close',()=>{generation++;dlg.remove();});
    q('.fw-template').onclick=()=>{
      const url=URL.createObjectURL(new Blob(['date,steps,sleepHours,hrv,restingHR\r\n'],{type:'text/csv'})), a=document.createElement('a');
      a.href=url;a.download='forma-wearable-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    async function read(files) {
      const ticket=++generation;rows=[];save.disabled=true;preview.replaceChildren();msg.textContent='Reading summaries…';
      try {
        const all=[];let skipped=0;
        for(const f of files) {
          if(!/\.(json|csv|zip)$/i.test(f.name)) throw Error('Choose ZIP, CSV or JSON files.');
          if(!/\.zip$/i.test(f.name) && f.size>LIMIT) throw Error('Choose a daily summary smaller than 32 MB.');
          const chunk=/\.zip$/i.test(f.name)?await zipRows(f):fromText(f.name,await f.text());
          if(!chunk.length) skipped++;
          for(const r of chunk) all.push(r);
          if(ticket!==generation) return;
        }
        rows=merge(all);
        if(!rows.length) throw Error('No supported daily readings found. Choose daily summaries or use the CSV template.');
        source=files.some(f=>/garmin|udsfile|\.zip$/i.test(f.name))?'Garmin export':'Wearable export';
        msg.textContent=rows.length+' days available from '+rows[0].date+' to '+rows.at(-1).date+(skipped?' · '+skipped+' files with no daily readings':'')+'.';
        const table=document.createElement('table');table.createCaption().textContent='Latest imported readings';
        const head=table.createTHead().insertRow();
        for(const name of Object.values(columns)){const th=document.createElement('th');th.textContent=name;head.append(th);}
        const body=table.createTBody();
        for(const row of rows.slice(-5).reverse()){
          const tr=body.insertRow();
          for(const key of Object.keys(columns)) tr.insertCell().textContent=row[key]===undefined?'—':typeof row[key]==='number'?row[key].toLocaleString('en-AU',{maximumFractionDigits:2}):row[key];
        }
        preview.append(table);save.disabled=false;save.textContent='Import '+rows.length+(rows.length===1?' day':' days');
      } catch(e){if(ticket===generation) msg.textContent=e.message || 'Unable to read this export.';}
    }
    q('input').onchange=e=>read([...e.target.files]);
    const drop=q('.fw-drop');
    drop.ondragover=e=>e.preventDefault();drop.ondrop=e=>{e.preventDefault();read([...e.dataTransfer.files]);};
    save.onclick=async()=>{save.disabled=true;try{await window.formaSaveWear(rows,source);dlg.close();}catch{msg.textContent='Unable to save the readings.';save.disabled=false;}};
    dlg.showModal();
  };
})();
