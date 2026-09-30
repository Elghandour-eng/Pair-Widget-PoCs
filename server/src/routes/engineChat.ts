import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import { ulid } from 'ulid'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'
import { MENU_ITEMS } from './cinescapeMenu.js'

/**
 * Agent-engine chat: an isolated demo surface that connects a widget experience
 * straight to the local agent-engine (Dify-compatible SSE) without touching the
 * Pair proxy, the SDK build, or any registered widget.
 *
 *   GET  /api/public/engine/widget/:widgetId/cine       — interactive chat page
 *   POST /api/public/engine/widget/:widgetId/cine/chat  — SSE pass-through to agent-engine
 *
 * The page renders the envelope `components` contract (suggestions, questions,
 * location cards, location requests) and streams text token by token.
 */
export const engineChatRouter = Router()

const ENGINE_URL = (process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:8095').replace(/\/$/, '')
const ENGINE_AGENT = process.env.AGENT_ENGINE_AGENT || 'cinescape'
// Pair Danah Orchestrator: an application key (app-…) authenticates the widget server and selects the agent.
// Without it the legacy X-Agent-Id header is sent (the old agent-engine accepted anonymous calls).
const ENGINE_KEY = process.env.AGENT_ENGINE_KEY || ''
const engineHeaders = (json = true): Record<string, string> => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  ...(ENGINE_KEY ? { Authorization: `Bearer ${ENGINE_KEY}` } : { 'X-Agent-Id': ENGINE_AGENT }),
})

/**
 * Component hydration: the model emits tiny references (a cinema id, a price preset) and the
 * proxy expands them into full card data here. Keeps replies fast and cheap — the model never
 * spends tokens copying static data — and card contents can never drift from the source.
 */
