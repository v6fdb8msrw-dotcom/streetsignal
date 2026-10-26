/** Bildmarke: Standortnadel mit Signalwellen */
export function Logo({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const fg = light ? '#F7F5EE' : '#183F32'
  const bg = light ? 'rgba(247,245,238,0.14)' : '#DCE9D7'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill={bg} />
      <path d="M20 9c-4.4 0-8 3.4-8 7.7 0 5.8 8 13.3 8 13.3s8-7.5 8-13.3C28 12.4 24.4 9 20 9z" fill={fg} />
      <circle cx="20" cy="16.8" r="2.8" fill={bg} />
      <path d="M9.5 11.5a12.5 12.5 0 0 0 0 12" stroke={fg} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".55" />
      <path d="M30.5 11.5a12.5 12.5 0 0 1 0 12" stroke={fg} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark ${light ? 'light' : ''}`}>
      <Logo size={30} light={light} />
      <span>StreetSignal</span>
    </span>
  )
}
