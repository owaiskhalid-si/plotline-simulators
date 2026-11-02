export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="5" className="fill-foreground" />
      <path
        d="M5 16.5 9 12l3 2.5 6.5-8"
        fill="none"
        className="stroke-background"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="6.5" r="2.2" className="fill-brand" />
    </svg>
  );
}
