"use strict";
(() => {
  if (globalThis.__anxRadar) return; globalThis.__anxRadar = true;
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "RADAR_SNAPSHOT") return false;
    if (/Just a moment|Access denied/i.test(document.title) || document.querySelector('#challenge-running, #challenge-form, iframe[src*="challenges.cloudflare.com"]')) {
      respond({ error: "BidCars təhlükəsizlik yoxlaması tələb edir. BidCars-ı brauzerdə açın; avtomatik keçid edilmir." }); return false;
    }
    const u = new URL(location.href);
    if (/^\/en\/search\/results\/?$/.test(u.pathname)) {
      const links = [...document.querySelectorAll('a[href]')].map(a => a.href).filter(href => {
        try { const v = new URL(href); return ['bid.cars','www.bid.cars'].includes(v.hostname) && /^\/en\/lot\/[01]-\d+(?:\/[^/]+)?\/?$/.test(v.pathname); } catch { return false; }
      });
      const unique = [...new Map(links.map(href => [new URL(href).pathname.match(/\/lot\/([01]-\d+)/)[1], href])).values()].slice(0, 30);
      const empty = /No (?:vehicles|results|lots) found|0 vehicles found/i.test(document.body.innerText);
      respond({ links: unique, empty, url: location.href }); return false;
    }
    if (!/^\/en\/lot\/[01]-\d+/.test(u.pathname)) { respond({ error: "Lot səhifəsi açılmadı." }); return false; }
    const title = [...document.querySelectorAll('h1,h2')].map(h => clean(h.innerText)).find(t => /^(?:19|20)\d{2}\s+/.test(t)) || clean(document.title.split('|')[0]);
    if (!title) { respond({ pending: true }); return false; }
    const root = document.querySelector('main') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const p = walker.currentNode.parentElement;
      if (!p || p.closest('script,style,noscript,nav,header,footer,svg,template')) continue;
      parts.push(walker.currentNode.nodeValue || '');
    }
    const escape = s => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    const text = clean(parts.join(' '));
    if (text.length > 110000) { respond({ error: "Lot mətni çox böyükdür; avtomatik oxunmadı." }); return false; }
    const eventMetadata = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
      try { return `<script type="application/ld+json">${JSON.stringify(JSON.parse(s.textContent)).replace(/</g,'\\u003c')}</script>`; } catch { return ''; }
    }).join('').slice(0, 8000);
    respond({ url: location.href, html: `<h1>${escape(title)}</h1><p>${escape(text)}</p>${eventMetadata}` }); return false;
  });
})();
