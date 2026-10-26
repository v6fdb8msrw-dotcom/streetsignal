// Lokale Server-Komponente für den Linkimport (Master-Prompt Abschnitte 4 und 12).
// Ruft nur Seiten ab, deren Domain du ausdrücklich freigegeben hast, und nie bekannte Portale ohne Erlaubnis.
// Start: node server/index.mjs (über „npm run dev“ automatisch)
import http from 'node:http'
import https from 'node:https'
import { PORTALS } from '../src/sources/registry.ts'
import { extractListing } from './extract.mjs'
import { checkUrlShape, GuardError, resolvePublic } from './guard.mjs'

const PORT = Number(process.env.STREETSIGNAL_API_PORT ?? 5187)
const MAX_BYTES = 2_000_000
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3
const USER_AGENT = 'StreetSignal/0.2 (lokaler Prototyp; Linkimport auf Nutzerwunsch)'

function portalFor(host) {
  const h = host.toLowerCase().replace(/^www\./, '')
  return PORTALS.find((p) => p.domains.some((d) => h === d || h.endsWith(`.${d}`))) ?? null
}

/** Ein einzelner GET mit fest aufgelöster öffentlicher IP, Größen- und Zeitlimit; folgt keinen Weiterleitungen selbst */
async function getOnce(url) {
  const addr = await resolvePublic(url.hostname)
  const lib = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'de' },
        lookup: (_h, _o, cb) => cb(null, addr.address, addr.family),
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          return resolve({ status, redirect: res.headers.location, body: '', type: '' })
        }
        const type = String(res.headers['content-type'] ?? '')
        let size = 0
        const chunks = []
        res.on('data', (c) => {
          size += c.length
          if (size > MAX_BYTES) {
            req.destroy(new GuardError('Die Seite ist zu groß (über 2 MB).'))
            return
          }
          chunks.push(c)
        })
        res.on('end', () => resolve({ status, redirect: null, body: Buffer.concat(chunks).toString('utf8'), type }))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new GuardError('Zeitüberschreitung beim Abruf.')))
    req.on('error', reject)
    req.end()
  })
}

async function safeGet(raw) {
  let url = checkUrlShape(raw)
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await getOnce(url)
    if (!res.redirect) return { ...res, finalUrl: url.toString() }
    url = checkUrlShape(new URL(res.redirect, url).toString())
    const p = portalFor(url.hostname)
    if (p && p.policy === 'manual-link') throw new GuardError(`Weiterleitung zu ${p.name}; dort ist kein automatischer Abruf erlaubt.`)
  }
  throw new GuardError('Zu viele Weiterleitungen.')
}

/** robots.txt respektieren: Disallow-Regeln für * oder StreetSignal */
async function robotsAllows(url) {
  try {
    const res = await getOnce(new URL('/robots.txt', url))
    if (res.status >= 400) return true
    let applies = false
    for (const line of res.body.split('\n')) {
      const [k, ...rest] = line.split(':')
      const v = rest.join(':').trim()
      if (/^user-agent$/i.test(k.trim())) applies = v === '*' || /streetsignal/i.test(v)
      else if (applies && /^disallow$/i.test(k.trim()) && v && url.pathname.startsWith(v)) return false
    }
    return true
  } catch {
    return true
  }
}

async function handleImport(body) {
  const url = checkUrlShape(body.url)
  const portal = portalFor(url.hostname)
  if (portal && portal.policy === 'manual-link') return { mode: 'manual-link', portalId: portal.id, note: portal.note }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const permitted = Array.isArray(body.permittedHosts) ? body.permittedHosts.map((h) => String(h).toLowerCase()) : []
  if (!permitted.includes(host)) return { mode: 'not-permitted', host }
  if (!(await robotsAllows(url))) return { mode: 'robots-disallowed', host }
  const res = await safeGet(url.toString())
  if (res.status >= 400) return { mode: 'error', message: `Die Seite antwortet mit ${res.status}.` }
  if (!/text\/html|application\/xhtml/i.test(res.type)) return { mode: 'error', message: 'Die Adresse liefert keine Webseite.' }
  const { fields, text } = extractListing(res.body)
  return { mode: 'fetched', finalUrl: res.finalUrl, fields, text, fetchedAt: new Date().toISOString() }
}

const server = http.createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  }
  if (req.method === 'GET' && req.url === '/api/health') return send(200, { ok: true })
  if (req.method !== 'POST' || req.url !== '/api/import') return send(404, { error: 'Nicht gefunden' })
  let raw = ''
  req.on('data', (c) => {
    raw += c
    if (raw.length > 10_000) req.destroy()
  })
  req.on('end', async () => {
    try {
      send(200, await handleImport(JSON.parse(raw || '{}')))
    } catch (e) {
      send(200, { mode: 'error', message: e instanceof GuardError ? e.message : 'Abruf fehlgeschlagen.' })
    }
  })
})

// Nur lokal erreichbar
server.listen(PORT, '127.0.0.1', () => console.log(`StreetSignal-Import läuft auf http://127.0.0.1:${PORT}`))