const CINEMA_DATA: Record<string, Record<string, unknown>> = {
  '1': { id: '1', name: 'Cinescape 360', name_ar: 'سينسكيب 360', address: '360 Mall, Zahra (South Surra)', address_ar: 'مول 360، الزهراء', hours: '11 AM - 4 AM', lat: 29.267396766357216, lng: 47.99196210604129, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000001.jpg?v=169', maps_url: 'https://maps.google.com/?q=29.267396766357216,47.99196210604129', experiences: ['STANDARD', 'VIP', '4DX', 'DOLBY'] },
  '8': { id: '8', name: 'Cinescape Avenues', name_ar: 'سينسكيب الأفنيوز', address: 'The Avenues Mall (Phase 1), Al-Rai', address_ar: 'مول الأفنيوز، الري', hours: '11 AM - 2 AM', lat: 29.30258, lng: 47.92927, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000008.jpg?v=741', maps_url: 'https://maps.google.com/?q=29.30258,47.92927', experiences: ['STANDARD', 'VIP', '4DX', 'DOLBY', 'SCREENX'] },
  '5': { id: '5', name: 'Cinescape Al Kout', name_ar: 'سينسكيب الكوت', address: 'Al Kout Mall, Fahaheel', address_ar: 'الكوت مول، الفحيحيل', hours: '11 AM - 4 AM', lat: 29.07798, lng: 48.13963, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000005.jpg', maps_url: 'https://maps.google.com/?q=29.07798,48.13963', experiences: ['STANDARD', 'IMAX', '4DX', 'ELEVEN'] },
  '13': { id: '13', name: 'Cinescape Assima', name_ar: 'سينسكيب العاصمة', address: 'Assima Mall, Mirqab (Kuwait City)', address_ar: 'مول العاصمة، المرقاب', hours: '11 AM - 3 AM', lat: 29.373813616320145, lng: 47.98789268449745, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000013.jpg?v=646', maps_url: 'https://maps.google.com/?q=29.373813616320145,47.98789268449745', experiences: ['STANDARD', 'VIP', '4DX', '4DXSCREEN', '3D', 'DOLBY', 'SKYLINE'] },
  '14': { id: '14', name: 'Cinescape Khiran', name_ar: 'سينسكيب الخيران', address: 'Al Khiran Outlet Mall, Sabah Al Ahmed Sea City', address_ar: 'مول الخيران، مدينة صباح الأحمد البحرية', hours: '11 AM - 2 AM', lat: 28.67086, lng: 48.34639, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000014.jpg?v=867', maps_url: 'https://maps.google.com/?q=28.67086,48.34639', experiences: ['STANDARD', 'VIP'] },
  '15': { id: '15', name: 'Cinescape Warehouse', name_ar: 'سينسكيب ذا ويرهاوس', address: 'The Warehouse Mall, South Sabahiya', address_ar: 'مول ذا ويرهاوس، جنوب الصباحية', hours: '11 AM - 3 AM', lat: 29.0859, lng: 48.1032, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000015.jpg?v=103', maps_url: 'https://maps.google.com/?q=29.0859,48.1032', experiences: ['STANDARD'] },
  '3': { id: '3', name: 'Cinescape Al Bairaq', name_ar: 'سينسكيب البيرق', address: 'Al Bairaq Mall, Eqaila', address_ar: 'البيرق مول، العقيلة', hours: '12 PM - 2 AM', lat: 29.17358, lng: 48.09881, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000003.jpg?v=238', maps_url: 'https://maps.google.com/?q=29.17358,48.09881', experiences: ['STANDARD'] },
  '2': { id: '2', name: 'Cinescape Ajial', name_ar: 'سينسكيب أجيال', address: 'Ajial Mall, Fahaheel', address_ar: 'أجيال مول، الفحيحيل', hours: '3:30 PM - 2 AM', lat: 29.08288, lng: 48.13633, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000002.jpg?v=046', maps_url: 'https://maps.google.com/?q=29.08288,48.13633', experiences: ['STANDARD'] },
  '12': { id: '12', name: '1954 Film House', name_ar: 'بيت الأفلام 1954', address: 'Souq Al Kout (Seaside), Fahaheel', address_ar: 'سوق الكوت القديم (الواجهة البحرية)، الفحيحيل', hours: '12 PM - 3 AM', lat: 29.08078, lng: 48.14085, image: 'https://cdn.cinescape.com.kw/cinema/web_big/0000000012.jpg?v=800', maps_url: 'https://maps.google.com/?q=29.08078,48.14085', experiences: ['STANDARD'] },
}
const PRICE_ITEMS = [
  { label: 'عادي 2D/3D', label_en: 'Standard 2D/3D', price: '3.500' },
  { label: 'ستاندرد بريميوم', label_en: 'Standard Premium', price: '4.000' },
  { label: 'VIP', label_en: 'VIP', price: '8.000' },
  { label: '4DX', label_en: '4DX', price: '8.000' },
  { label: '4DX Screen', label_en: '4DX Screen', price: '8.000' },
  { label: 'IMAX عادي', label_en: 'IMAX Regular', price: '4.000' },
  { label: 'IMAX بريميوم', label_en: 'IMAX Premium', price: '4.500' },
  { label: 'ScreenX', label_en: 'ScreenX', price: '4.500' },
  { label: 'دولبي', label_en: 'Dolby Cinema', price: '4.500' },
  { label: 'ELEVEN', label_en: 'ELEVEN', price: '3.500' },
  { label: 'Skyline', label_en: 'Skyline', price: '5.000' },
  { label: 'بيت الأفلام 1954 (ديلوكس)', label_en: '1954 Film House (Deluxe)', price: '6.000' },
]

/** Every experience with its cinemas and price, in both languages — hydrated from `{"template":"experiences_list","data":{}}`. */
const EXPERIENCE_ITEMS = [
  { name: 'IMAX', cinemas_ar: 'الكوت فقط (الوحيدة بالكويت)', cinemas_en: 'Al Kout only (the only one in Kuwait)', price: '4.000' },
  { name: 'Dolby Cinema', cinemas_ar: '360، الأفنيوز، العاصمة', cinemas_en: '360, Avenues, Assima', price: '4.500' },
  { name: '4DX', cinemas_ar: '360، الأفنيوز، الكوت', cinemas_en: '360, Avenues, Al Kout', price: '8.000' },
  { name: '4DX Screen', cinemas_ar: 'العاصمة فقط', cinemas_en: 'Assima only', price: '8.000' },
  { name: 'ScreenX', cinemas_ar: 'الأفنيوز والعاصمة', cinemas_en: 'Avenues and Assima', price: '4.500' },
  { name: 'ELEVEN', cinemas_ar: 'الكوت فقط', cinemas_en: 'Al Kout only', price: '3.500' },
  { name: 'VIP', cinemas_ar: '360، الأفنيوز، العاصمة، الخيران', cinemas_en: '360, Avenues, Assima, Khiran', price: '8.000' },
  { name: 'Skyline', cinemas_ar: 'العاصمة', cinemas_en: 'Assima', price: '5.000', note_ar: 'موسمي بالشتاء', note_en: 'seasonal, winter' },
  { name: '1954 Film House', cinemas_ar: 'سوق الكوت', cinemas_en: 'Souq Al Kout', price: '6.000', note_ar: 'سينما بوتيك بمقاعد ديلوكس', note_en: 'boutique cinema, Deluxe seats' },
]

function hydrateComponents(list: unknown): unknown {
  if (!Array.isArray(list)) return list
  return list.map((c) => {
    if (!c || typeof c !== 'object') return c
    const comp = c as Record<string, unknown>
    if (comp.type !== 'template') return comp
    const data = (comp.data && typeof comp.data === 'object' ? comp.data : {}) as Record<string, unknown>
    if (comp.template === 'location_card') {
      const full = CINEMA_DATA[String(data.id ?? '')]
      if (full) return { ...comp, data: { ...full, ...data } } // model fields (distance_km) win over nothing; full fills the rest
    }
    if (comp.template === 'price_list') {
      const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : PRICE_ITEMS
      return { ...comp, data: { title: data.title ?? 'أسعار التذاكر 🎬', title_en: 'Ticket prices 🎬', currency: 'د.ك', currency_en: 'KD', items } }
    }
    if (comp.template === 'experiences_list') {
      const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : EXPERIENCE_ITEMS
      return { ...comp, data: { title: 'تجاربنا السينمائية ✨', title_en: 'Our cinema experiences ✨', items } }
    }
    if (comp.template === 'menu_list') {
      let items = Array.isArray(data.items) && data.items.length > 0 ? (data.items as Array<Record<string, unknown>>) : []
      let title = data.title as string | undefined
      let title_en = data.title_en as string | undefined
      const cat = String(data.category ?? '').trim()
      // optional cinema filter: map the customer's cinema to Airtable availability columns
      const cinemaRaw = String(data.cinema ?? '').trim().toLowerCase()
      const CINEMA_COLS: Array<[RegExp, string[]]> = [
        [/360/, ['360', '360 VIP']],
        [/avenue|أفنيوز|افنيوز/, ['Avenues', 'Avenues VIP']],
        [/kout|كوت/, ['Al Kout']],
        [/assima|عاصمة|العاصمه|skyline|سكاي/, ['Assima', 'Assima VIP', 'Skyline']],
        [/khiran|khairan|خيران/, ['Khairan', 'Khairan VIP']],
        [/warehouse|ويرهاوس/, ['Warehouse']],
        [/bairaq|بيرق/, ['Bairaq']],
        [/ajial|أجيال|اجيال/, ['Ajial']],
        [/1954|بيت الأفلام|film house/, ['1954']],
      ]
      const cols = cinemaRaw ? CINEMA_COLS.find(([re]) => re.test(cinemaRaw))?.[1] : undefined
      const atCinema = (m: { cinemas: string[] }) => (cols ? m.cinemas.some((c) => cols.includes(c)) : m.cinemas.length > 0)
      // a specific food type ("popcorn", "قهوة") filters by item name, never a whole category
      const match = String(data.match ?? '').trim()
      if (items.length === 0 && match) {
        const terms = match.toLowerCase().split(/[|,،\s]+/).filter((t) => t.length >= 2)
        const hits = MENU_ITEMS.filter((m) => {
          const hay = `${m.name} ${m.name_ar}`.toLowerCase()
          return terms.some((t) => hay.includes(t)) && atCinema(m)
        })
        items = hits.map((m) => ({ label: m.name_ar || m.name, label_en: m.name, price: m.price, image: m.image }))
        title = title ?? match.split(/[|,،]/)[0]
        title_en = title_en ?? match.split(/[|,،]/)[0]
      }
      if (items.length === 0 && cat) {
        const matched = MENU_ITEMS.filter((m) => m.category.toLowerCase() === cat.toLowerCase() && atCinema(m))
        // the price-list renderer reads label/label_en
        items = matched.map((m) => ({ label: m.name_ar || m.name, label_en: m.name, price: m.price, image: m.image }))
        title = title ?? matched[0]?.category_ar
        title_en = title_en ?? matched[0]?.category
      } else if (items.length > 0) {
        // normalize model-passed items and fill prices from the dataset by name
        items = items.map((it) => {
          const nm = String(it.name ?? it.label ?? '')
          const m = MENU_ITEMS.find((x) => x.name.toLowerCase() === nm.toLowerCase() || x.name_ar === (it.name_ar ?? it.label))
          return {
            label: (it.name_ar ?? it.label ?? m?.name_ar ?? m?.name ?? nm) as string,
            label_en: (it.name ?? it.label_en ?? m?.name ?? nm) as string,
            price: (it.price ?? m?.price ?? '') as string,
            image: (m?.image ?? '') as string,
          }
        })
      }
      return { ...comp, data: { title: title ?? 'المنيو 🍿', title_en: title_en ?? 'Menu 🍿', currency: 'د.ك', currency_en: 'KD', items } }
    }
    if (comp.template === 'menu_categories') {
      const hidden = new Set(['VIP', 'Limited', 'Merchandise'])
      const order: string[] = []
      const byCat = new Map<string, { key: string; label: string; label_en: string; image: string; count: number }>()
      for (const m of MENU_ITEMS) {
        if (hidden.has(m.category)) continue
        let c = byCat.get(m.category)
        if (!c) {
          c = { key: m.category, label: m.category_ar || m.category, label_en: m.category, image: '', count: 0 }
          byCat.set(m.category, c)
          order.push(m.category)
        }
        c.count++
        if (!c.image && m.image) c.image = m.image
      }
      return { ...comp, data: { title: 'المنيو 🍿', title_en: 'Our menu 🍿', items: order.map((k) => byCat.get(k)) } }
    }
    if (comp.template === 'app_links') {
      return {
        ...comp,
        data: {
          ios: 'https://apps.apple.com/in/app/cinescape-kncc/id443396586',
          android: 'https://play.google.com/store/apps/details?id=com.cinescape&hl=en_IN',
        },
      }
    }
    return comp
  })
}

engineChatRouter.post('/widget/:widgetId/cine/chat', async (req, res) => {
  const body = {
    query: String(req.body?.query ?? ''),
    user: String(req.body?.user ?? 'widget-guest'),
    conversation_id: String(req.body?.conversation_id ?? ''),
    response_mode: 'streaming',
    inputs: typeof req.body?.inputs === 'object' && req.body.inputs ? req.body.inputs : {},
  }
  try {
    const upstream = await fetch(`${ENGINE_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: engineHeaders(),
      body: JSON.stringify(body),
    })
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (!upstream.body) {
      res.end()
      return
    }
    const reader = upstream.body.getReader()
    req.on('close', () => {
      reader.cancel().catch(() => {})
    })
    // line-wise pass-through so `components` events can be hydrated in place
    const dec = new TextDecoder()
    let tail = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      tail += dec.decode(value, { stream: true })
      const lines = tail.split('\n')
      tail = lines.pop() ?? ''
      for (const line of lines) {
        let out = line
        if (line.startsWith('data:') && line.includes('"components"')) {
          try {
            const e = JSON.parse(line.slice(5)) as { event?: string; data?: { components?: unknown } }
            if (e.event === 'components' && e.data) {
              e.data.components = hydrateComponents(e.data.components)
              out = 'data: ' + JSON.stringify(e)
            }
          } catch {
            /* pass the line through untouched */
          }
        }
        res.write(out + '\n')
      }
    }
    if (tail) res.write(tail)
    res.end()
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'agent-engine chat proxy failed')
    if (!res.headersSent) res.status(502).json({ error: { code: 'engine_unreachable', message: 'agent-engine is unreachable' } })
    else res.end()
  }
})

// Reverse geocoding for the location-share flow (browser CSP allows connect-src 'self' only).
engineChatRouter.get('/widget/:widgetId/cine/geocode', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: { code: 'bad_coords' } })
    return
  }
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar&zoom=14`,
      { headers: { 'User-Agent': 'pair-widget-pocs/1.0 (cinescape demo)' }, signal: AbortSignal.timeout(6000) },
    )
    const j = (await r.json()) as { display_name?: string; address?: Record<string, string> }
    const a = j.address ?? {}
    const short = [a.suburb || a.neighbourhood || a.quarter, a.city || a.town || a.state, a.country].filter(Boolean).join('، ')
    res.json({ address: short || j.display_name || '' })
  } catch {
    res.json({ address: '' })
  }
})

engineChatRouter.get('/widget/:widgetId/cine', (req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://cdn.cinescape.com.kw",
      "connect-src 'self'",
    ].join('; '),
  )
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(chatPage(req.params.widgetId))
})

function chatPage(widgetId: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cine · Cinescape Kuwait</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  :root{--bg:#0d1220;--panel:#151c30;--panel2:#1b2440;--ink:#eef1f8;--dim:#9aa3bd;--red:#b3202c;--red2:#d33642;--gold:#d9a441;--radius:14px}
  *{box-sizing:border-box;margin:0}
  body{background:radial-gradient(1200px 600px at 50% -200px,#1d2a4d 0%,var(--bg) 60%);color:var(--ink);font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;height:100dvh;display:flex;flex-direction:column}
  header{padding:14px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #ffffff14;background:#0d122088;backdrop-filter:blur(8px)}
  .logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--red),#7a1420);display:grid;place-items:center;font-weight:700;font-size:18px}
  header h1{font-size:15px;font-weight:700}
  header p{font-size:11px;color:var(--dim)}
  .badge{margin-inline-start:auto;font-size:10px;color:var(--gold);border:1px solid #d9a44155;border-radius:999px;padding:3px 10px}
  #chat{flex:1;overflow-y:auto;padding:18px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
  .msg{max-width:82%;padding:10px 14px;border-radius:var(--radius);font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
  .user{align-self:flex-start;background:linear-gradient(135deg,var(--red),#8f1a24);border-end-start-radius:4px}
  .bot{align-self:flex-end;background:var(--panel);border:1px solid #ffffff10;border-end-end-radius:4px}
  .bot.streaming::after{content:'▍';color:var(--gold);animation:blink 1s infinite}
  @keyframes blink{50%{opacity:0}}
  .sys{align-self:center;font-size:11px;color:var(--dim)}
  .typing{align-self:flex-end;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(135deg,var(--panel),var(--panel2));border:1px solid #ffffff12;border-radius:var(--radius);border-end-end-radius:4px;box-shadow:0 4px 18px #0006}
  .typing .tav{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--red),#7a1420);display:grid;place-items:center;font-size:12px;font-weight:700;animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{50%{box-shadow:0 0 0 6px #b3202c22}}
  .typing .tl{font-size:11.5px;color:var(--dim)}
  .typing .td{display:flex;gap:4px}
  .typing .td i{width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--red2));animation:tp 1.3s cubic-bezier(.4,0,.2,1) infinite}
  .typing .td i:nth-child(2){animation-delay:.15s}.typing .td i:nth-child(3){animation-delay:.3s}
  @keyframes tp{0%,60%,100%{opacity:.3;transform:translateY(0) scale(.85)}30%{opacity:1;transform:translateY(-5px) scale(1.1)}}
  .comps{align-self:flex-end;display:flex;flex-direction:column;gap:8px;max-width:88%}
  .carousel{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x mandatory;max-width:100%;scrollbar-width:thin;scrollbar-color:var(--red2) transparent}
  .carousel .loccard{flex:0 0 240px;scroll-snap-align:start}
  .carousel .loccard img{height:100px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
  .chip{background:transparent;border:1px solid var(--red2);color:var(--ink);border-radius:999px;padding:7px 14px;font-size:13px;font-family:inherit;cursor:pointer;transition:.15s}
  .chip:hover{background:var(--red);border-color:var(--red)}
  .qcard{background:var(--panel2);border:1px solid #ffffff14;border-radius:var(--radius);padding:14px;display:flex;flex-direction:column;gap:8px}
  .qcard h4{font-size:13px;font-weight:500;color:var(--ink)}
  .opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #ffffff1a;border-radius:10px;cursor:pointer;font-size:13px;transition:.15s}
  .opt:hover{border-color:var(--gold)}
  .opt.sel{border-color:var(--gold);background:#d9a44118}
  .opt .dot{width:15px;height:15px;border-radius:50%;border:2px solid var(--dim);flex-shrink:0}
  .opt.multi .dot{border-radius:4px}
  .opt.sel .dot{border-color:var(--gold);background:var(--gold)}
  .qrow{display:flex;gap:8px}
  .qrow input{flex:1;background:#0d1220;border:1px solid #ffffff1a;border-radius:10px;padding:9px 12px;color:var(--ink);font-family:inherit;font-size:13px}
  .btn{background:var(--red);border:none;color:#fff;border-radius:10px;padding:9px 16px;font-family:inherit;font-size:13px;cursor:pointer}
  .btn:hover{background:var(--red2)}
  .btn.ghost{background:transparent;border:1px solid var(--red2)}
  .loccard{background:var(--panel2);border:1px solid #ffffff14;border-radius:var(--radius);overflow:hidden;max-width:330px}
  .loccard img{width:100%;height:130px;object-fit:cover;display:block}
  .loccard .b{padding:12px 14px;display:flex;flex-direction:column;gap:5px}
  .loccard h4{font-size:14px}
  .loccard p{font-size:12px;color:var(--dim)}
  .loccard .hrs{font-size:12px;color:var(--gold)}
  .loccard .hrs bdo{direction:ltr;unicode-bidi:isolate}
  .pricecard{background:var(--panel2);border:1px solid #ffffff14;border-radius:var(--radius);padding:14px;max-width:330px}
  .pricecard h4{font-size:14px;margin-bottom:10px;color:var(--gold)}
  .pricecard .pr{display:flex;justify-content:space-between;gap:12px;padding:7px 2px;font-size:13px;border-bottom:1px dashed #ffffff12}
  .pricecard .pr:last-child{border-bottom:none}
  .pricecard .pr b{color:var(--ink);font-weight:500}
  .pricecard .pr span{color:var(--gold);white-space:nowrap}
  .loccard .dist{font-size:12px;color:#7fd1a8}
  .loccard a{display:inline-block;margin-top:6px;background:var(--red);color:#fff;text-decoration:none;border-radius:9px;padding:8px 14px;font-size:12.5px;text-align:center}
  footer{padding:10px 14px 16px;display:flex;gap:10px;border-top:1px solid #ffffff10;background:#0d122088}
  footer input{flex:1;background:var(--panel);border:1px solid #ffffff1a;border-radius:999px;padding:12px 18px;color:var(--ink);font-family:inherit;font-size:14px;outline:none}
  footer input:focus{border-color:var(--red2)}
  footer button{width:46px;height:46px;border-radius:50%;border:none;background:var(--red);color:#fff;font-size:18px;cursor:pointer}
</style>
</head>
<body>
<header>
  <div class="logo">C</div>
  <div><h1>Cine · سينسكيب الكويت</h1><p>مساعدك الذكي · Cinescape Kuwait</p></div>
  <span class="badge">Cinescape AI ✨</span>
</header>
<div id="chat"></div>
<footer>
  <input id="inp" placeholder="اكتب رسالتك..." autocomplete="off" />
  <button id="send">➤</button>
</footer>
<script>
const WIDGET_ID = ${JSON.stringify(widgetId)}
const API = location.pathname.replace(/\\/$/, '') + '/chat'
const CINEMAS = [
  {name:'Cinescape 360',name_ar:'سينسكيب 360',lat:29.267396766357216,lng:47.99196210604129},
  {name:'Cinescape Avenues',name_ar:'سينسكيب الأفنيوز',lat:29.30258,lng:47.92927},
  {name:'Cinescape Al Kout',name_ar:'سينسكيب الكوت',lat:29.07798,lng:48.13963},
  {name:'Cinescape Assima',name_ar:'سينسكيب العاصمة',lat:29.373813616320145,lng:47.98789268449745},
  {name:'Cinescape Khiran',name_ar:'سينسكيب الخيران',lat:28.67086,lng:48.34639},
  {name:'Cinescape Warehouse',name_ar:'سينسكيب ذا ويرهاوس',lat:29.0859,lng:48.1032},
  {name:'Cinescape Al Bairaq',name_ar:'سينسكيب البيرق',lat:29.17358,lng:48.09881},
  {name:'Cinescape Ajial',name_ar:'سينسكيب أجيال',lat:29.08288,lng:48.13633},
  {name:'1954 Film House',name_ar:'بيت الأفلام 1954',lat:29.08078,lng:48.14085},
]
const chat = document.getElementById('chat'), inp = document.getElementById('inp')
let convId = '', busy = false
let uid = 'w-' + Math.random().toString(36).slice(2, 10)
try { uid = localStorage.getItem('cine_uid') || uid; localStorage.setItem('cine_uid', uid) } catch {}

const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt !== undefined) n.textContent = txt; return n }
const scroll = () => { chat.scrollTop = chat.scrollHeight }

function haversineKm(a, b) {
  const R = 6371, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*r) * Math.cos(b.lat*r) * Math.sin(dLng/2)**2
  return R * 2 * Math.asin(Math.sqrt(h))
}

function renderComponents(list) {
  const wrap = el('div', 'comps')
  // several location cards render as one swipeable carousel
  const locCards = list.filter((c) => c.type === 'template' && c.template === 'location_card')
  let carousel = null
  if (locCards.length > 1) { carousel = el('div', 'carousel') }
  let lastDistances = null
  try { lastDistances = JSON.parse(sessionStorage.getItem('cine_dist') || 'null') } catch {}
  for (const c of list) {
    if (c.type === 'suggestions') {
      const chips = el('div', 'chips')
      for (const it of c.items) {
        const b = el('button', 'chip', String(it))
        b.onclick = () => { if (!busy) send(String(it)) }
        chips.appendChild(b)
      }
      wrap.appendChild(chips)
    } else if (c.type === 'question') {
      const card = el('div', 'qcard')
      if (c.text) card.appendChild(el('h4', '', c.text))
      const multi = c.select === 'multi', picked = new Set()
      for (const o of (c.options || [])) {
        const row = el('div', 'opt' + (multi ? ' multi' : ''))
        row.appendChild(el('span', 'dot'))
        row.appendChild(el('span', '', o.label))
        row.onclick = () => {
          if (busy) return
          if (!multi) { send(o.label); return }
          if (picked.has(o.id)) { picked.delete(o.id); row.classList.remove('sel') }
          else { picked.add(o.id); row.classList.add('sel') }
        }
        row.dataset.label = o.label
        card.appendChild(row)
      }
      if (multi) {
        const ok = el('button', 'btn', 'تأكيد')
        ok.onclick = () => {
          const labels = [...card.querySelectorAll('.opt.sel')].map((r) => r.dataset.label)
          if (labels.length && !busy) send(labels.join('، '))
        }
        card.appendChild(ok)
      }
      if (c.allow_free_text) {
        const row = el('div', 'qrow')
        const fi = el('input'); fi.placeholder = 'أو اكتب إجابتك...'
        const fb = el('button', 'btn', 'إرسال')
        const go = () => { if (fi.value.trim() && !busy) send(fi.value.trim()) }
        fb.onclick = go; fi.onkeydown = (e) => { if (e.key === 'Enter') go() }
        row.appendChild(fi); row.appendChild(fb); card.appendChild(row)
      }
      wrap.appendChild(card)
    } else if (c.type === 'template' && c.template === 'location_card') {
      const d = c.data || {}
      const card = el('div', 'loccard')
      if (d.image) { const im = el('img'); im.src = d.image; im.alt = d.name || ''; im.onerror = () => im.remove(); card.appendChild(im) }
      const b = el('div', 'b')
      b.appendChild(el('h4', '', (d.name_ar || d.name || '') + (d.name && d.name_ar ? ' · ' + d.name : '')))
      if (d.address_ar || d.address) b.appendChild(el('p', '', d.address_ar || d.address))
      if (d.hours) { const h = el('span', 'hrs'); h.append('🕐 '); const bd = document.createElement('bdo'); bd.dir = 'ltr'; bd.textContent = d.hours; h.appendChild(bd); b.appendChild(h) }
      const km = d.distance_km != null ? d.distance_km : (lastDistances && d.name ? lastDistances[d.name] : null)
      if (km != null) b.appendChild(el('span', 'dist', '📏 يبعد عنك ' + km + ' كم'))
      if (d.maps_url) { const a = el('a', '', 'الاتجاهات في خرايط جوجل 📍'); a.href = d.maps_url; a.target = '_blank'; a.rel = 'noopener'; b.appendChild(a) }
      card.appendChild(b)
      if (carousel) { carousel.appendChild(card); if (!carousel.parentNode) wrap.appendChild(carousel) }
      else wrap.appendChild(card)
    } else if (c.type === 'template' && c.template === 'price_list') {
      const d = c.data || {}
      const card = el('div', 'pricecard')
      card.appendChild(el('h4', '', d.title || 'أسعار التذاكر 🎬'))
      for (const it of (d.items || [])) {
        const row = el('div', 'pr')
        row.appendChild(el('b', '', it.label || ''))
        row.appendChild(el('span', '', (it.price || '') + ' ' + (d.currency || 'د.ك')))
        card.appendChild(row)
      }
      wrap.appendChild(card)
    } else if (c.type === 'location_request') {
      const card = el('div', 'qcard')
      card.appendChild(el('h4', '', c.text || 'شارك موقعك عشان أحدد أقرب سينما ليك بالضبط 📍'))
      const b = el('button', 'btn', '📍 شارك موقعي')
      b.onclick = () => {
        if (busy) return
        b.disabled = true; b.textContent = 'جاري تحديد موقعك...'
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const me = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            const dists = CINEMAS.map((cn) => ({ ...cn, km: haversineKm(me, cn) })).sort((x, y) => x.km - y.km)
            const store = {}; for (const d of dists) store[d.name] = d.km.toFixed(1)
            try { sessionStorage.setItem('cine_dist', JSON.stringify(store)) } catch {}
            let addr = ''
            try {
              const g = await fetch(location.pathname.replace(/\\/$/, '') + '/geocode?lat=' + me.lat + '&lng=' + me.lng)
              addr = ((await g.json()).address || '')
            } catch {}
            const far = dists[0].km > 100
            const summary = dists.slice(0, 4).map((d) => d.name + ' = ' + d.km.toFixed(1) + ' km').join(' · ')
            const lines = ['📍 shared my location: ' + me.lat.toFixed(5) + ', ' + me.lng.toFixed(5)]
            if (addr) lines.push('my address: ' + addr)
            if (far) lines.push('NOTE: customer is far outside Kuwait — nearest cinema is ' + dists[0].km.toFixed(0) + ' km away. Do NOT send a location card.')
            lines.push('exact distances (computed, ground truth): ' + summary)
            send(lines.join('\\n'), '📍 تم مشاركة موقعك' + (addr ? ' — ' + addr : ''))
          },
          () => { b.disabled = false; b.textContent = '📍 شارك موقعي'; addSys('ما قدرنا نوصل لموقعك — تقدر تكتب اسم منطقتك') },
          { enableHighAccuracy: true, timeout: 12000 },
        )
      }
      card.appendChild(b)
      wrap.appendChild(card)
    }
  }
  if (wrap.children.length) { chat.appendChild(wrap); scroll() }
}

const addSys = (t) => { chat.appendChild(el('div', 'sys', t)); scroll() }

async function send(query, displayAs) {
  if (busy || !query.trim()) return
  busy = true
  document.querySelectorAll('.comps').forEach((n) => n.remove())
  chat.appendChild(el('div', 'msg user', displayAs || query))
  const typing = el('div', 'typing')
  typing.appendChild(el('span', 'tav', 'C'))
  typing.appendChild(el('span', 'tl', 'Cine يكتب'))
  const td = el('span', 'td'); td.append(el('i'), el('i'), el('i')); typing.appendChild(td)
  chat.appendChild(typing); scroll()
  let bubble = null, buf = ''
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, user: uid, conversation_id: convId, inputs: {} }),
    })
    const reader = r.body.getReader(), dec = new TextDecoder()
    let acc = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      acc += dec.decode(value, { stream: true })
      const lines = acc.split('\\n'); acc = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        let e; try { e = JSON.parse(line.slice(5)) } catch { continue }
        if (e.conversation_id) convId = e.conversation_id
        const k = e.event
        if (k === 'message' && e.answer) {
          if (!bubble) { typing.remove(); bubble = el('div', 'msg bot streaming'); chat.appendChild(bubble) }
          buf += e.answer; bubble.textContent = buf; scroll()
        } else if (k === 'message_replace') {
          if (!bubble) { typing.remove(); bubble = el('div', 'msg bot streaming'); chat.appendChild(bubble) }
          buf = e.answer || ''; bubble.textContent = buf; scroll()
        } else if (k === 'components') {
          renderComponents((e.data && e.data.components) || [])
        } else if (k === 'error') {
          typing.remove(); addSys('صار خلل بسيط، جرب مرة ثانية')
        }
      }
    }
  } catch { addSys('تعذر الاتصال — جرب مرة ثانية') }
  typing.remove()
  if (bubble) bubble.classList.remove('streaming')
  busy = false; inp.focus()
}

document.getElementById('send').onclick = () => { const v = inp.value.trim(); if (v) { inp.value = ''; send(v) } }
inp.onkeydown = (e) => { if (e.key === 'Enter') { const v = inp.value.trim(); if (v) { inp.value = ''; send(v) } } }
send('هلا', '👋')
</script>
</body>
</html>`
}

/* ------------------------------------------------------------------------- *
 * Real-widget adapter: lets the pair-widget SDK talk to agent-engine.
 *
 * Mounted at /v1 AFTER publicRouter and BEFORE pairProxy, and claims a request
 * only when the widget's Redis record has `engine: "agent-engine"` — every
 * other widget falls through to the Pair proxy untouched.
 *
 * The SDK keeps its normal REST contract (register / send-message / messages)
 * and, instead of Pusher, subscribes to an SSE stream per conversation:
 *   GET /v1/widget/:id/conversations/:convId/stream
 * Events: {event:'delta'|'complete'|'message', ...} feeding the SDK's existing
 * streaming store and message cache.
 * ------------------------------------------------------------------------- */

interface WidgetMessage {
  ulid: string
  type: 'message'
  content: string
  message_type: 'widget_message' | 'text'
  sender_type: 'ai_agent' | 'contact'
  sent_at: string
  status: 'sent'
  sender_name?: string
  next_messages?: unknown[]
  suggestions?: { type: 'suggestions'; options: string[] }
  widget_template?: Record<string, unknown>
}

/**
 * Context-aware thinking narration. The opener is derived from what the
 * customer actually asked; tool stages surface what is really being looked
 * up, so the line reads like genuine work, not filler.
 */
const THINK_TOPICS: Array<{ re: RegExp; ar: string[]; en: string[] }> = [
  { re: /سعر|اسعار|أسعار|بكم|price|cost|how much/i,
    ar: ['أطلع لك الأسعار المعتمدة عندنا', 'أتأكد لك من أسعار التذاكر بالضبط'],
    en: ['Pulling up our current ticket prices', 'Checking the exact prices for you'] },
  { re: /دوام|مفتوح|يسكر|ساعات|hours|open|close/i,
    ar: ['أشيك على الدوام الحين', 'أتأكد من ساعات العمل لهاليوم'],
    en: ['Checking the opening hours right now', "Verifying today's working hours"] },
  { re: /وين|أقرب|اقرب|موقع|لوكيشن|فرع|where|near|location/i,
    ar: ['أحدد لك أقرب خيار مناسب', 'أطابق المواقع وأشوف الأنسب لك'],
    en: ['Working out your best nearby option', 'Matching locations to find the closest'] },
  { re: /تجارب|تجربة|فرق|قارن|imax|dolby|4dx|screenx|vip|skyline|experience|difference|compare/i,
    ar: ['أقارن لك التجارب وأطلع الزبدة', 'أراجع مميزات كل تجربة عشان أنصحك صح'],
    en: ['Comparing the experiences for you', 'Weighing up each format to advise you right'] },
  { re: /حجز|احجز|أحجز|تذكرة|تذاكر|book|ticket/i,
    ar: ['أشوف لك أسهل طريقة تحجز فيها', 'أجهز لك خطوات الحجز'],
    en: ['Finding you the easiest way to book', 'Lining up the booking steps'] },
]
const THINK_GENERIC = {
  start: {
    ar: ['خلني أفهم طلبك عدل', 'أرتب أفكاري وأرد عليك', 'لحظة، أفكر بأفضل جواب لك'],
    en: ['Let me get this right', 'Gathering my thoughts', 'Thinking through the best answer'],
  },
  route: {
    ar: ['عرفت وين ألقى جوابك، جاري التجهيز', 'حددت المعلومة اللي تحتاجها، ثواني'],
    en: ['Found where your answer lives, one sec', 'Zeroed in on what you need'],
  },
  locations: {
    ar: ['أفتح خريطة سينماتنا وأطابق المواقع', 'أراجع عناوين ودوام كل سينما'],
    en: ['Opening our cinema map and matching locations', 'Going through every cinema address and hours'],
  },
  knowledge: {
    ar: ['أقلب في معلوماتنا الرسمية وأتحقق منها', 'أراجع التفاصيل من المصدر قبل ما أجاوبك'],
    en: ['Digging through our official info', 'Verifying the details at the source before answering'],
  },
}

function pickFrom(pool: string[], avoid?: string): string {
  const options = pool.filter((x) => x !== avoid)
  const list = options.length > 0 ? options : pool
  return list[Math.floor(Math.random() * list.length)]
}

/** The opening line reflects the topic of the customer's own message. */
function thinkOpener(query: string, lang: 'ar' | 'en', avoid?: string): string {
  for (const t of THINK_TOPICS) {
    if (t.re.test(query)) return pickFrom(t[lang], avoid)
  }
  return pickFrom(THINK_GENERIC.start[lang], avoid)
}

/** A knowledge lookup names what it is actually searching for. */
function thinkKnowledge(toolInput: string, lang: 'ar' | 'en', avoid?: string): string {
  try {
    const parsed = JSON.parse(toolInput) as Record<string, unknown>
    const q = String(parsed.query ?? parsed.q ?? parsed.question ?? '').trim()
    if (q && q.length <= 60) return lang === 'ar' ? `أبحث في معلوماتنا عن «${q}»` : `Searching our info for “${q}”`
  } catch {
    /* fall through to the generic line */
  }
  return pickFrom(THINK_GENERIC.knowledge[lang], avoid)
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar&zoom=14`,
      { headers: { 'User-Agent': 'pair-widget-pocs/1.0 (cinescape widget)' }, signal: AbortSignal.timeout(6000) },
    )
    const j = (await r.json()) as { display_name?: string; address?: Record<string, string> }
    const a = j.address ?? {}
    return [a.suburb || a.neighbourhood || a.quarter, a.city || a.town || a.state, a.country].filter(Boolean).join('، ') || j.display_name || ''
  } catch {
    return ''
  }
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

/**
 * A widget location share becomes the full machine message the agent expects:
 * coordinates, reverse-geocoded address, exact distances, and a far-outside-
 * Kuwait note. The customer's bubble keeps the short text.
 */
async function enrichLocationMessage(content: string, meta?: unknown): Promise<string | null> {
  let lat = NaN, lng = NaN
  const shared = (meta as { shared_location?: { lat?: unknown; lng?: unknown } } | undefined)?.shared_location
  if (shared) {
    lat = Number(shared.lat)
    lng = Number(shared.lng)
  } else {
    const m = content.match(/📍[^:]*:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    if (!m) return null
    lat = Number(m[1])
    lng = Number(m[2])
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const dists = Object.values(CINEMA_DATA)
    .map((c) => ({ name: String(c.name), km: haversineKm(lat, lng, Number(c.lat), Number(c.lng)) }))
    .sort((a, b) => a.km - b.km)
  const addr = await reverseGeocode(lat, lng)
  const lines = [`📍 shared my location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`]
  if (addr) lines.push(`my address: ${addr}`)
  if (dists[0].km > 100) lines.push(`NOTE: customer is far outside Kuwait — nearest cinema is ${dists[0].km.toFixed(0)} km away. Do NOT send a location card.`)
  lines.push('exact distances (computed, ground truth): ' + dists.slice(0, 4).map((d) => `${d.name} = ${d.km.toFixed(1)} km`).join(' · '))
  return lines.join('\n')
}

const hasArabic = (t: string) => /[\u0600-\u06FF]/.test(t)
const hasLetters = (t: string) => /[a-zA-Z\u0600-\u06FF]/.test(t)
// Switching to English needs a real typed sentence — a tapped chip like "IMAX" or "VIP 360" must not flip an Arabic conversation.
const isEnglishSentence = (t: string) => !hasArabic(t) && /[a-z]{2,}\s+[a-z]{2,}/i.test(t) && t.trim().length > 8

/**
 * Builds the SDK's native widget_template from hydrated components (cards beat the price list).
 * `replyText` decides the template's language: cards follow the reply, not the widget's view setting.
 */
function componentsToTemplate(comps: Array<Record<string, unknown>>, replyText: string): Record<string, unknown> | undefined {
  const lang = /[\u0600-\u06FF]/.test(replyText) ? 'ar' : 'en'
  const cards = comps
    .filter((c) => c.type === 'template' && c.template === 'location_card')
    .map((c) => c.data as Record<string, unknown>)
    .filter((d) => d && d.name)
  if (cards.length > 0) return { type: 'location_cards', content: { lang, cards } }
  const price = comps.find((c) => c.type === 'template' && c.template === 'price_list')
  if (price) return { type: 'price_list', content: { lang, ...(price.data as Record<string, unknown>) } }
  const exp = comps.find((c) => c.type === 'template' && c.template === 'experiences_list')
  if (exp) return { type: 'experiences_list', content: { lang, ...(exp.data as Record<string, unknown>) } }
  const mcats = comps.find((c) => c.type === 'template' && c.template === 'menu_categories')
  if (mcats) return { type: 'menu_categories', content: { lang, ...(mcats.data as Record<string, unknown>) } }
  const movies = comps.find((c) => c.type === 'template' && c.template === 'movie_cards')
  if (movies) return { type: 'movie_cards', content: { lang, ...(movies.data as Record<string, unknown>) } }
  const app = comps.find((c) => c.type === 'template' && c.template === 'app_links')
  if (app) return { type: 'app_links', content: { lang, ...(app.data as Record<string, unknown>) } }
  const menu = comps.find((c) => c.type === 'template' && c.template === 'menu_list')
  if (menu) {
    const md = menu.data as { items?: Array<{ image?: string }> }
    const hasImages = Array.isArray(md.items) && md.items.some((i) => i.image)
    return { type: hasImages ? 'menu_cards' : 'price_list', content: { lang, ...(menu.data as Record<string, unknown>) } }
  }
  return undefined
}

interface EngineConv {
  engineConv: string
  history: WidgetMessage[]
  clients: Set<Response>
  user: string
  /** the customer's language, updated from every worded message they type */
  lang: 'ar' | 'en'
}

const convs = new Map<string, EngineConv>()

async function isEngineWidget(widgetId: string): Promise<boolean> {
  try {
    const raw = await redis.get(`widget:${widgetId}`)
    if (!raw) return false
    return (JSON.parse(raw) as { engine?: string }).engine === 'agent-engine'
  } catch {
    return false
  }
}

function broadcast(conv: EngineConv, event: Record<string, unknown>) {
  const line = `data: ${JSON.stringify(event)}\n\n`
  for (const c of conv.clients) {
    try {
      c.write(line)
    } catch {
      conv.clients.delete(c)
    }
  }
}

/** Renders hydrated card components into markdown the SDK's message body can show today. */
function cardsToMarkdown(comps: Array<Record<string, unknown>>): string {
  const parts: string[] = []
  for (const c of comps) {
    if (c.type !== 'template') continue
    const d = (c.data ?? {}) as Record<string, unknown>
    if (c.template === 'location_card' && d.name) {
      const lines = [`**${String(d.name_ar ?? d.name)} · ${String(d.name)}**`]
      if (d.address_ar || d.address) lines.push(String(d.address_ar ?? d.address))
      if (d.hours) lines.push(`🕐 ${String(d.hours)}`)
      if (d.distance_km != null) lines.push(`📏 يبعد عنك ${String(d.distance_km)} كم`)
      if (d.maps_url) lines.push(`[الاتجاهات في خرايط جوجل 📍](${String(d.maps_url)})`)
      parts.push(lines.join('\n'))
    }
    if (c.template === 'price_list') {
      const items = (Array.isArray(d.items) ? d.items : []) as Array<Record<string, unknown>>
      const cur = String(d.currency ?? 'د.ك')
      parts.push([`**${String(d.title ?? 'أسعار التذاكر 🎬')}**`, ...items.map((it) => `- ${String(it.label)}: ${String(it.price)} ${cur}`)].join('\n'))
    }
  }
  return parts.join('\n\n')
}

function componentsToWidgetFields(comps: Array<Record<string, unknown>>): Pick<WidgetMessage, 'next_messages' | 'suggestions'> {
  const out: Pick<WidgetMessage, 'next_messages' | 'suggestions'> = {}
  for (const c of comps) {
    if (c.type === 'location_request') {
      out.next_messages = [...(out.next_messages ?? []), { type: 'location_request', text: c.text ?? '' }]
    }
    if (c.type === 'question') {
      const opts = (Array.isArray(c.options) ? c.options : []) as Array<Record<string, unknown>>
      if (opts.length < 2) continue // a choice card with no real choices renders as a useless empty box
      out.next_messages = [
        ...(out.next_messages ?? []),
        { type: 'question', question: String(c.text ?? ''), input_type: c.select === 'multi' ? 'multi' : 'single', options: opts.map((o) => String(o.label ?? o.id ?? '')) },
      ]
    }
    if (c.type === 'suggestions' && Array.isArray(c.items)) {
      out.suggestions = { type: 'suggestions', options: (c.items as unknown[]).map(String) }
    }
  }
  return out
}

/**
 * Runs one agent-engine turn for a conversation and broadcasts widget-shaped events.
 * `onConvId` fires as soon as the engine assigns its conversation id (first SSE event),
 * so a brand-new conversation can answer send-message with the engine's own — persistent — id.
 */
async function runEngineTurn(conv: EngineConv, query: string, onConvId?: (id: string) => void) {
  const streamId = `st-${ulid()}`
  const botUlid = ulid()
  let buf = ''
  let finalText = ''
  let comps: Array<Record<string, unknown>> = []
  let replaced = false
  const convId = () => conv.engineConv
  // narrated status: the widget's thinking line follows what the engine is actually doing
  let lastThink = ''
  const say = (text: string) => {
    if (!text || text === lastThink) return
    lastThink = text
    broadcast(conv, { event: 'thinking', conversation_id: conv.engineConv, stream_id: streamId, text })
  }
  say(thinkOpener(query, conv.lang))
  try {
    const upstream = await fetch(`${ENGINE_URL}/v1/chat-messages`, {
      method: 'POST',
      headers: engineHeaders(),
      body: JSON.stringify({ query, user: conv.user, conversation_id: conv.engineConv, response_mode: 'streaming', inputs: {} }),
    })
    if (!upstream.body) throw new Error('no body')
    const reader = upstream.body.getReader()
    const dec = new TextDecoder()
    let tail = ''
    let seq = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      tail += dec.decode(value, { stream: true })
      const lines = tail.split('\n')
      tail = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        let e: Record<string, unknown>
        try {
          e = JSON.parse(line.slice(5)) as Record<string, unknown>
        } catch {
          continue
        }
        if (typeof e.conversation_id === 'string' && e.conversation_id && !conv.engineConv) {
          conv.engineConv = e.conversation_id
          onConvId?.(e.conversation_id)
          onConvId = undefined
        }
        if (e.event === 'route') {
          say(pickFrom(THINK_GENERIC.route[conv.lang], lastThink))
        } else if (e.event === 'agent_thought') {
          const tool = String((e as { tool?: unknown }).tool ?? '')
          if (tool === 'cinescape_locations') say(pickFrom(THINK_GENERIC.locations[conv.lang], lastThink))
          else if (tool && !tool.startsWith('route_to_')) say(thinkKnowledge(String((e as { tool_input?: unknown }).tool_input ?? ''), conv.lang, lastThink))
        } else if (e.event === 'message' && typeof e.answer === 'string') {
          buf += e.answer
          broadcast(conv, { event: 'delta', conversation_id: convId(), stream_id: streamId, delta: e.answer, seq: seq++ })
        } else if (e.event === 'message_replace' && typeof e.answer === 'string') {
          // the engine's corrected text (guards, offline script) wins over the model's raw message
          buf = e.answer
          finalText = e.answer
          replaced = true
        } else if (e.event === 'components') {
          const data = e.data as { components?: unknown } | undefined
          comps = (hydrateComponents(data?.components) as Array<Record<string, unknown>>) ?? []
        } else if (e.event === 'envelope') {
          const raw = (e.data as { raw?: { message?: string } } | undefined)?.raw
          if (raw?.message && !replaced) finalText = raw.message
        }
      }
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'engine turn failed')
    finalText = finalText || 'نعتذر، صار خلل بسيط. جرب مرة ثانية 🙏'
  }
  {
    // chips must speak the reply's language — mismatched ones (a model slip) are replaced
    const arReply = /[\u0600-\u06FF]/.test(finalText || buf)
    const fallback = arReply ? ['كل السينمات 📍', 'أسعار التذاكر', 'شنو التجارب عندكم؟'] : ['All cinemas 📍', 'Ticket prices', 'Your experiences?']
    const sug = comps.find((c) => c.type === 'suggestions') as { items?: unknown[] } | undefined
    if (!sug) {
      comps.push({ type: 'suggestions', items: fallback })
    } else if (Array.isArray(sug.items) && sug.items.length > 0) {
      const arItems = sug.items.filter((i) => /[\u0600-\u06FF]/.test(String(i))).length
      const mismatched = arReply ? arItems < sug.items.length / 2 : arItems > sug.items.length / 2
      if (mismatched) sug.items = fallback
    }
  }
  const template = componentsToTemplate(comps, finalText || buf)
  const content = template ? finalText || buf : [finalText || buf, cardsToMarkdown(comps)].filter(Boolean).join('\n\n')
  const message: WidgetMessage = {
    ulid: botUlid,
    type: 'message',
    content,
    message_type: 'widget_message',
    sender_type: 'ai_agent',
    sender_name: 'Cine',
    sent_at: new Date().toISOString(),
    status: 'sent',
    ...componentsToWidgetFields(comps),
    ...(template ? { widget_template: template } : {}),
  }
  conv.history.push(message)
  broadcast(conv, { event: 'complete', conversation_id: convId(), stream_id: streamId })
  broadcast(conv, { event: 'message', conversation_id: convId(), message })
}

/** Rebuilds a conversation's widget history from the engine's persistent store (survives studio restarts). */
async function loadConvFromEngine(convId: string): Promise<EngineConv | null> {
  try {
    const r = await fetch(`${ENGINE_URL}/v1/conversations/${encodeURIComponent(convId)}`, { headers: engineHeaders(false) })
    if (!r.ok) return null
    const doc = (await r.json()) as { id: string; user?: string; messages?: Array<{ id: string; role: string; text: string; envelope?: string; created_at?: number }> }
    const history: WidgetMessage[] = []
    for (const m of doc.messages ?? []) {
      const sentAt = new Date((m.created_at ?? 0) * 1000 || Date.now()).toISOString()
      if (m.role === 'user') {
        history.push({ ulid: m.id.replace(/-/g, '').slice(0, 26).toUpperCase(), type: 'message', content: m.text, message_type: 'text', sender_type: 'contact', sent_at: sentAt, status: 'sent' })
      } else if (m.role === 'assistant') {
        let text = m.text
        let comps: Array<Record<string, unknown>> = []
        if (m.envelope) {
          try {
            const envDoc = JSON.parse(m.envelope) as { message?: string; components?: unknown }
            if (envDoc.message) text = envDoc.message
            comps = (hydrateComponents(envDoc.components) as Array<Record<string, unknown>>) ?? []
          } catch {
            /* plain text fallback */
          }
        }
        const template = componentsToTemplate(comps, text)
        history.push({
          ulid: m.id.replace(/-/g, '').slice(0, 26).toUpperCase(),
          type: 'message',
          content: template ? text : [text, cardsToMarkdown(comps)].filter(Boolean).join('\n\n'),
          message_type: 'widget_message',
          sender_type: 'ai_agent',
          sender_name: 'Cine',
          sent_at: sentAt,
          status: 'sent',
          ...componentsToWidgetFields(comps),
          ...(template ? { widget_template: template } : {}),
        })
      }
    }
    let lang: 'ar' | 'en' = 'ar'
    for (const m of doc.messages ?? []) {
      if (m.role === 'user' && !m.text.startsWith('📍 shared my location') && hasLetters(m.text)) lang = hasArabic(m.text) ? 'ar' : 'en'
    }
    return { engineConv: doc.id, history, clients: new Set(), user: doc.user || `widget-${convId}`, lang }
  } catch {
    return null
  }
}

/** The contact id from the widget's Bearer token (issued by our register endpoint). */
function contactSub(req: Request): string {
  const tok = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!tok) return ''
  try {
    return String((jwt.verify(tok, env.JWT_SECRET) as { sub?: string }).sub ?? '')
  } catch {
    return ''
  }
}

/** Remembers which conversations belong to a contact, so the widget can resume them after a reload. */
async function rememberConv(sub: string, convId: string): Promise<void> {
  if (!sub || !convId) return
  try {
    const key = `engine:contact:${sub}`
    const raw = await redis.get(key)
    const arr: string[] = raw ? (JSON.parse(raw) as string[]) : []
    const next = [convId, ...arr.filter((c) => c !== convId)].slice(0, 10)
    await redis.set(key, JSON.stringify(next), 'EX', 60 * 60 * 24 * 90)
  } catch {
    /* best effort */
  }
}

async function getOrRestoreConv(convId: string): Promise<EngineConv | null> {
  const existing = convs.get(convId)
  if (existing) return existing
  const restored = await loadConvFromEngine(convId)
  if (restored) convs.set(convId, restored)
  return restored
}

export const engineWidgetRouter = Router()

engineWidgetRouter.post('/widget/:widgetId/register', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  const contactId = `ec-${ulid()}`
  const token = jwt.sign({ sub: contactId, wid: req.params.widgetId, src: 'engine' }, env.JWT_SECRET, { expiresIn: '30d' })
  res.json({ token, contact_id: contactId, requires_pre_chat: false })
})

engineWidgetRouter.post('/widget/:widgetId/auth/pusher', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  res.status(403).json({ error: { code: 'pusher_disabled', message: 'this widget streams over SSE' } })
})

engineWidgetRouter.get('/widget/:widgetId/conversations', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  const sub = contactSub(req)
  let ids: string[] = []
  if (sub) {
    try {
      ids = JSON.parse((await redis.get(`engine:contact:${sub}`)) ?? '[]') as string[]
    } catch {
      ids = []
    }
  }
  const data = []
  for (const id of ids.slice(0, 5)) {
    const conv = await getOrRestoreConv(id)
    if (!conv || conv.history.length === 0) continue
    const last = conv.history[conv.history.length - 1]
    data.push({
      ulid: id,
      status: 'open' as const,
      subject: '',
      created_at: conv.history[0].sent_at,
      last_message_at: last.sent_at,
      last_message_preview: last.content.replace(/\n/g, ' ').slice(0, 80),
      unread_count: 0,
    })
  }
  res.json({ data, meta: { page: 1, limit: 20, total: data.length } })
})

engineWidgetRouter.post('/widget/:widgetId/send-message', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  const content = String((req.body as { content?: unknown })?.content ?? '').trim()
  if (!content) {
    res.status(400).json({ error: { code: 'empty_message' } })
    return
  }
  const requestedConv = String((req.body as { conversation_id?: unknown })?.conversation_id ?? '')
  const msgUlid = ulid()
  const userMsg: WidgetMessage = { ulid: msgUlid, type: 'message', content, message_type: 'text', sender_type: 'contact', sent_at: new Date().toISOString(), status: 'sent' }

  const sub = contactSub(req)
  const enrichedLocation = await enrichLocationMessage(content, (req.body as { metadata?: unknown })?.metadata)
  const isMachineMsg = content.startsWith('📍 shared my location') || enrichedLocation !== null
  if (requestedConv) {
    // existing conversation: the widget's id IS the engine's persistent conversation id
    const conv =
      (await getOrRestoreConv(requestedConv)) ??
      ({ engineConv: requestedConv, history: [], clients: new Set<Response>(), user: `widget-${requestedConv}`, lang: 'ar' } as EngineConv)
    convs.set(requestedConv, conv)
    if (!isMachineMsg && hasLetters(content)) conv.lang = hasArabic(content) ? 'ar' : isEnglishSentence(content) ? 'en' : conv.lang
    conv.history.push(userMsg)
    broadcast(conv, { event: 'message', conversation_id: requestedConv, message: userMsg })
    void rememberConv(sub, requestedConv)
    void runEngineTurn(conv, enrichedLocation ?? content)
    res.json({ message_id: msgUlid, conversation_id: requestedConv, status: 'sent', sent_at: userMsg.sent_at })
    return
  }

  // new conversation: wait for the engine to assign its id (first SSE event), then answer with it
  const conv: EngineConv = {
    engineConv: '',
    history: [userMsg],
    clients: new Set(),
    user: `widget-${msgUlid}`,
    lang: !isMachineMsg && isEnglishSentence(content) ? 'en' : 'ar',
  }
  let responded = false
  const timer = setTimeout(() => {
    if (!responded) {
      responded = true
      res.status(504).json({ error: { code: 'engine_timeout', message: 'agent-engine did not answer in time' } })
    }
  }, 15000)
  void runEngineTurn(conv, enrichedLocation ?? content, (engineId) => {
    convs.set(engineId, conv)
    void rememberConv(sub, engineId)
    if (!responded) {
      responded = true
      clearTimeout(timer)
      res.json({ message_id: msgUlid, conversation_id: engineId, status: 'sent', sent_at: userMsg.sent_at })
    }
  })
})

engineWidgetRouter.get('/widget/:widgetId/conversations/:convId/messages', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  const conv = await getOrRestoreConv(req.params.convId)
  res.json({ data: conv?.history ?? [], has_more: false })
})

engineWidgetRouter.get('/widget/:widgetId/conversations/:convId/stream', async (req, res, next) => {
  if (!(await isEngineWidget(req.params.widgetId))) return next()
  const conv = await getOrRestoreConv(req.params.convId)
  if (!conv) {
    res.status(404).json({ error: { code: 'unknown_conversation' } })
    return
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  // replay history so a client that connected after send still sees everything (dedup by ulid client-side)
  for (const m of conv.history) res.write(`data: ${JSON.stringify({ event: 'message', conversation_id: req.params.convId, message: m })}\n\n`)
  conv.clients.add(res)
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      /* dropped */
    }
  }, 25000)
  req.on('close', () => {
    clearInterval(ping)
    conv.clients.delete(res)
  })
})
