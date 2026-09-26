type LogoProps = {
  tone?: "light" | "dark";
};

export function Logo({ tone = "dark" }: LogoProps) {
  const titleColor = tone === "light" ? "text-hero-ink" : "text-ink";
  const subtitleColor = tone === "light" ? "text-brand-soft/80" : "text-ink-muted";

  return (
    <div className="flex items-center gap-3">
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
        <rect width="46" height="46" rx="11" fill="var(--brand)" />
        <rect x="10" y="10" width="18" height="18" rx="5" fill="#ffffff" fillOpacity="0.45" />
        <rect x="16" y="16" width="20" height="20" rx="5" fill="#ffffff" />
        <circle cx="26" cy="26" r="4.5" fill="var(--brand)" />
      </svg>
      <div className="leading-tight">
        <p className={`text-2xl font-bold tracking-tight ${titleColor}`}>CAMP</p>
        <p className={`text-sm font-semibold ${subtitleColor}`}>Cloud Asset Management</p>
      </div>
    </div>
  );
}
