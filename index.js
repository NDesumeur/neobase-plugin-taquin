// Taquin : ton appli d'origine (HTML et code inchangés), livrée en plugin.
// Ses données sont dans le dossier du plugin, que NeoBase sauvegarde (synchro cloud et sauvegardes) ; à la première ouverture elle reprend ce que tu avais dans NeoBase.
// Elle tourne dans le bac à sable de NeoBase, avec ses outils d'interface (ctx.host) et seulement les autorisations de son plugin.json.
const HTML = "<div class=\"appWrap\">\n      <div class=\"agHead\"><span class=\"label\">Taquin</span><span class=\"hint\" id=\"tqInfo\"></span><div class=\"agNav\"><select class=\"f gSel\" id=\"tqSize\"><option value=\"3\">3 × 3</option><option value=\"4\" selected>4 × 4</option><option value=\"5\">5 × 5</option><option value=\"6\">6 × 6</option><option value=\"7\">7 × 7</option><option value=\"8\">8 × 8</option></select><select class=\"f gSel\" id=\"tqSrc\"><option value=\"num\">Chiffres</option><option value=\"fond\" selected>Ton fond NeoBase</option><option value=\"perso\">Ton image</option></select><button class=\"btn px\" id=\"tqPick\">CHOISIR UNE IMAGE</button><button class=\"btn px\" id=\"tqNew\">MÉLANGER</button></div></div>\n      <div class=\"tqMain\"><div id=\"tqBoard\" class=\"px\"></div><div id=\"tqPreview\" class=\"px\"></div></div>\n      <div class=\"row\"><label class=\"check\"><input type=\"checkbox\" id=\"tqNums\" checked> Numéros sur l'image</label><button class=\"btn px\" id=\"tqPeek\">Maintenir : voir le modèle</button></div>\n      <input type=\"file\" id=\"tqFile\" accept=\"image/*\" hidden>\n      <div class=\"hint\">Clique une pièce sur la ligne ou la colonne du trou pour la faire glisser, ou utilise les flèches. Ton image est gardée dans la sauvegarde.</div>\n    </div>";
/*CSS-MOVED*/ const CSS = `.gSel{width:auto;font-size:14px;padding:6px 10px;margin-right:8px}
.tqMain{display:flex;gap:24px;align-items:flex-start}
#tqBoard{--fill:var(--field);position:relative;flex:none}
.tqTile .tqNum{display:none;font:12px var(--title);color:#fff;background:rgba(5,1,11,.6);padding:4px 6px;position:absolute;left:6px;top:6px}
.tqTile.numbers .tqNum{display:block}
.tqTile.hole{transition:opacity .4s}
.shGrid td.num{text-align:right}
`;  // le style de ce plugin (il utilise les variables du thème de NeoBase)
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoBase pour s'ouvrir."; return; }
  const host = ctx.host, { el, toast, sfx, ask, newTab, pixIcon, PIX, WX } = host;
  const folder = ctx.folder, legacy = ctx.legacy || {};
  ctx.host.addStyle(CSS);
  view.innerHTML = HTML;
  const $ = id => id === "taquinApp" ? view : (view.querySelector('#' + id) || document.getElementById(id));  // les identifiants de ta vue d'abord, puis ceux de la page (fenêtres, menus)
  const doc = async n => { try { return await folder.read(n); } catch { return null; } };
  const __icon = () => ctx.icon;  // l'icône de ce plugin
  const LEGACY_GAMES = {"top":["taquin","taquinImg"],"best":"^taquin"};
  let games = await doc('games');
  if (games == null) {  // première ouverture : tu retrouves tes records et tes parties d'avant
    const old = legacy.api ? await legacy.api('games').catch(() => null) : null; games = { best: {} };
    if (old) { const re = new RegExp(LEGACY_GAMES.best); for (const [k, v] of Object.entries(old.best || {})) if (re.test(k)) games.best[k] = v; for (const k of LEGACY_GAMES.top) if (old[k] !== undefined) games[k] = old[k]; await folder.write('games', games); }
  }
  games = { best: {}, ...games };
  let gamesTimer = null;
  const saveGames = () => { clearTimeout(gamesTimer); gamesTimer = setTimeout(() => { gamesTimer = null; folder.write('games', games).catch(() => {}); }, 500); };
  const best = (k, v, higher = true) => { const b = games.best[k]; if (b == null || (higher ? v > b : v < b)) { games.best[k] = v; saveGames(); return true; } return false; };
  const gstore = (k, init) => (games[k] ??= init);  // la section d'un jeu
