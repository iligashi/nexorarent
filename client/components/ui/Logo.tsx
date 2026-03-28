'use client';

/**
 * Nexora Rent a Car — Premium Logo
 * Shield emblem with gold accents and luxury typography
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Outer shield shape */}
      <path
        d="M60 4L108 24V62C108 88.5 87.6 110.4 60 116C32.4 110.4 12 88.5 12 62V24L60 4Z"
        fill="url(#shield-gradient)"
        stroke="url(#gold-stroke)"
        strokeWidth="2"
      />
      {/* Inner shield */}
      <path
        d="M60 12L100 28V62C100 84.5 83 103.6 60 108.8C37 103.6 20 84.5 20 62V28L60 12Z"
        fill="url(#inner-gradient)"
      />
      {/* Gold accent line - top */}
      <path
        d="M60 18L94 32V62C94 81 80 97.8 60 102.6C40 97.8 26 81 26 62V32L60 18Z"
        fill="none"
        stroke="url(#gold-accent)"
        strokeWidth="0.8"
        opacity="0.6"
      />
      {/* N letter - bold geometric */}
      <path
        d="M42 44V78H49.5V56.5L70.5 78H78V44H70.5V65.5L49.5 44H42Z"
        fill="url(#letter-gradient)"
      />
      {/* Top diamond ornament */}
      <path d="M60 22L64 26L60 30L56 26Z" fill="url(#gold-accent)" />
      {/* Bottom accent line */}
      <line x1="44" y1="84" x2="76" y2="84" stroke="url(#gold-accent)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Small dots beside bottom line */}
      <circle cx="40" cy="84" r="1.5" fill="#D4A853" />
      <circle cx="80" cy="84" r="1.5" fill="#D4A853" />

      <defs>
        <linearGradient id="shield-gradient" x1="60" y1="4" x2="60" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1C1C28" />
          <stop offset="1" stopColor="#0A0A0F" />
        </linearGradient>
        <linearGradient id="gold-stroke" x1="12" y1="4" x2="108" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8D5A3" />
          <stop offset="0.3" stopColor="#D4A853" />
          <stop offset="0.6" stopColor="#F0E2B6" />
          <stop offset="1" stopColor="#C49B3D" />
        </linearGradient>
        <linearGradient id="inner-gradient" x1="60" y1="12" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14141E" />
          <stop offset="1" stopColor="#0C0C14" />
        </linearGradient>
        <linearGradient id="gold-accent" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0E2B6" />
          <stop offset="0.5" stopColor="#D4A853" />
          <stop offset="1" stopColor="#C49B3D" />
        </linearGradient>
        <linearGradient id="letter-gradient" x1="42" y1="44" x2="78" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5ECD4" />
          <stop offset="0.4" stopColor="#D4A853" />
          <stop offset="1" stopColor="#B8912F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoFull({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="hidden sm:flex flex-col">
        <span
          className="font-outfit font-bold text-lg leading-none tracking-[3px]"
          style={{
            background: 'linear-gradient(135deg, #F5ECD4 0%, #D4A853 40%, #C49B3D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          NEXORA
        </span>
        <span
          className="text-[10px] tracking-[4px] uppercase font-medium mt-0.5"
          style={{
            background: 'linear-gradient(90deg, #A0A0B8 0%, #D4A853 50%, #A0A0B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Rent a Car
        </span>
      </div>
    </div>
  );
}

export function LogoFullLight({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={size} />
      <div className="flex flex-col">
        <span
          className="font-outfit font-bold text-lg leading-none tracking-[3px]"
          style={{
            background: 'linear-gradient(135deg, #F5ECD4 0%, #D4A853 40%, #C49B3D 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          NEXORA
        </span>
        <span
          className="text-[10px] tracking-[4px] uppercase font-medium mt-0.5"
          style={{
            background: 'linear-gradient(90deg, #A0A0B8 0%, #D4A853 50%, #A0A0B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Rent a Car
        </span>
      </div>
    </div>
  );
}
