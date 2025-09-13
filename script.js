// URL Shortener with proxy support for third‑party providers (CleanURI, shrtco.de, is.gd)
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
    exportBtn: $('#exportBtn'),
    clearBtn: $('#clearBtn')
  };

  // ====== SET THIS TO YOUR CLOUDFLARE WORKER URL ======
  // Example: https://your-subdomain.workers.dev OR https://url.itdata.ge/api/shorten (if you routed a path to the Worker)
  const PROXY_BASE = (window.PROXY_BASE || '').trim(); // you can also set window.PROXY_BASE before this script tag

  // Theme
  const savedTheme = localStorage.getItem('shortener-theme');
  if(savedTheme === 'light') document.documentElement.classList.add('light');
  els.themeToggle?.addEventListener('click', ()=>{
    const light = document.documentElement.classList.toggle('light');
    localStorage.setItem('shortener-theme', light ? 'light' : 'dark');
    els.themeToggle.textContent = light ? '🌙' : '🌞';
  });

  // Provider UI
  els.provider?.addEventListener('change', ()=>{
    els.slugWrap.hidden = els.provider.value !== 'local';
  });

  // Result btns
  els.resetBtn?.addEventListener('click', ()=>{
    els.longUrl.value = '';
    els.resultBox.classList.add('hidden');
    els.copyBtn.disabled = true;
    els.openBtn.disabled = true;
    els.longUrl.focus();
  });

  // Local redirect if slug present
  (function handleLocalGoParam(){
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
      if(!/^([a-z]+:)?\/\//i.test(u)) u = 'https://' + u;
      const url = new URL(u);
      return url.href;
    }catch{ return null; }
  }

  function showAlert(msg, kind='warn'){
    els.alert.textContent = msg;
    els.alert.classList.remove('hidden');
    els.alert.className = 'alert';
    if(kind==='warn') els.alert.classList.add('warn');
    if(kind==='err') els.alert.classList.add('err');
    setTimeout(()=> els.alert.classList.add('hidden'), 4000);
  }

  async function shorten(){
    const raw = (els.longUrl.value||'').trim();
    const long = normalizeUrl(raw);
    if(!long) return showAlert('Please paste a valid URL (hint: we will auto‑add https:// if missing).');
    const provider = els.provider.value;

    // Guard: external providers require a proxy to avoid CORS
    if(provider !== 'local' && !PROXY_BASE){
      return showAlert('External provider blocked by CORS. Set PROXY_BASE to your Cloudflare Worker URL (see instructions) or switch Provider to "Local".', 'err');
    }

    disableUI(true);
    let short = null, providerLabel = '';
    try{
      if(provider === 'local'){
        const slug = makeSlug(els.customSlug.value.trim()) || makeAutoSlug();
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
      const msg = (e && e.message) ? e.message : 'Shortening failed.';
      showAlert(msg.includes('CORS') ? 'Provider blocked by CORS. Configure the proxy.' : msg, 'err');
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

  // ===== Providers via proxy =====
  async function viaCleanURI(url){
    const res = await fetch(`${PROXY_BASE.replace(/\/$/,'')}/cleanuri`, {
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
    const res = await fetch(`${PROXY_BASE.replace(/\/$/,'')}/shrtco?url=` + encodeURIComponent(url));
    if(!res.ok) throw new Error('shrtco.de request failed.');
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'shrtco.de error');
    return data.result.full_short_link;
  }

  async function viaIsGd(url){
    const res = await fetch(`${PROXY_BASE.replace(/\/$/,'')}/isgd?url=` + encodeURIComponent(url));
    if(!res.ok) throw new Error('is.gd request failed.');
    const text = await res.text();
    if(/^https?:\/\//i.test(text)) return text.trim();
    throw new Error('is.gd error: ' + text.slice(0,120));
  }

  // ===== Local provider =====
  function makeSlug(raw){
    if(!raw) return '';
    const s = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g,'-').replace(/^-|-$/g,'');
    return s.slice(0,48);
  }
  function makeAutoSlug(){
    return Math.random().toString(36).slice(2,8) + '-' + Date.now().toString(36).slice(-4);
  }
  function makeLocalShort(slug){ return location.origin + location.pathname + '?go=' + encodeURIComponent(slug); }
  function saveLocalMapping(slug, long){
    const map = JSON.parse(localStorage.getItem('shortener-map') || '{}');
    map[slug] = long; localStorage.setItem('shortener-map', JSON.stringify(map));
  }

  // History
  function addHistory(item){
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    arr.unshift(item);
    localStorage.setItem('shortener-history', JSON.stringify(arr.slice(0,200)));
  }
  function renderTable(){
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    if(arr.length===0){ els.tableWrap.innerHTML = 'No links yet.'; els.exportBtn.disabled = true; return; }
    els.exportBtn.disabled = false;
    const rows = arr.map((r,i)=>{
      const d = new Date(r.ts);
      return `<tr data-idx="${i}">
        <td>${d.toLocaleString()}</td>
        <td><a href="${escapeHtml(r.long)}" target="_blank" rel="noopener">${escapeHtml(r.long)}</a></td>
        <td><a href="${escapeHtml(r.short)}" target="_blank" rel="noopener">${escapeHtml(r.short)}</a></td>
        <td><span class="badge">${escapeHtml(r.provider)}</span></td>
        <td class="hstack"><button data-action="copy" class="ghost">Copy</button><button data-action="open" class="ghost">Open</button><button data-action="del" class="ghost">Delete</button></td>
      </tr>`;
    }).join('');
    els.tableWrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Original</th><th>Short</th><th>Provider</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  els.tableWrap?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const tr = btn.closest('tr'); if(!tr) return;
    const idx = +tr.dataset.idx;
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    const item = arr[idx]; if(!item) return;
    const action = btn.dataset.action;
    if(action === 'open'){
      window.open(item.short, '_blank', 'noopener');
    }else if(action === 'copy'){
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

  els.copyBtn?.addEventListener('click', async ()=>{
    try{
      await navigator.clipboard.writeText(els.shortLink.href);
      els.copyBtn.textContent = 'Copied!';
      setTimeout(()=> els.copyBtn.textContent = 'Copy', 1000);
    }catch{ alert('Copy failed.'); }
  });
  els.openBtn?.addEventListener('click', ()=>{
    window.open(els.shortLink.href, '_blank', 'noopener');
  });

  els.exportBtn?.addEventListener('click', ()=>{
    const arr = JSON.parse(localStorage.getItem('shortener-history') || '[]');
    if(arr.length===0) return;
    const csv = 'Time,Original,Short,Provider\\n' + arr.map(r => {
      const d = new Date(r.ts).toISOString();
      return `"${d}","${r.long.replace(/"/g,'""')}","${r.short.replace(/"/g,'""')}","${r.provider.replace(/"/g,'""')}"`;
    }).join('\\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'shortener-history.csv'; a.click();
    URL.revokeObjectURL(a.href);
  });
  els.clearBtn?.addEventListener('click', ()=>{
    if(confirm('Clear local history?')){ localStorage.removeItem('shortener-history'); renderTable(); }
  });

  els.shortenBtn?.addEventListener('click', shorten);
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
  setTimeout(()=> els.longUrl?.focus(), 50);
})();