function gameLoop(st, appKey, update, draw) {
  cancelAnimationFrame(st.raf);
  const STEP = 1000 / 60; let acc = 0, last = performance.now();
  const frame = t => {
    if (!view.classList.contains('on')) { st.raf = 0; if (st.mode === 'play') st.mode = 'pause'; return; }  // leaving the tab pauses the game
    st.raf = requestAnimationFrame(frame);
    acc += Math.min(200, t - last); last = t;
    while (acc >= STEP) { if (st.mode === 'play') update(); st.tick++; acc -= STEP; }
    draw();
  };
  st.raf = requestAnimationFrame(frame);
}
function gameText(g, w, lines, y0) {  // centred pixel-font lines over a dark band
  g.fillStyle = 'rgba(11,3,28,.72)'; g.fillRect(0, y0 - 14, w, lines.length * 14 + 14);
  g.textAlign = 'center';
  lines.forEach(([text, color, size], i) => { g.fillStyle = color; g.font = (size || 8) + 'px "Press Start 2P", monospace'; g.fillText(text, w / 2, y0 + i * 14); });
  g.textAlign = 'left';
}
const px = (g, color, x, y, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
function sprite(g, rows, x, y, pal) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) px(g, c, x + i, y + j); } }); }
  // ---- ton code d'origine ----
