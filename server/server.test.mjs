import { describe, expect, it } from 'vitest'
import { extractListing, jsonLdBlocks, visibleText } from './extract.mjs'
import { checkUrlShape, GuardError, isPrivateIp } from './guard.mjs'

describe('SSRF-Schutz', () => {
  it('erkennt interne Adressen', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '100.64.1.1']) expect(isPrivateIp(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '151.101.1.1', '2a00:1450:4001::1']) expect(isPrivateIp(ip)).toBe(false)
  })
  it('lehnt gefährliche URLs ab', () => {
    for (const u of ['file:///etc/passwd', 'ftp://example.com', 'http://localhost/admin', 'http://127.0.0.1/', 'https://user:pw@example.com', 'https://example.com:8080/', 'http://[::1]/', 'http://router.local/']) {
      expect(() => checkUrlShape(u)).toThrow(GuardError)
    }
    expect(checkUrlShape('https://www.example-makler.de/expose/1').hostname).toBe('www.example-makler.de')
  })
})

describe('HTML auslesen', () => {
  const html = `<html><head>
<meta property="og:title" content="Schöne Wohnung &amp; Garten">
<script type="application/ld+json">{"@type":"Apartment","name":"3 Zimmer am Park","numberOfRooms":3,"floorSize":{"value":"88"},"address":{"streetAddress":"Parkweg 3","postalCode":"50667","addressLocality":"Köln"},"offers":{"price":"1.150","priceCurrency":"EUR"}}</script>
<script>alert('nie ausführen')</script>
</head><body><nav>Menü</nav><p>Kaltmiete 1.150 €</p><p>Tel. 0221 123456</p></body></html>`
  it('liest schema.org und Open Graph ohne Skripte', () => {
    expect(jsonLdBlocks(html)).toHaveLength(1)
    const { fields, text } = extractListing(html)
    expect(fields.title.value).toBe('3 Zimmer am Park')
    expect(fields.rooms.value).toBe(3)
    expect(fields.livingArea.value).toBe(88)
    expect(fields.price.value).toBe(1150)
    expect(fields.address.value).toBe('Parkweg 3, 50667 Köln')
    expect(text).not.toContain('alert')
    expect(text).not.toContain('Menü')
  })
  it('entfernt Skripte aus dem sichtbaren Text', () => {
    expect(visibleText('<p>a</p><script>x()</script><style>.b{}</style><p>b</p>')).toBe('a\nb')
  })
})
