// URL Shortener with multiple providers, local fallback, copy/open, history, theme
(function(){
  const $ = (s)=>document.querySelector(s);
  const els = {
    themeToggle: $('#themeToggle'),
    longUrl: $('#longUrl'),
    provider: $('#provider'),
    slugWrap: $('#slugWrap'),
    customSlug: $('#customSlug'),
    shortenBtn: $('#shortenBtn'),
    resetBtn: $('#resetBtn'),
    alert: $('#alert'),
    resultBox: $('#result'),
    shortLink: $('#shortLink'),
    copyBtn: $('#copyBtn'),
    openBtn: $('#openBtn'),
    tableWrap: $('#tableWrap'),
    clearBtn: $('#clearBtn'),
    exportBtn: $('#exportBtn'),
  };

  // Theme
  (function initTheme(){
    const saved = localStorage.getItem('shortener-theme');
    if(saved === 'light') document.documentElement.classList.add('light');
    els.themeToggle.textContent = document.documentElement.classList.contains('light') ? '🌙' : '☀️';
  })();
  els.themeToggle.addEventListener('click', ()=>{
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('shortener-theme', isLight ? 'light' : 'dark');
    els.themeToggle.textContent = isLight ? '🌙' : '☀️';
  });

  // Show slug only for local provider
  const providerChange = ()=>{
    els.slugWrap.hidden = els.provider.value !== 'local';
  };
  els.provider.addEventListener('change', providerChange);
  providerChange();

  // Redirect helper for local mode using ?go=slug
  (function maybeRedirect(){
    const params = new URLSearchParams(location.search);
    const slug = params.get('go');
    if(!slug) return;
    try{
      const map = JSON.parse(localStorage.getItem('shortener-map') || '{}');
      if(map[slug]){
        location.replace(map[slug]);
      }else{
        showAlert(`No local mapping stored for slug "${slug}". Use the same browser that created it, or choose an external provider.`, 'warn');
      }
    }catch{}
  })();

  function normalizeUrl(u){
    try{
      // Add scheme if missing
      if(!/^([a-z]+:)?\/\//i.test(u)) u = 'https://' + u;
      const url = new URL(u);
      return url.href;
    }catch{ return null; }
  }

  function showAlert(msg, kind='warn'){
    els.alert.textContent = msg;
    els.alert.classList.remove('hidden');
    els.alert.className = 'alert'; // reset
    if(kind==='warn') els.alert.classList.add('warn');
    if(kind==='err') els.alert.classList.add('err');
    setTimeout(()=> els.alert.classList.add('hidden'), 4000);
  }

  async function shorten(){
    const long = normalizeUrl(els.longUrl.value.trim());
    if(!long){ showAlert('Please enter a valid URL (e.g., https://example.com).', 'err'); return; }

    const provider = els.provider.value;
    disableUI(true);
    let short = null, providerLabel = provider;

    try{
      if(provider === 'local'){
        const slug = makeSlug(els.customSlug.value.trim());
        if(slug === false){ showAlert('Slug may contain letters, numbers, dash, underscore.', 'err'); disableUI(false); return; }
        const shortUrl = makeLocalShort(slug);
        saveLocalMapping(slug, long);
        short = shortUrl; providerLabel = 'local';
      }else if(provider === 'cleanuri'){
        short = await viaCleanURI(long); providerLabel = 'CleanURI';
      }else if(provider === 'shrtco'){
        short = await viaShrtco(long); providerLabel = 'shrtco.de';
      }else if(provider === 'isgd'){
        short = await viaIsGd(long); providerLabel = 'is.gd';
      }
    }catch(e){
      showAlert(e.message || 'Shortening failed.', 'err');
    }finally{
      disableUI(false);
    }

    if(short){
      els.shortLink.textContent = short;
      els.shortLink.href = short;
      els.resultBox.classList.remove('hidden');
      els.copyBtn.disabled = false;
      els.openBtn.disabled = false;
      addHistory({ long, short, provider: providerLabel, ts: Date.now() });
      renderTable();
    }
  }

  // Providers
  async function viaCleanURI(url){
    const res = await fetch('https://cleanuri.com/api/v1/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ url })
    });
    if(!res.ok) throw new Error('CleanURI request failed.');
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    if(!data.result_url) throw new Error('Unexpected CleanURI response.');
    return data.result_url;
  }
  async function viaShrtco(url){
    const res = await fetch('https://api.shrtco.de/v2/shorten?url=' + encodeURIComponent(url));
    if(!res.ok) throw new Error('shrtco.de request failed.');
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'shrtco.de error');
    return data.result.full_short_link;
  }
  async function viaIsGd(url){
    const res = await fetch('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url));
    if(!res.ok) throw new Error('is.gd request failed.');
    const text = await res.text();
    if(/^https?:\/\//i.test(text)) return text.trim();
    throw new Error('is.gd error: ' + text.slice(0,120));
  }

  // Local provider
  function makeSlug(raw){
    if(!raw) return randomSlug();
    if(!/^[\w-]+$/.test(raw)) return false;
    return raw;
  }
  function randomSlug(){
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for(let i=0;i<7;i++){ s += alphabet[Math.floor(Math.random()*alphabet.length)]; }
    return s;
  }
  function makeLocalShort(slug){
    const url = new URL(location.href);
    url.searchParams.set('go', slug);
    url.hash = '';
    return url.href;
  }
  function saveLocalMapping(slug, long){
    const map = JSON.parse(localStorage.getItem('shortener-map') || '{}');
    map[slug] = long;
    localStorage.setItem('shortener-map', JSON.stringify(map));
  }

  function addHistory(entry){
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    arr.unshift(entry);
    localStorage.setItem('shortener-history', JSON.stringify(arr.slice(0,500)));
    els.exportBtn.disabled = arr.length === 0;
  }

  function renderTable(){
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    if(arr.length === 0){
      els.tableWrap.textContent = 'No links yet.';
      els.exportBtn.disabled = true;
      return;
    }
    els.exportBtn.disabled = false;
    const rows = arr.map((r,i)=>{
      const d = new Date(r.ts);
      return `<tr>
        <td>${d.toLocaleString()}</td>
        <td><a href="${escapeHtml(r.long)}" target="_blank" rel="noopener">${escapeHtml(r.long)}</a></td>
        <td><a href="${escapeHtml(r.short)}" target="_blank" rel="noopener">${escapeHtml(r.short)}</a></td>
        <td><span class="badge">${escapeHtml(r.provider)}</span></td>
        <td><button class="ghost" data-idx="${i}" data-action="copy">Copy</button> <button class="ghost" data-idx="${i}" data-action="del">Delete</button></td>
      </tr>`;
    }).join('');
    els.tableWrap.innerHTML = `<div class="table-scroll"><table><thead><tr><th>Time</th><th>Original</th><th>Short</th><th>Provider</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  els.tableWrap.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;
    const idx = parseInt(btn.dataset.idx,10);
    const action = btn.dataset.action;
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    const item = arr[idx];
    if(!item) return;

    if(action === 'copy'){
      try{
        await navigator.clipboard.writeText(item.short);
        btn.textContent = 'Copied!';
        setTimeout(()=> btn.textContent = 'Copy', 1000);
      }catch{ alert('Copy failed.'); }
    }else if(action === 'del'){
      arr.splice(idx,1);
      localStorage.setItem('shortener-history', JSON.stringify(arr));
      renderTable();
    }
  });

  els.copyBtn.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(els.shortLink.href);
      els.copyBtn.textContent = 'Copied!';
      setTimeout(()=> els.copyBtn.textContent = 'Copy', 1000);
    }catch{ alert('Copy failed.'); }
  });
  els.openBtn.addEventListener('click', ()=>{
    window.open(els.shortLink.href, '_blank', 'noopener');
  });

  els.exportBtn.addEventListener('click', ()=>{
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    if(arr.length===0) return;
    const csv = 'Time,Original,Short,Provider\n' + arr.map(r => {
      const d = new Date(r.ts).toISOString();
      return `"${d}","${r.long.replace(/"/g,'""')}","${r.short.replace(/"/g,'""')}","${r.provider.replace(/"/g,'""')}"`;
    }).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'shortener-history.csv';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  });

  els.resetBtn.addEventListener('click', ()=>{
    els.longUrl.value = '';
    els.customSlug.value = '';
    els.resultBox.classList.add('hidden');
    els.copyBtn.disabled = true;
    els.openBtn.disabled = true;
    els.alert.classList.add('hidden');
    els.longUrl.focus();
  });

  els.clearBtn.addEventListener('click', ()=>{
    localStorage.removeItem('shortener-history');
    renderTable();
  });

  els.shortenBtn.addEventListener('click', shorten);
  window.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key==='Enter') shorten(); });

  function disableUI(disabled){
    els.shortenBtn.disabled = disabled;
    els.resetBtn.disabled = disabled;
  }

  function escapeHtml(s){
    return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Init
  renderTable();
  setTimeout(()=> els.longUrl.focus(), 50);
})();
