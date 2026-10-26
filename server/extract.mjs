// Liest strukturierte Angaben aus HTML, ohne Skripte auszuführen: schema.org (JSON-LD) und Open Graph.
// Kontaktdaten (Telefon, E-Mail) werden bewusst nicht übernommen.

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
}

export function metaTags(html) {
  const out = {}
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0]
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]
    if (key && content !== undefined) out[key.toLowerCase()] = decodeEntities(content)
  }
  return out
}

export function jsonLdBlocks(html) {
  const blocks = []
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim())
      const list = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data]
      blocks.push(...list)
    } catch {
      // kaputtes JSON-LD ignorieren
    }
  }
  return blocks
}

const TYPES = /RealEstateListing|Offer|Product|Residence|Apartment|House|SingleFamilyResidence|Accommodation|Place/i

function num(v) {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Sichtbarer Text ohne Skripte, Styles und Navigation, für die Texterkennung im Browser */
export function visibleText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d|tr|section)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n+/g, '\n')
    .trim()
    .slice(0, 20000)
}

export function extractListing(html) {
  const meta = metaTags(html)
  const ld = jsonLdBlocks(html).filter((b) => TYPES.test(String(b['@type'] ?? '')))
  const fields = {}
  const set = (k, value, evidence) => {
    if (value !== null && value !== undefined && value !== '' && fields[k] === undefined) fields[k] = { value, evidence }
  }
  for (const b of ld) {
    const offer = Array.isArray(b.offers) ? b.offers[0] : b.offers
    set('title', b.name, 'schema.org name')
    set('description', typeof b.description === 'string' ? b.description.slice(0, 800) : null, 'schema.org description')
    set('price', num(offer?.price ?? b.price), 'schema.org price')
    set('currency', offer?.priceCurrency ?? b.priceCurrency, 'schema.org priceCurrency')
    set('livingArea', num(b.floorSize?.value ?? b.floorSize), 'schema.org floorSize')
    set('rooms', num(b.numberOfRooms?.value ?? b.numberOfRooms), 'schema.org numberOfRooms')
    set('bedrooms', num(b.numberOfBedrooms), 'schema.org numberOfBedrooms')
    const a = b.address ?? b.contentLocation?.address
    if (a && typeof a === 'object') set('address', [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(' ')].filter(Boolean).join(', '), 'schema.org address')
    const g = b.geo ?? b.contentLocation?.geo
    if (g && num(g.latitude) !== null) set('geo', { lat: num(g.latitude), lng: num(g.longitude) }, 'schema.org geo')
    set('publishedAt', b.datePosted ?? b.datePublished, 'schema.org datePosted')
  }
  set('title', meta['og:title'] ?? meta['twitter:title'], 'Open Graph og:title')
  set('description', meta['og:description'] ?? meta.description, 'Open Graph og:description')
  set('price', num(meta['product:price:amount'] ?? meta['og:price:amount']), 'Open Graph Preis')
  set('currency', meta['product:price:currency'] ?? meta['og:price:currency'], 'Open Graph Währung')
  return { fields, text: visibleText(html) }
}
