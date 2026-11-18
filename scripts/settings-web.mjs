// Mini web for terminal-polish settings. Started by `/mods web`:
//   node settings-web.mjs <token> <state.json>
// Reads the state the mod writes to <state.json>; a change is printed as
// `SET {json}` on stdout for the mod to apply. Listens on 127.0.0.1 only and
// answers only requests carrying the token, so other sites and users cannot drive it.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { timingSafeEqual } from 'node:crypto'

const [token, statePath] = process.argv.slice(2)
if (!token || !statePath) process.exit(2)
const IDLE_MS = 30 * 60_000

let idle
const touch = () => {
  clearTimeout(idle)
  idle = setTimeout(() => process.exit(0), IDLE_MS)
}
touch()

const sameToken = t => {
  const a = Buffer.from(String(t ?? ''))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

const send = (res, code, type, body) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-frame-options': 'DENY' })
  res.end(body)
}

const server = createServer(async (req, res) => {
  const port = server.address().port
  // DNS rebinding: a page on another name resolving here still sends its own Host.
  if (req.headers.host !== `127.0.0.1:${port}`) return send(res, 403, 'text/plain', 'forbidden')
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  const isPage = req.method === 'GET' && url.pathname === '/'
  if (!sameToken(isPage ? url.searchParams.get('t') : req.headers['x-token'])) {
    return send(res, 403, 'text/plain', 'forbidden')
  }
  touch()
  if (isPage) return send(res, 200, 'text/html; charset=utf-8', PAGE)
  if (req.method === 'GET' && url.pathname === '/api/state') {
    try {
      return send(res, 200, 'application/json', await readFile(statePath, 'utf8'))
    } catch {
      return send(res, 503, 'application/json', '{}')
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/set') {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 4096) return send(res, 413, 'text/plain', 'too large')
    }
    let change
    try {
      change = JSON.parse(body)
    } catch {
      return send(res, 400, 'text/plain', 'bad json')
    }
    if (!change || typeof change !== 'object') return send(res, 400, 'text/plain', 'bad change')
    process.stdout.write(`SET ${JSON.stringify(change)}\n`)
    return send(res, 200, 'application/json', '{"ok":true}')
  }
  send(res, 404, 'text/plain', 'not found')
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`PORT ${server.address().port}\n`)
})

const PAGE = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>terminal-polish · Cài đặt</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#fff4fb;--dot:#ffd6ec;--fg:#2a1838;--muted:#6b5578;--card:#ffffff;--ink:#2a1838;
  --gold:#ffb703;--gold-ink:#5a3a00;--track:#e9dff0;
  --L-bg:96%;--L-line:42%;--L-shadow:32%;--L-on:44%;--L-chip:88%;--S:78%;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#17112a;--dot:#251c40;--fg:#f6efff;--muted:#bcaed6;--card:#221a3a;--ink:#0d0818;
  --gold:#ffc94d;--gold-ink:#2b1c00;--track:#3a2f5a;
  --L-bg:18%;--L-line:64%;--L-shadow:8%;--L-on:62%;--L-chip:30%;--S:85%;
}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;color:var(--fg);font:500 16px/1.5 "Baloo 2",system-ui,sans-serif;
  background:var(--bg) radial-gradient(var(--dot) 2px,transparent 2.5px) 0 0/22px 22px}
.wrap{max-width:980px;margin:0 auto;padding:0 16px}
.g{--line:hsl(var(--h) var(--S) var(--L-line));--shadow:hsl(var(--h) 70% var(--L-shadow));
  --soft:hsl(var(--h) 90% var(--L-bg));--on:hsl(var(--h) var(--S) var(--L-on));--chip:hsl(var(--h) 85% var(--L-chip))}
