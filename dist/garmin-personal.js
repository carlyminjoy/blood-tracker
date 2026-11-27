(function () {
  'use strict';
  const openFileSync = window.openGarminSync;
  async function request(action, body) {
    const response = await fetch('/api/garmin/' + action, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? {'Content-Type': 'application/json', 'X-Forma-Request': '1'} : {},
      ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw Error('Direct connection requires the Forma local server. File sync is also available.');
    }
    const result = await response.json();
    if (!response.ok) {
      const error = Error(result.error || 'Unable to reach Garmin.');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  window.openGarminSync = async () => {
    if (document.getElementById('garmin-personal-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'garmin-personal-dialog';
    dialog.className = 'sync-dialog';
    dialog.setAttribute('aria-labelledby', 'garmin-personal-title');
    dialog.innerHTML = `
      <div class="detail-top"><h2 id="garmin-personal-title">Connect Garmin Personal API</h2>
      <button class="close" aria-label="Close Garmin connection">×</button></div>
      <p class="sub">Sync sleep, overnight HRV, daily steps and resting heart rate into your personal workspace.</p>
      <p><a href="https://developer.garmin.com/gc-developer-program/personal/personal-api/" target="_blank" rel="noopener noreferrer">Create a personal key in Garmin Connect</a></p>
      <form><label>Personal API key <input type="password" name="key" autocomplete="off" required maxlength="4096" class="search"></label>
      <p class="note">Your key is exchanged for a token on the local server. The token is kept in memory for up to 8 hours. Reconnect after restarting the server.</p>
      <button class="btn" type="submit">Connect</button></form>
      <div class="detail-actions"><label>Recent history <select class="search" id="garmin-days"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="28">28 days</option></select></label>
      <button class="btn" data-sync disabled>Sync now</button><button class="soft" data-disconnect disabled>Disconnect</button></div>
      <p role="status" class="note">Checking connection…</p>
      <div data-server-help hidden><p>Start the local app from the repository folder, then open <a href="http://127.0.0.1:8765">http://127.0.0.1:8765</a>.</p><pre>python3 server/garmin_server.py</pre></div>
      <button class="linkbtn" data-file>Use file sync instead</button>`;
    document.body.append(dialog);
    const q = selector => dialog.querySelector(selector);
    const message = text => { q('[role=status]').textContent = text; };
    let connected = false, busy = false, available = false;
    function paint() {
      q('form').hidden = connected;
      q('[data-sync]').disabled = q('[data-disconnect]').disabled = busy || !connected;
      q('form button').disabled = busy || !available;
    }
    async function run(action) {
      if (busy) return;
      busy = true; paint();
      try { await action(); } catch (error) {
        if (error.status === 401) connected = false;
        message(error.message);
      }
      finally { busy = false; paint(); }
    }
    async function sync() {
      message('Reading Garmin data…');
      const today = new Date();
      const endDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
      const result = await request('sync', {days: Number(q('#garmin-days').value), endDate});
      if (!dialog.isConnected) return;
      const parser = window.formaWearParser;
      const rows = parser.merge(parser.fromText('garmin.json', JSON.stringify(result.records)));
      if (!rows.length) throw Error('Garmin returned no supported readings.');
      await window.formaSaveWear(rows, 'Garmin Personal API');
      const failed = Object.entries(result.endpoints || {}).filter(([, status]) => status.status === 'error').map(([name]) => name);
      message(rows.length + ' days synced.' + (failed.length ? ' Some data could not be fetched: ' + failed.join(', ') + '. Try again later.' : ''));
    }
    q('form').onsubmit = event => {
      event.preventDefault();
      run(async () => {
        let key = q('input').value.trim();
        q('input').value = '';
        message('Connecting to Garmin…');
        try { await request('connect', {key}); } finally { key = ''; }
        connected = true; paint();
        await sync();
      });
    };
    q('[data-sync]').onclick = () => run(sync);
    q('[data-disconnect]').onclick = () => run(async () => {
      await request('disconnect', {}); connected = false;
      message('Garmin disconnected. Imported readings remain in your workspace.');
    });
    q('.close').onclick = () => dialog.close();
    q('[data-file]').onclick = () => { dialog.close(); openFileSync(); };
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
    paint();
    try {
      connected = (await request('status')).connected;
      available = true;
      message(connected ? 'Garmin connected. Choose Sync now to refresh.' : 'Enter your key to connect and sync.');
    } catch (error) {
      message(error.message); q('[data-server-help]').hidden = false; q('input').disabled = true;
    }
    paint();
  };
})();
