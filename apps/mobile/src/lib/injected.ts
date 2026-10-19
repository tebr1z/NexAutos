export const READ_BIDCARS_PAGE = String.raw`
(function () {
  try {
    const text = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
    const money = (labels) => {
      for (const label of labels) {
        const index = text.toLowerCase().indexOf(label.toLowerCase());
        if (index < 0) continue;
        const hit = text.slice(index + label.length, index + label.length + 100).match(/\$\s*[\d,.]+|[\d,.]+\s*USD/i);
        if (hit) { const value = Number(hit[0].replace(/USD|\$|\s/gi, '').replace(/,/g, '')); if (value > 0) return value; }
      }
      return null;
    };
    const yard = text.match(/Location\s*:?\s*([^|]{2,80}?)\s*(?:Shipping from|Distance|Odległość|Estimated cost)/i)?.[1]?.trim() || '';
    const state = yard.match(/\(([A-Z]{2})\)/)?.[1] || yard.match(/,\s*([A-Z]{2})\b/)?.[1] || '';
    const title = document.querySelector('h1')?.textContent?.trim() || document.title;
    const auction = /\bCOPART\b/i.test(title + ' ' + text.slice(0, 1800)) ? 'COPART' : /\bIAA(?:I)?\b/i.test(title + ' ' + text.slice(0, 1800)) ? 'IAAI' : '';
    const payload = { type: 'lot', url: window.location.href, title, priceUsd: money(['Final bid', 'Current Bid', 'Lot Price']), auctionFeeUsd: money(['Auction Fees', 'Auction Fee']), location: yard, state, auction, titleKind: /\bclean title\b/i.test(text) ? 'CLEAN' : 'SALVAGE' };
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  } catch (error) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: String(error) })); }
})(); true;`;
