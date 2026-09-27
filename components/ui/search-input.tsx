import { SearchIcon } from "@/components/icons";

type Props = { label: string; value: string; onChange: (value: string) => void; className?: string };

export function SearchInput({ label, value, onChange, className = "" }: Props) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="h-12 w-full rounded-xl border border-line bg-surface pl-12 pr-4 text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
    </label>
  );
}