.box{background:var(--card);border:3px solid var(--line,var(--ink));border-radius:20px;box-shadow:0 6px 0 var(--shadow,var(--ink))}
/* Header */
header{position:sticky;top:0;z-index:2;padding:14px 0 10px;background:linear-gradient(var(--bg) 80%,transparent)}
.hero{--h:330;display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;padding:14px 18px}
.hero h1{margin:0;font-size:26px;font-weight:800;line-height:1.1;display:flex;align-items:center;gap:8px}
.hero h1 svg{flex:none}
.lv{font-weight:800;font-size:15px;padding:2px 12px;border-radius:99px;background:var(--gold);color:var(--gold-ink);border:3px solid var(--ink);box-shadow:0 3px 0 var(--ink)}
.xp{flex:1;min-width:200px}
.xp small{display:flex;justify-content:space-between;color:var(--muted);font-weight:700}
.bar{height:18px;border-radius:99px;border:3px solid var(--ink);background:var(--track);overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:99px;transition:width .4s cubic-bezier(.3,1.5,.5,1);
  background:repeating-linear-gradient(-45deg,#ff5fa2 0 12px,#ff8fc0 12px 24px)}
.tools{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;align-items:center}
input[type=search],select{font:inherit;color:var(--fg);background:var(--card);border:3px solid var(--ink);border-radius:14px;padding:8px 12px;min-height:46px}
input[type=search]{flex:1;min-width:200px}
.btn{font:inherit;font-weight:800;cursor:pointer;min-height:46px;padding:6px 18px;border-radius:14px;border:3px solid var(--ink);
  color:#fff;background:var(--c);box-shadow:0 5px 0 var(--ink);transition:transform .08s,box-shadow .08s}
.btn:hover{filter:brightness(1.07)}
.btn:active{transform:translateY(4px);box-shadow:0 1px 0 var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chip{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:14px;text-decoration:none;color:var(--fg);
  padding:4px 12px;border-radius:99px;background:var(--chip);border:3px solid var(--line);box-shadow:0 3px 0 var(--shadow);min-height:36px}
.chip b{background:var(--ink);color:#fff;border-radius:99px;padding:0 7px;font-size:12px}
/* Groups */
main{padding:8px 0 60px}
section{margin-top:26px;scroll-margin-top:220px}
h2{display:inline-flex;align-items:center;gap:10px;margin:0 0 12px;font-size:20px;font-weight:800;padding:4px 16px;border-radius:14px;
  background:var(--chip);color:var(--fg);border:3px solid var(--line);box-shadow:0 4px 0 var(--shadow)}
h2 span{font-size:14px;padding:0 8px;border-radius:99px;background:var(--ink);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
label.tile{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;cursor:pointer;background:var(--soft);
  border:3px solid var(--line);border-radius:18px;box-shadow:0 5px 0 var(--shadow);transition:transform .12s}
label.tile:hover{transform:translateY(-2px)}
label.tile.off{background:var(--card)}
.txt{flex:1;min-width:0}
.key{font-weight:800;font-size:17px}
.tag{font-size:12px;margin-left:6px;padding:0 8px;border-radius:99px;background:var(--gold);color:var(--gold-ink);font-weight:800}
.desc{color:var(--muted);font-size:14px;line-height:1.4}
.sw{position:relative;flex:none;width:58px;height:32px;margin-top:2px}
.sw input{opacity:0;width:0;height:0;position:absolute}
.sw span{position:absolute;inset:0;border-radius:99px;background:var(--track);border:3px solid var(--ink);transition:background .15s}
.sw span:before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;
  border:3px solid var(--ink);transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.sw input:checked+span{background:var(--on)}
.sw input:checked+span:before{transform:translateX(26px)}
:focus-visible{outline:3px dashed var(--gold);outline-offset:3px}
.sw input:focus-visible+span{outline:3px dashed var(--gold);outline-offset:3px}
.pop{animation:pop .35s ease}
@keyframes pop{40%{transform:scale(1.04) rotate(-1deg)}}
.hidden{display:none!important}
#toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,140%);z-index:3;font-weight:800;padding:10px 20px;border-radius:16px;
  background:var(--gold);color:var(--gold-ink);border:3px solid var(--ink);box-shadow:0 5px 0 var(--ink);transition:transform .3s cubic-bezier(.3,1.5,.5,1),visibility .3s;visibility:hidden;max-width:calc(100% - 32px)}
#toast.show{transform:translate(-50%,0);visibility:visible}
@media (max-width:600px){header{position:static}.hero h1{font-size:22px}section{scroll-margin-top:12px}}
@media (prefers-reduced-motion:reduce){*,*:before{transition:none!important;animation:none!important}html{scroll-behavior:auto}}
</style>
</head>
<body>
<header><div class="wrap">
<div class="box hero g">
  <h1><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fill="#ff5fa2" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"/></svg>Cài đặt</h1>
  <span class="lv" id="lv">Lv.0</span>
  <div class="xp"><small><span>Tính năng đang bật</span><span id="count">0/0</span></small><div class="bar" role="progressbar" aria-label="Tính năng đang bật" id="bar"><i id="fill"></i></div></div>
</div>
<div class="tools">
  <input type="search" id="q" placeholder="Tìm cài đặt…" aria-label="Tìm cài đặt">
  <select id="theme" aria-label="Theme"></select>
  <button class="btn" id="all" style="--c:#16804a">Bật hết</button>
  <button class="btn" id="defaults" style="--c:#6a45f5">Mặc định</button>
</div>
<nav class="chips" id="chips" aria-label="Nhóm"></nav>
</div></header>
<main class="wrap" id="list"></main>
<div id="toast" role="status" aria-live="polite"></div>
<script>
// The token leaves the address bar but stays for a reload of this tab.
const token = new URLSearchParams(location.search).get('t') || sessionStorage.getItem('t')
try { sessionStorage.setItem('t', token) } catch {}
history.replaceState(null, '', '/')
const HUES = [205, 275, 350, 140, 28, 320, 180]
let state = null, raw = '', shape = ''
const boxes = new Map(), counts = []
const $ = id => document.getElementById(id)
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n }
let toastTimer
function say(t) {
  const n = $('toast'); n.textContent = t; n.classList.add('show')
  clearTimeout(toastTimer); toastTimer = setTimeout(() => n.classList.remove('show'), 1800)
}
async function load() {
  try {
    const r = await fetch('/api/state', { headers: { 'x-token': token } })
    if (!r.ok) throw new Error(r.status)
    const text = await r.text()
    if (text === raw) return
    raw = text; state = JSON.parse(text)
    // Only a new list of settings rebuilds the page; a toggle updates in place and keeps focus.
    const next = JSON.stringify([state.groups, state.info, state.experimental, state.themes])
    if (next !== shape) { shape = next; build() }
    refresh()
  } catch { say('Mất kết nối với Claude. Gõ /mods web để mở lại.') }
}
async function set(change, note) {
  try {
    const r = await fetch('/api/set', { method: 'POST', headers: { 'x-token': token, 'content-type': 'application/json' }, body: JSON.stringify(change) })
    say(r.ok ? note : 'Không lưu được.')
  } catch { say('Không lưu được.') }
  setTimeout(load, 300)
}
function build() {
  $('theme').replaceChildren(...state.themes.map(n => new Option('Theme: ' + n, n)))
  const list = $('list'), chips = $('chips')
  list.replaceChildren(); chips.replaceChildren(); boxes.clear(); counts.length = 0
  state.groups.forEach(([group, keys], i) => {
    if (!keys.length) return
    const hue = HUES[i % HUES.length], id = 'g' + i
    const sec = el('section', 'g'); sec.id = id; sec.style.setProperty('--h', hue)
    const n = el('span'), h = el('h2', null, group); h.append(n)
    const chip = el('a', 'chip g', group); chip.href = '#' + id; chip.style.setProperty('--h', hue)
    const b = el('b'); chip.append(b); chips.append(chip)
    counts.push({ keys, n, b })
    const grid = el('div', 'grid')
    for (const key of keys) {
      const tile = el('label', 'tile'); tile.dataset.search = (key + ' ' + state.info[key]).toLowerCase()
      const txt = el('div', 'txt'), k = el('div', 'key', key)
      if (state.experimental.includes(key)) k.append(el('span', 'tag', 'thử nghiệm'))
      txt.append(k, el('div', 'desc', state.info[key]))
      const sw = el('span', 'sw'), box = el('input'); box.type = 'checkbox'; box.setAttribute('aria-label', key)
      box.onchange = () => {
        tile.classList.toggle('off', !box.checked); tile.classList.remove('pop'); void tile.offsetWidth; tile.classList.add('pop')
        set({ key, value: box.checked }, (box.checked ? 'Đã bật ' : 'Đã tắt ') + key)
      }
      boxes.set(key, { box, tile })
      sw.append(box, el('span')); tile.append(txt, sw); grid.append(tile)
    }
    sec.append(h, grid); list.append(sec)
  })
  filter()
}
function refresh() {
  for (const [key, { box, tile }] of boxes) { const on = !!state.settings[key]; box.checked = on; tile.classList.toggle('off', !on) }
  for (const { keys, n, b } of counts) { const on = keys.filter(k => state.settings[k]).length; n.textContent = on + '/' + keys.length; b.textContent = on }
  $('theme').value = state.theme
  const all = boxes.size, on = [...boxes.keys()].filter(k => state.settings[k]).length
  $('lv').textContent = 'Lv.' + on
  $('count').textContent = on + '/' + all
  $('fill').style.width = Math.round(on / Math.max(1, all) * 100) + '%'
  $('bar').setAttribute('aria-valuenow', on); $('bar').setAttribute('aria-valuemax', all)
}
function filter() {
  const q = $('q').value.trim().toLowerCase()
  for (const sec of $('list').children) {
    let any = false
    for (const t of sec.querySelectorAll('.tile')) { const hit = !q || t.dataset.search.includes(q); t.classList.toggle('hidden', !hit); any ||= hit }
    sec.classList.toggle('hidden', !any)
  }
}
$('q').oninput = filter
$('theme').onchange = e => set({ theme: e.target.value }, 'Đã đổi theme: ' + e.target.value)
$('all').onclick = () => set({ all: true }, 'Bật hết rồi! (trừ thử nghiệm)')
$('defaults').onclick = () => set({ defaults: true }, 'Đã về mặc định.')
load()
// A hidden tab does not poll; it catches up as soon as it is shown.
setInterval(() => { if (!document.hidden) load() }, 2000)
document.addEventListener('visibilitychange', () => { if (!document.hidden) load() })
</script>
</body>
</html>`