const anyOf = a => a[Math.floor(Math.random() * a.length)];
const shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* ---------- Taquin: slide the tiles back in order; numbers, the current NeoBase sky, or your own image (kept in the save) ---------- */
let tq = null, tqSky = null;
const tqSkyNow = () => ctx.host.sky ? ctx.host.sky().then(u => { tqSky = u; }).catch(() => {}) : Promise.resolve();
function tqImage() {
  const src = $('tqSrc').value;
  if (src === 'perso') return games.taquinImg || null;
  if (src === 'fond') return tqSky;  // a square cut from the two sky layers, as on screen (given by NeoBase, refreshed at each opening)
  return null;
}
function tqNew() {
  const n = +$('tqSize').value, tiles = [...Array(n * n).keys()];  // tiles[pos] = tile number, n*n-1 = the hole
  let hole = n * n - 1, prev = -1;
  for (let k = 0; k < 120 * n * n; k++) {  // random legal moves from the solved grid: always solvable
    const opts = [hole - n, hole + n, hole % n ? hole - 1 : -1, hole % n < n - 1 ? hole + 1 : -1].filter(p => p >= 0 && p < n * n && p !== prev);
    const p = anyOf(opts); [tiles[hole], tiles[p]] = [tiles[p], tiles[hole]]; prev = hole; hole = p;
  }
  if (tiles.every((t, i) => t === i)) return tqNew();
  tq = {n, tiles, moves: 0, t0: 0, secs: 0, done: false, img: tqImage()};
  $('taquinApp').classList.toggle('perso', $('tqSrc').value === 'perso');  // your own picture keeps its colours; NeoBase's decor follows the theme
  $('tqBoard').replaceChildren();
  if ($('tqSrc').value === 'perso' && !tq.img) toast('Choisis d\'abord une image');
  tqRender();
}
function tqMove(pos) {
  if (!tq || tq.done) return;
  const n = tq.n, hole = tq.tiles.indexOf(n * n - 1), hr = Math.floor(hole / n), hc = hole % n, r = Math.floor(pos / n), c = pos % n;
  if (pos === hole || (r !== hr && c !== hc)) return;
  const step = r === hr ? Math.sign(c - hc) : Math.sign(r - hr) * n;  // slides the whole line between the tile and the hole
  for (let p = hole; p !== pos; p += step) { [tq.tiles[p], tq.tiles[p + step]] = [tq.tiles[p + step], tq.tiles[p]]; tq.moves++; }
  if (!tq.t0) tq.t0 = Date.now();
  sfx('click');
  if (tq.tiles.every((t, i) => t === i)) {
    tq.done = true; tq.secs = Math.round((Date.now() - tq.t0) / 1000);
    const st = gstore('taquin', {done: 0}); st.done++;
    const rec = best('taquin' + n, tq.moves, false); best('taquinT' + n, tq.secs, false); saveGames(); sfx('launch');
    if (rec) toast('Nouveau record : ' + tq.moves + ' coups');
  }
  tqRender();
}
function tqRender() {
  const n = tq.n, size = Math.min(560, innerHeight - 270, ($('taquinApp').clientWidth || 900) - 80), cell = size / n, box = $('tqBoard');
  box.style.width = box.style.height = size + 'px';
  if (box.children.length !== n * n) box.replaceChildren(...Array.from({length: n * n}, (_, t) => {
    const d = el('div', 'tqTile' + (t === n * n - 1 ? ' hole' : '')); d.dataset.t = t;
    if (tq.img) { d.style.backgroundImage = `url(${tq.img})`; d.style.backgroundSize = `${n * 100}% ${n * 100}%`; d.style.backgroundPosition = `${t % n / (n - 1) * 100}% ${Math.floor(t / n) / (n - 1) * 100}%`; d.append(el('span', 'tqNum', String(t + 1))); }
    else d.append(el('b', '', String(t + 1)));
    d.onclick = () => tqMove(tq.tiles.indexOf(t));
    return d;
  }));
  for (const d of box.children) {
    const t = +d.dataset.t, p = tq.tiles.indexOf(t);
    Object.assign(d.style, {width: cell + 'px', height: cell + 'px', transform: `translate(${p % n * cell}px, ${Math.floor(p / n) * cell}px)`, fontSize: cell * .35 + 'px'});
    d.classList.toggle('ok', p === t); d.classList.toggle('numbers', $('tqNums').checked);
    if (t === n * n - 1) d.style.opacity = tq.done ? 1 : 0;
  }
  const rec = games.best['taquin' + n], secs = tq.done ? tq.secs : tq.t0 ? Math.round((Date.now() - tq.t0) / 1000) : 0;
  $('tqInfo').textContent = (tq.done ? 'Résolu ! ' : '') + tq.moves + ' coups · ' + clock(secs) + ' · record ' + (rec ? rec + ' coups' : '—');
}
setInterval(() => { if (tq?.t0 && !tq.done && view.classList.contains('on')) tqRender(); }, 1000);
$('tqNew').onclick = tqNew;
$('tqSize').onchange = $('tqSrc').onchange = () => { if ($('tqSrc').value === 'perso' && !games.taquinImg) return $('tqFile').click(); tqNew(); };
$('tqNums').onchange = () => tqRender();
$('tqPick').onclick = () => $('tqFile').click();
$('tqFile').onchange = e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const img = new Image();
  img.onload = () => {  // centred square, 480 px: small enough for the synced save
    const c = document.createElement('canvas'), s = Math.min(img.width, img.height); c.width = c.height = 480;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 480, 480);
    games.taquinImg = c.toDataURL('image/jpeg', .85); saveGames(); URL.revokeObjectURL(img.src);
    $('tqSrc').value = 'perso'; tqNew();
  };
  img.onerror = () => toast('Image illisible', true);
  img.src = URL.createObjectURL(f);
};
$('tqPeek').onpointerdown = () => { if (tq?.img) $('tqPreview').style.backgroundImage = `url(${tq.img})`; $('tqPreview').classList.add('on'); };
$('tqPeek').onpointerup = $('tqPeek').onpointerleave = () => $('tqPreview').classList.remove('on');
document.addEventListener('keydown', e => {
  if (!view.classList.contains('on') || !tq || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const n = tq.n, hole = tq.tiles.indexOf(n * n - 1), d = {ArrowUp: n, ArrowDown: -n, ArrowLeft: 1, ArrowRight: -1}[e.key];  // the arrow pushes the tile next to the hole into it
  if (d == null) return; e.preventDefault();
  const p = hole + d; if (p < 0 || p >= n * n || (Math.abs(d) === 1 && Math.floor(p / n) !== Math.floor(hole / n))) return;
  tqMove(p);
});  // (non indenté : les textes sur plusieurs lignes restent exactement les tiens)
  // ---- fin ----
  ctx.onOpen(() => tqSkyNow().then(() => { tq ? tqRender() : tqNew(); }));
}
