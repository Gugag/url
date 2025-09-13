// TinyURL-only URL shortener (single provider)
// Keeps the same UI ids as your previous version: #longUrl, #shortenBtn, #resetBtn,
// #alert, #result, #shortLink, #copyBtn, #openBtn, #exportBtn, #clearBtn, #tableWrap, #themeToggle

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const els = {
    input: $("#longUrl"),
    shortenBtn: $("#shortenBtn"),
    resetBtn: $("#resetBtn"),
    alert: $("#alert"),
    resultBox: $("#result"),
    shortLink: $("#shortLink"),
    copyBtn: $("#copyBtn"),
    openBtn: $("#openBtn"),
    exportBtn: $("#exportBtn"),
    clearBtn: $("#clearBtn"),
    tableWrap: $("#tableWrap"),
    themeToggle: $("#themeToggle"),
  };

  // Theme toggle (preserve previous behavior; store in localStorage)
  const THEME_KEY = "urlshort_theme";
  function applyTheme(mode) {
    if (mode === "light") document.documentElement.classList.add("light");
    else document.documentElement.classList.remove("light");
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    els.themeToggle.textContent = document.documentElement.classList.contains("light") ? "🌞" : "🌙";
  }
  try {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === "light" ? "light" : "dark");
  } catch { applyTheme("dark"); }
  els.themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
  });

  // History
  const HIST_KEY = "urlshort_history";
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveHistory(hist) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(hist)); } catch {}
  }
  function renderHistory() {
    const hist = loadHistory();
    els.exportBtn.disabled = hist.length === 0;
    const lines = hist.map(h => `
      <tr>
        <td>${h.date}</td>
        <td><span class="badge ok">TinyURL</span></td>
        <td><a href="${h.long}" target="_blank" rel="noopener">${h.long}</a></td>
        <td><a href="${h.short}" target="_blank" rel="noopener">${h.short}</a></td>
      </tr>`).join("");
    els.tableWrap.innerHTML = hist.length
      ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Provider</th><th>Long URL</th><th>Short URL</th></tr></thead><tbody>${lines}</tbody></table></div>`
      : `No links yet.`;
  }

  function csvEscape(s){ return '"' + String(s).replace(/"/g,'""') + '"'; }
  function exportCSV() {
    const hist = loadHistory();
    if (!hist.length) return;
    const header = "Date,Provider,Long URL,Short URL";
    const rows = hist.map(h => [h.date, "TinyURL", h.long, h.short].map(csvEscape).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "url-history.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
  }

  // Alerts / UI helpers
  function showAlert(msg, kind="warn") {
    els.alert.textContent = msg;
    els.alert.classList.remove("hidden");
    els.alert.style.borderColor = kind === "err" ? "var(--err)" : (kind === "ok" ? "var(--ok)" : "var(--warn)");
  }
  function hideAlert() { els.alert.classList.add("hidden"); }

  function showResult(shortUrl) {
    els.resultBox.classList.remove("hidden");
    els.shortLink.textContent = shortUrl;
    els.shortLink.href = shortUrl;
    els.copyBtn.disabled = false;
    els.openBtn.disabled = false;
  }
  function resetUI() {
    hideAlert();
    els.resultBox.classList.add("hidden");
    els.shortLink.textContent = "—";
    els.shortLink.href = "#";
    els.copyBtn.disabled = true;
    els.openBtn.disabled = true;
  }

  function normalizeUrl(u) {
    try {
      const tmp = new URL(u, window.location.origin);
      // Ensure http/https only
      if (!/^https?:$/i.test(tmp.protocol)) throw new Error("Only http/https are allowed.");
      return tmp.href;
    } catch {
      return "";
    }
  }

  async function tinyurlShorten(longUrl) {
    // TinyURL classic API: returns plain text short URL
    const api = "https://tinyurl.com/api-create.php?url=" + encodeURIComponent(longUrl);
    const res = await fetch(api);
    if (!res.ok) throw new Error("TinyURL HTTP " + res.status);
    const text = (await res.text()).trim();
    if (!/^https?:\/\/\S+$/i.test(text)) throw new Error("TinyURL returned invalid response");
    return text;
  }

  async function onShorten() {
    resetUI();
    const longRaw = els.input?.value?.trim() || "";
    const longUrl = normalizeUrl(longRaw);
    if (!longUrl) {
      showAlert("Please enter a valid URL (include https://).", "err");
      els.input?.focus();
      return;
    }

    const origLabel = els.shortenBtn?.textContent;
    if (els.shortenBtn) { els.shortenBtn.disabled = true; els.shortenBtn.textContent = "Working…"; }
    showAlert("Contacting TinyURL…");

    try {
      const short = await tinyurlShorten(longUrl);
      hideAlert();
      showResult(short);
      // Save to history
      const hist = loadHistory();
      const date = new Date().toLocaleString();
      hist.unshift({ date, provider: "tinyurl", long: longUrl, short });
      // Keep last 200
      saveHistory(hist.slice(0, 200));
      renderHistory();
    } catch (err) {
      showAlert(String(err && err.message || err), "err");
    } finally {
      if (els.shortenBtn) { els.shortenBtn.disabled = false; els.shortenBtn.textContent = origLabel || "Shorten"; }
    }
  }

  function onReset() {
    resetUI();
    if (els.input) els.input.value = "";
    els.input?.focus();
  }

  // Wire events
  els.shortenBtn?.addEventListener("click", onShorten);
  els.resetBtn?.addEventListener("click", onReset);
  els.copyBtn?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(els.shortLink.href); els.copyBtn.textContent = "Copied!"; setTimeout(()=>els.copyBtn.textContent="Copy", 1200); } catch {}
  });
  els.openBtn?.addEventListener("click", () => { if (els.shortLink.href && els.shortLink.href !== "#") window.open(els.shortLink.href, "_blank", "noopener"); });
  els.exportBtn?.addEventListener("click", exportCSV);
  els.clearBtn?.addEventListener("click", clearHistory);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") onShorten();
  });

  // Initial paint
  renderHistory();
  resetUI();
  // Focus input on load
  setTimeout(()=>els.input?.focus(), 50);
})();
