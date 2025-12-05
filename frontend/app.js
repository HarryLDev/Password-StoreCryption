async function api(path, method='GET', body) {
    const headers = {};
    if (localStorage.token) headers['x-auth-token'] = localStorage.token;
    const res = await fetch('/api/' + path, {
      method,
      headers: Object.assign({'Content-Type':'application/json'}, headers),
      body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
  }
  
  function render(html) { document.getElementById('main').innerHTML = html; }
  
  async function init() {
    const status = await api('has-master');
    if (!status.hasMaster) return renderSetup();
    if (!localStorage.token) return renderLogin();
    return renderVault();
  }
  
  function renderSetup() {
    render(`
      <h2>Set up master password</h2>
      <input id="master" type="password" placeholder="Create master password (min 8 chars)"/>
      <button id="btn">Create</button>
      <p id="msg"></p>
    `);
    document.getElementById('btn').onclick = async () => {
      const pw = document.getElementById('master').value;
      const r = await api('setup-master', 'POST', { password: pw });
      if (r.ok) {
        alert('Master password set. Please log in.');
        init();
      } else document.getElementById('msg').textContent = r.error || 'Error';
    };
  }
  
  function renderLogin() {
    render(`
      <h2>Login</h2>
      <input id="pw" type="password" placeholder="Master password"/>
      <button id="loginBtn">Login</button>
      <p id="msg"></p>
    `);
    document.getElementById('loginBtn').onclick = async () => {
      const pw = document.getElementById('pw').value;
      const r = await api('login', 'POST', { password: pw });
      if (r.token) {
        localStorage.token = r.token;
        init();
      } else {
        document.getElementById('msg').textContent = r.error || 'Login failed';
      }
    };
  }
  
  async function renderVault() {
    const r = await api('entries');
    if (r.error) { alert('Session expired or error'); localStorage.removeItem('token'); return init(); }
    const rows = (r.entries || []).map(e => `
      <tr>
        <td>${escapeHtml(e.site)}</td>
        <td>${escapeHtml(e.username)}</td>
        <td><button onclick="reveal(${e.id})">Reveal / Copy</button></td>
      </tr>
    `).join('');
    render(`
      <button id="logout">Logout</button>
      <h3>Your vault</h3>
      <table>
        <thead><tr><th>Site</th><th>Username</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3>Add entry</h3>
      <input id="site" placeholder="site (example.com)" />
      <input id="user" placeholder="username" />
      <div class="row">
        <div class="col"><input id="pwd" placeholder="password" /></div>
        <div style="width:120px"><button id="gen">Generate</button></div>
      </div>
      <button id="add">Add Entry</button>
      <p id="msg"></p>
    `);
    document.getElementById('logout').onclick = async () => { await api('logout','POST'); localStorage.removeItem('token'); init(); };
    document.getElementById('gen').onclick = () => { document.getElementById('pwd').value = generatePassword(16,true); };
    document.getElementById('add').onclick = async () => {
      const site = document.getElementById('site').value;
      const username = document.getElementById('user').value;
      const password = document.getElementById('pwd').value;
      const res = await api('entry', 'POST', { site, username, password });
      if (res.ok) { init(); } else { document.getElementById('msg').textContent = res.error || 'Error'; }
    };
  }
  
  function generatePassword(length=16, useSymbols=true) {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const syms = '!@#$%^&*()-_=+[]{};:,<.>/?';
    let chars = lower + upper + nums + (useSymbols ? syms : '');
    let pwd = '';
    const cryptoObj = window.crypto || window.msCrypto;
    const array = new Uint32Array(length);
    cryptoObj.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      pwd += chars[array[i] % chars.length];
    }
    return pwd;
  }
  
  function escapeHtml(s='') {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  
  window.reveal = async function(id) {
    // Fetch entries and find id, then copy to clipboard
    const r = await api('entries');
    const e = (r.entries || []).find(x => x.id === id);
    if (!e) return alert('Not found');
    // copy password to clipboard
    try {
      await navigator.clipboard.writeText(e.password);
      alert('Password copied to clipboard');
    } catch {
      prompt('Copy this password', e.password);
    }
  };
  
  init();
  