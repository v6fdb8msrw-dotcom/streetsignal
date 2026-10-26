// Schutz gegen Server-Side Request Forgery (Master-Prompt Abschnitt 12).
// Erlaubt sind nur http/https auf Port 80/443 zu öffentlichen Adressen; jede Weiterleitung wird erneut geprüft.
import dns from 'node:dns/promises'
import net from 'node:net'

const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

function v4ToInt(ip) {
  return ip.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0
}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip)
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      return (n & mask) === (v4ToInt(base) & mask)
    })
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase()
    if (v === '::' || v === '::1') return true
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    // fc00::/7 (privat), fe80::/10 (link-local), ff00::/8 (multicast), 2001:db8::/32 (Doku)
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith('2001:db8')
  }
  return true
}

export class GuardError extends Error {}

/** Prüft eine URL formal. Wirft GuardError mit verständlicher Meldung. */
export function checkUrlShape(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new GuardError('Das ist keine gültige Adresse.')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new GuardError('Nur http- und https-Links sind erlaubt.')
  if (u.username || u.password) throw new GuardError('Links mit Zugangsdaten werden nicht abgerufen.')
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443) throw new GuardError('Nur die Standard-Ports 80 und 443 sind erlaubt.')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new GuardError('Interne Adressen werden nicht abgerufen.')
  if (net.isIP(host) && isPrivateIp(host)) throw new GuardError('Interne Adressen werden nicht abgerufen.')
  return u
}

/** Löst den Namen auf und liefert eine geprüfte öffentliche IP (gegen DNS-Rebinding: diese IP wird verwendet). */
export async function resolvePublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new GuardError('Interne Adressen werden nicht abgerufen.')
    return { address: host, family: net.isIPv6(host) ? 6 : 4 }
  }
  const all = await dns.lookup(host, { all: true }).catch(() => {
    throw new GuardError('Die Adresse konnte nicht aufgelöst werden.')
  })
  if (!all.length || all.some((a) => isPrivateIp(a.address))) throw new GuardError('Die Adresse zeigt auf ein internes Netz.')
  return all[0]
}
