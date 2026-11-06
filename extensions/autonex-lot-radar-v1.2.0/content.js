"use strict";
(() => {
  if (globalThis.__anxRadar) return; globalThis.__anxRadar = true;
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const visible = element => !!element?.getClientRects?.().length && getComputedStyle(element).visibility !== 'hidden';
  const unrelated = '[class*="history" i],[id*="history" i],[class*="related" i],[id*="related" i],[class*="recommend" i],[id*="recommend" i],[class*="similar" i],[id*="similar" i]';
  const hiddenVehicleField = parent => {
    for (let node = parent, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
      if (/^(?:BODY|HTML|MAIN)$/i.test(node.tagName || '')) break;
      const context = clean(node.textContent);
      if (context.length > 2000) break;
      if (/Buy\s*(?:it\s*)?Now|(?:Current|Final|Your|Maximum)\s*Bid|\b(?:USD|CAD|EUR|ACV)\b|[$€£]/i.test(context)) return false;
      if (/\b(?:Engine|Primary damage|Secondary damage|Sale Document|Sale doc|Odometer|Transmission|Fuel Type|Drive Type|Body Style|Key Present)\b/i.test(context)) return true;
    }
    return false;
  };
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
      const loading = [...document.querySelectorAll('[aria-busy="true"], [role="progressbar"], .spinner, .loading')].some(visible);
      const empty = !loading && /\bNo (?:vehicles|results|lots) found\b|\b0 vehicles found\b/i.test(document.body.innerText);
      respond({ links: unique, empty, pending: loading || (!unique.length && !empty), url: location.href }); return false;
    }
    if (!/^\/en\/lot\/[01]-\d+/.test(u.pathname)) { respond({ error: "Lot səhifəsi açılmadı." }); return false; }
    const title = [...document.querySelectorAll('h1,h2')].map(h => clean(h.innerText)).find(t => /^(?:19|20)\d{2}\s+/.test(t)) || clean(document.title.split('|')[0]);
    if (!/^(?:19|20)\d{2}\s+\S+\s+\S+/.test(title)) { respond({ pending: true }); return false; }
    const root = document.querySelector('main') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    while (walker.nextNode()) {
      const p = walker.currentNode.parentElement;
      // Vehicle Specs can be in an inactive/hidden tab. Keep those source
      // labels, but never mix history/recommendation details into this lot.
      if (!p || p.closest(`script,style,noscript,nav,header,footer,svg,template,${unrelated}`)) continue;
      if (!visible(p) && !hiddenVehicleField(p)) continue;
      parts.push(walker.currentNode.nodeValue || '');
    }
    const text = clean(parts.join(' '));
    const readyLabels = ['Primary damage', 'Secondary damage', 'Sale Document', 'Sale doc', 'Engine', 'Odometer', 'Transmission', 'Fuel Type'].filter(label => text.toLowerCase().includes(label.toLowerCase()));
    if (readyLabels.length < 2) { respond({ pending: true, url: location.href }); return false; }
    if (text.length > 110000) { respond({ error: "Lot mətni çox böyükdür; avtomatik oxunmadı." }); return false; }
    const eventMetadata = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
      try { return `<script type="application/ld+json">${JSON.stringify(JSON.parse(s.textContent)).replace(/</g,'\\u003c')}</script>`; } catch { return ''; }
    }).join('').slice(0, 8000);
    // Preserve only explicit visible Buy Now price labels. Never infer an asking
    // price from current/final bids, ACV, an input, or a click/action request.
    const buyLabels = [...root.querySelectorAll('button,a,span,strong,div,p,dt,dd')].filter(element => visible(element) && !element.closest(unrelated) && /^(?:Buy\s*Now|Buy\s*it\s*now)\s*:?\s*$/i.test(clean(element.innerText)));
    const priceTexts = new Set();
    for (const label of buyLabels) {
      for (const element of [label, label.parentElement]) {
        const nearby = clean(element?.innerText);
        if (nearby.length > 100 || /current\s*bid|final\s*bid|your\s*bid|maximum\s*bid|\bACV\b|\bCAD\b|\bEUR\b/i.test(nearby)) continue;
        const amounts = [...nearby.matchAll(/(?:US\$|\$)\s*(\d[\d,]*(?:\.\d{2})?)(?:\s*USD)?\b|\b(\d[\d,]*(?:\.\d{2})?)\s*USD\b/gi)];
        if (amounts.length === 1) priceTexts.add(`Buy Now: $${amounts[0][1] || amounts[0][2]} USD`);
      }
    }
    const explicitBuyNow = priceTexts.size === 1 ? `<p>${escape([...priceTexts][0])}</p>` : '';
    const html = `<h1>${escape(title)}</h1>${explicitBuyNow}<p>${escape(text)}</p>${eventMetadata}`;
    if (html.length > 120000) { respond({ error: "Lot məlumatı göndərmə limitindən böyükdür; avtomatik oxunmadı." }); return false; }
    respond({ url: location.href, html }); return false;
  });
})();
