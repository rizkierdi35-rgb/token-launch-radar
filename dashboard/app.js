// Token Radar dashboard (radar-2). Reads window.RADAR from data.js beside
// dashboard/ and renders the board, a detail view per protocol, the live
// comps that calibrate the sector multiples, and the model's method.
// No network: every byte shown is in data.js. Hash state: #detail=<slug>,
// #cat=<category>, #chain=<chain>, #q=<text>, #watch=1, #tab=board|live|method.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var rows = DATA.rows, live = DATA.live;
  var state = { q: '', cat: 'all', chain: 'all', watch: false, sort: 'implied', dir: -1, tab: 'board', sel: null };
  var watchSet = {};
  (DATA.watchlist || []).forEach(function (s) { watchSet[s] = true; });
  var $ = function (id) { return document.getElementById(id); };
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(d)) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }
  function chainOf(r) { return r.chains && r.chains.length ? r.chains[0] : '—'; }

  // ---- controls ----
  var cats = {}, chains = {};
  rows.forEach(function (r) { cats[r.category || 'Uncategorised'] = 1; (r.chains || []).forEach(function (c) { chains[c] = 1; }); });
  function fillSelect(sel, values, allLabel) {
    sel.innerHTML = '';
    sel.appendChild(new Option(allLabel, 'all'));
    Object.keys(values).sort().forEach(function (v) { sel.appendChild(new Option(v, v)); });
  }
  fillSelect($('cat'), cats, 'All categories');
  fillSelect($('chain'), chains, 'All chains');

  function readHash() {
    var h = {};
    location.hash.slice(1).split('&').forEach(function (kv) {
      var p = kv.split('='); if (p[0]) h[p[0]] = decodeURIComponent(p[1] || '');
    });
    if (h.tab) state.tab = h.tab;
    if (h.q !== undefined) state.q = h.q;
    if (h.cat) state.cat = h.cat;
    if (h.chain) state.chain = h.chain;
    if (h.watch) state.watch = h.watch === '1';
    if (h.detail) state.sel = h.detail;
  }
  function writeHash() {
    var parts = ['tab=' + state.tab];
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.cat !== 'all') parts.push('cat=' + encodeURIComponent(state.cat));
    if (state.chain !== 'all') parts.push('chain=' + encodeURIComponent(state.chain));
    if (state.watch) parts.push('watch=1');
    if (state.sel) parts.push('detail=' + encodeURIComponent(state.sel));
    history.replaceState(null, '', '#' + parts.join('&'));
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watch && !watchSet[r.slug]) return false;
      if (state.cat !== 'all' && (r.category || 'Uncategorised') !== state.cat) return false;
      if (state.chain !== 'all' && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var k = state.sort, d = state.dir;
    var val = function (r) {
      if (k === 'implied') return r.implied_value_usd;
      if (k === 'tvl') return r.tvl_usd;
      if (k === 'growth') return r.change_7d === null ? -9999 : r.change_7d;
      if (k === 'age') return r.age_days === null ? -1 : r.age_days;
      if (k === 'name') return r.name.toLowerCase();
      if (k === 'rank') return r.rank;
      return r.implied_value_usd;
    };
    out.sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -d; if (va > vb) return d;
      return a.rank - b.rank;
    });
    return out;
  }

  function renderBoard() {
    var list = filtered();
    $('count').textContent = list.length + ' of ' + rows.length + ' pre-token protocols · ' +
      DATA.watchlist_size + ' on the watchlist · snapshot ' + DATA.as_of;
    var tb = $('rows'); tb.innerHTML = '';
    list.slice(0, 200).forEach(function (r) {
      var tr = el('tr', state.sel === r.slug ? 'sel' : '');
      var g = r.change_7d;
      tr.innerHTML =
        '<td class="num">' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b>' + (watchSet[r.slug] ? '<span class="badge">watchlist</span>' : '') +
        '<br><span style="color:var(--mut);font-size:12px">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(chainOf(r)) + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + fmtPct(g) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td>';
      tr.addEventListener('click', function () { state.sel = r.slug; writeHash(); render(); });
      tb.appendChild(tr);
    });
    $('tblnote').textContent = list.length > 200
      ? 'Showing the first 200 of ' + list.length + ' matching rows — narrow the filter to see the rest.'
      : 'All matching rows shown. Click a row for its model breakdown and farm plan.';
  }

  function bar(label, value, max, text) {
    var pct = Math.max(2, Math.min(100, (value / max) * 100));
    return '<dt>' + label + '</dt><dd>' + text + '</dd></dl><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div><dl class="kv">';
  }
  function renderDetail() {
    var box = $('detail');
    var r = null;
    if (state.sel) rows.forEach(function (x) { if (x.slug === state.sel) r = x; });
    if (!r) { box.hidden = true; box.innerHTML = ''; return; }
    var m = DATA.model;
    var comps = live.filter(function (l) { return l.category === r.category; }).slice(0, 4);
    var html = '<button class="x" id="dx">Close ✕</button>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p style="color:var(--mut)">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorised') + ' · ' +
      esc(r.chains.join(', ') || 'no chain listed') + (watchSet[r.slug] ? ' · <span class="badge">watchlist</span>' : '') + '</p>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd><b>' + fmtUsd(r.implied_value_usd) + '</b></dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + fmtPct(r.change_7d) + '</dd>' +
      '<dt>Age with no token recorded</dt><dd>' + fmtAge(r.age_days) + '</dd>' +
      '<dt>Rank</dt><dd>#' + r.rank + ' of ' + rows.length + '</dd></dl>' +
      '<h3>How the value is built</h3><dl class="kv">' +
      bar('Sector multiple', r.sector_multiple, 1, '×' + r.sector_multiple.toFixed(3) + ' — median FDV/TVL of live ' + esc(r.category || 'Uncategorised') + ' protocols') +
      bar('Growth', r.growth_multiplier, 1.5, '×' + r.growth_multiplier.toFixed(3) + ' — 7d ' + fmtPct(r.change_7d) + ', clamped −50…+100%, half weight') +
      bar('Maturity', r.maturity_multiplier, 1, '×' + r.maturity_multiplier.toFixed(3) + ' — ' + fmtAge(r.age_days) + ' on record') +
      bar('Chain breadth', r.breadth_multiplier, 1.2, '×' + r.breadth_multiplier.toFixed(3) + ' — ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's')) +
      '</dl>' +
      '<p class="note">TVL ' + fmtUsd(r.tvl_usd) + ' × ' + r.sector_multiple.toFixed(3) + ' × ' +
      r.growth_multiplier.toFixed(3) + ' × ' + r.maturity_multiplier.toFixed(3) + ' × ' +
      r.breadth_multiplier.toFixed(3) + ' ≈ ' + fmtUsd(r.implied_value_usd) + '. Model ' + esc(DATA.model_version) + '.</p>' +
      '<h3>Farm plan</h3><ol class="steps">' +
      r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    if (comps.length) {
      html += '<h3>Live comps in ' + esc(r.category || 'this category') + '</h3><dl class="kv">' +
        comps.map(function (l) { return '<dt>' + esc(l.name) + '</dt><dd>' + fmtUsd(l.mcap_usd) + ' / ' + fmtUsd(l.tvl_usd) + ' = ' + l.multiple.toFixed(2) + '×</dd>'; }).join('') + '</dl>';
    }
    html += '<p class="note">“Records no token” is what the snapshot says — it is not proof the protocol has none. Verify on the protocol’s own pages before farming.</p>';
    box.innerHTML = html;
    box.hidden = false;
    $('dx').addEventListener('click', function () { state.sel = null; writeHash(); render(); });
  }

  function renderLive() {
    var tb = $('liverows'); tb.innerHTML = '';
    live.forEach(function (l) {
      var tr = el('tr');
      tr.innerHTML = '<td><b>' + esc(l.name) + '</b><br><span style="color:var(--mut);font-size:12px">' + esc(l.slug) + '</span></td>' +
        '<td>' + esc(l.category || '—') + '</td><td class="num">' + fmtUsd(l.tvl_usd) + '</td>' +
        '<td class="num">' + fmtUsd(l.mcap_usd) + '</td><td class="num">' + l.multiple.toFixed(2) + '×</td>';
      tb.appendChild(tr);
    });
  }

  function renderMethod() {
    var m = DATA.model;
    var mults = Object.keys(DATA.sector_multiples || {}).sort(function (a, b) {
      return DATA.sector_multiples[b].multiple - DATA.sector_multiples[a].multiple;
    });
    $('methodbody').innerHTML =
      '<p>Every implied value comes from the snapshot alone — TVL, 7-day change, listing date, chains and category. No protocol name is special-cased; the same function scores every row.</p>' +
      '<div class="formula"><code>implied = TVL × sector × (1 + ' + m.growth_weight + ' × clamp(7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100)<br>' +
      '&nbsp;&nbsp;× (' + m.maturity_floor + ' + ' + m.maturity_range + ' × min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + 'd)<br>' +
      '&nbsp;&nbsp;× (1 + ' + m.breadth_step + ' × min(chains − 1, 10))</code></div>' +
      '<h3>Sector multiples — median FDV/TVL of live protocols in the same category</h3>' +
      '<p>Categories with fewer than ' + m.min_live_comps + ' live comps use the overall median. Multiples are clamped to ' + m.sector_min + '–' + m.sector_max + ' so one wild comp cannot set a sector’s price.</p>' +
      '<dl class="kv">' + mults.map(function (c) {
        var v = DATA.sector_multiples[c];
        return '<dt>' + esc(c) + '</dt><dd>' + v.multiple.toFixed(3) + '× · ' + v.comps + ' comps</dd>';
      }).join('') + '</dl>' +
      '<h3>What the board does not do</h3>' +
      '<p>It does not predict whether or when a token is issued. It does not rank wrapped, staked or bridged products of tokens that already trade, exchanges, or versioned pools — those are off the board by the same rule that keeps them off the house watchlist. It does not use any data newer than the snapshot (' + esc(DATA.as_of) + ').</p>';
  }

  function renderTabs() {
    var tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === state.tab); });
    $('board').hidden = state.tab !== 'board';
    $('controls').style.display = state.tab === 'board' ? '' : 'none';
    $('live').hidden = state.tab !== 'live';
    $('method').hidden = state.tab !== 'method';
    if (state.tab === 'live') renderLive();
    if (state.tab === 'method') renderMethod();
  }

  function render() {
    renderTabs();
    if (state.tab === 'board') renderBoard();
    renderDetail();
  }

  // ---- wire up ----
  $('meta').innerHTML = '<b>' + rows.length + '</b> pre-token rows · <b>' + DATA.watchlist_size + '</b> watchlist<br>' +
    'snapshot <b>' + esc(DATA.as_of) + '</b> · floor ' + fmtUsd(DATA.floor_usd) + '<br>model <b>' + esc(DATA.model_version) + '</b>';
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); writeHash(); render(); });
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; writeHash(); renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); renderBoard(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; writeHash(); renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; writeHash(); renderBoard(); });
  document.querySelectorAll('#tbl th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (k === 'rank') k = 'implied';
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
      $('sort').value = state.sort;
      writeHash(); renderBoard();
    });
  });
  window.addEventListener('hashchange', function () { readHash(); syncControls(); render(); });
  function syncControls() {
    $('q').value = state.q; $('cat').value = state.cat; $('chain').value = state.chain;
    $('watch').checked = state.watch; $('sort').value = state.sort;
  }
  readHash(); syncControls(); render();
})();
