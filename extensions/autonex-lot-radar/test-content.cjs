"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');
const lotUrl = 'https://bid.cars/en/lot/1-12345678/2021-Toyota-Camry';

function element(innerText, options = {}) {
  return { innerText, textContent: innerText, parentElement: options.parent,
    getClientRects: () => options.hidden ? [] : [{}],
    closest: selectors => options.unrelated && /history|related|recommend|similar/.test(selectors) ? {} : options.hidden && selectors.includes('[hidden]') ? {} : null,
  };
}
function snapshot({ texts = [], prices = [], title = '2021 Toyota Camry', search = false, links = [], empty = false, loading = false, metadata = [] } = {}) {
  let listener;
  const nodes = texts.map(item => ({ nodeValue: typeof item === 'string' ? item : item.text, parentElement: element(typeof item === 'string' ? item : item.text, typeof item === 'string' ? {} : item) }));
  const root = { querySelectorAll: () => prices };
  const document = {
    title: search ? 'Search results' : `${title} | BidCars`,
    body: { innerText: empty ? 'No vehicles found' : texts.map(t => typeof t === 'string' ? t : t.text).join(' ') },
    querySelector: selector => selector === 'main' ? root : null,
    querySelectorAll: selector => selector === 'h1,h2' ? [element(title)] : selector === 'a[href]' ? links.map(href => ({ href })) : selector.includes('application/ld+json') ? metadata.map(value => ({ textContent: JSON.stringify(value) })) : selector.includes('progressbar') && loading ? [element('Loading')] : [],
    createTreeWalker: () => { let index = 0; return { currentNode: null, nextNode() { if (index >= nodes.length) return false; this.currentNode = nodes[index++]; return true; } }; },
  };
  const context = vm.createContext({ URL, document, location: { href: search ? 'https://bid.cars/en/search/results' : lotUrl }, NodeFilter: { SHOW_TEXT: 4 }, getComputedStyle: () => ({ visibility: 'visible' }), chrome: { runtime: { id: 'radar', onMessage: { addListener: callback => { listener = callback; } } } } });
  vm.runInContext(source, context);
  let result;
  listener({ type: 'RADAR_SNAPSHOT' }, { id: 'radar' }, value => { result = value; });
  return result;
}

test('hidden current-vehicle Specs remain available while history and related text is omitted', () => {
  const result = snapshot({ texts: [
    { text: 'Engine 2.5L I4 Primary damage Right front Sale Document Salvage certificate', hidden: true },
    { text: 'Engine 5.7L Primary damage Fire Buy Now $1,000 USD', unrelated: true },
  ] });
  assert.match(result.html, /Engine 2\.5L I4/);
  assert.doesNotMatch(result.html, /5\.7L|1,000|Fire/);
});

test('explicit visible Buy Now amount is before nav/history words and safely escaped', () => {
  const parent = element('Buy Now $4,500 USD');
  const result = snapshot({ texts: ['Sales History', 'Engine 2.5L Primary damage Right front', 'A & B < C'], prices: [element('Buy Now', { parent })] });
  assert.ok(result.html.indexOf('Buy Now: $4,500 USD') < result.html.indexOf('Sales History'));
  assert.match(result.html, /A &amp; B &lt; C/);
});

test('hidden or historical Buy Now labels cannot become a synthesized asking price', () => {
  const parent = element('Buy Now $1,000 USD');
  const result = snapshot({ texts: ['Engine 2.5L Primary damage Front'], prices: [element('Buy Now', { parent, hidden: true }), element('Buy Now', { parent, unrelated: true })] });
  assert.doesNotMatch(result.html, /Buy Now:|1,000/);
});

test('hidden bid/price modals are not flattened while hidden vehicle fields remain', () => {
  const result = snapshot({ texts: [{ text: 'Engine 2.5L Primary damage Front', hidden: true }, { text: 'Buy Now $1,200 USD', hidden: true }, { text: '$1,200 USD', hidden: true }] });
  assert.match(result.html, /2\.5L/); assert.doesNotMatch(result.html, /1,200|Buy Now/);
});

test('a neighboring current bid is not inferred as Buy Now price', () => {
  const result = snapshot({ texts: ['Engine 2.5L Primary damage Front'], prices: [element('Buy Now', { parent: element('Current Bid $1,200 Buy Now') })] });
  assert.doesNotMatch(result.html, /Buy Now:/);
});

test('partial lot metadata and JS-only empty search shells remain pending', () => {
  assert.equal(snapshot({ texts: ['Engine 2.5L'] }).pending, true);
  assert.equal(snapshot({ search: true }).pending, true);
  const explicitEmpty = snapshot({ search: true, empty: true });
  assert.equal(explicitEmpty.empty, true); assert.equal(explicitEmpty.pending, false);
  const loadingEmpty = snapshot({ search: true, empty: true, loading: true });
  assert.equal(loadingEmpty.pending, true); assert.equal(loadingEmpty.empty, false);
});

test('structured metadata is inert JSON and cannot break out into HTML', () => {
  const result = snapshot({ texts: ['Engine 2.5L Primary damage Front'], metadata: [{ '@type': 'Event', url: lotUrl, startDate: '2026-12-01T15:30:00Z', name: '</script><img src=x>' }] });
  assert.match(result.html, /application\/ld\+json/);
  assert.doesNotMatch(result.html, /<img/);
  assert.match(result.html, /\\u003c/);
});
