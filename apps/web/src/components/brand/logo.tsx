export function CarMark({ className = "h-9 w-9", draw = false }: { className?: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.35"
      />
      {draw ? (
        <>
          <path
            className="preload-car"
            d="M12 38.5 C14 32 18 28.5 24 27.2 L30 18.5 H44 L51 27.4 C55 28.2 57.5 31.5 58 38.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="preload-cabin"
            d="M30.5 18.8 L34.2 27.2 H48.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle className="preload-wheel" cx="22.5" cy="39.5" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle className="preload-wheel" cx="48.5" cy="39.5" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </>
      ) : (
        <>
          <path d="M11.5 39 C13.8 32.2 18.2 28.6 24.2 27.3 L30.2 18.2 H44.2 L51.4 27.5 C55.6 28.4 58 32 58.4 39 H54.8 C54.2 35.4 51.6 33.4 48.6 33.4 C45.6 33.4 43 35.4 42.4 39 H29.1 C28.5 35.4 25.9 33.4 22.9 33.4 C19.9 33.4 17.3 35.4 16.7 39 H11.5 Z" />
          <path
            d="M31 19.2 L34.4 27.1 H47.8 L43.6 19.2 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.55"
          />
          <circle cx="22.8" cy="39.2" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="22.8" cy="39.2" r="1.5" />
          <circle cx="48.6" cy="39.2" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="48.6" cy="39.2" r="1.5" />
        </>
      )}
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <CarMark />
      <span className="font-display text-[17px] font-medium tracking-[0.22em] uppercase">Auto Nex</span>
    </span>
  );
}
