type KmMarkProps = {
  variant: 'glow' | 'solid'
  className?: string
  title?: string
}

/**
 * Monograma "KM" em estilo circuito (nós/linhas), no lugar da logo BIOND.
 * "glow" = fundo escuro (sidebar/tema dark); "solid" = fundo claro (tema light).
 */
export function KmMark({ variant, className, title = 'KM' }: KmMarkProps) {
  const gradientId = variant === 'glow' ? 'km-mark-glow' : 'km-mark-solid'
  const strokeColor = `url(#${gradientId})`
  const nodeColor = variant === 'glow' ? '#eafff8' : '#0b1220'

  return (
    <svg
      viewBox="0 0 96 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="km-mark-glow" x1="0" y1="0" x2="96" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0bebf8" />
          <stop offset="1" stopColor="#006bb7" />
        </linearGradient>
        <linearGradient id="km-mark-solid" x1="0" y1="0" x2="96" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f8f66" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        {variant === 'glow' && (
          <filter id="km-mark-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      <g
        fill="none"
        stroke={strokeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={variant === 'glow' ? 'url(#km-mark-blur)' : undefined}
      >
        {/* K */}
        <path d="M14 12 V52" />
        <path d="M14 33 L32 12" />
        <path d="M14 33 L32 52" />

        {/* espinha central (nó de circuito compartilhado entre K e M) */}
        <path d="M45 8 V56" />

        {/* M */}
        <path d="M60 52 V12 L73 30 L86 12 V52" />
      </g>

      <g fill={strokeColor}>
        <circle cx="45" cy="8" r="4.5" />
        <circle cx="45" cy="32" r="4.5" />
        <circle cx="45" cy="56" r="4.5" />
      </g>
      <g fill={nodeColor} opacity="0.9">
        <circle cx="45" cy="8" r="1.8" />
        <circle cx="45" cy="32" r="1.8" />
        <circle cx="45" cy="56" r="1.8" />
      </g>
    </svg>
  )
}
