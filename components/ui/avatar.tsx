import { initials } from "@/lib/format";

const colors = ["#b8435a", "#0e7c86", "#3f7d4f", "#7a5c99", "#a65a14", "#2457c5"];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

export function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12 text-base" : "size-6 text-[0.65rem]";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${sizeClass}`}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initials(name)}
    </span>
  );
}
