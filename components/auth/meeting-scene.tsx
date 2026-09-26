// ภาพประกอบผลค้นหาตัวอย่าง

export type MeetingSceneVariant = "table" | "board" | "round";

const skin = ["#f1c7a3", "#c68b62", "#8d5a3b", "#e8b48f"];
const shirt = ["#e35205", "#3f6f5e", "#d9a441", "#7a5c99", "#b84a4a", "#4a6fa5"];

type PersonProps = { x: number; y: number; s: number; k: number; back?: boolean };

function Person({ x, y, s, k, back = false }: PersonProps) {
  return (
    <g>
      <rect x={x - 11} y={y + 9} width="22" height="22" rx="9" fill={shirt[s % shirt.length]} />
      <circle cx={x} cy={y} r="8" fill={back ? "#2b211c" : skin[k % skin.length]} />
      {!back && <path d={`M${x - 8} ${y - 1} a8 8 0 0 1 16 0 q-8 -5 -16 0z`} fill="#2b211c" />}
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 4} y={y} width="8" height="9" rx="2" fill="#b07a55" />
      <ellipse cx={x - 4} cy={y - 5} rx="3" ry="7" fill="#5f8f6a" transform={`rotate(-20 ${x - 4} ${y - 5})`} />
      <ellipse cx={x + 4} cy={y - 5} rx="3" ry="7" fill="#6fa37a" transform={`rotate(20 ${x + 4} ${y - 5})`} />
    </g>
  );
}

export function MeetingScene({
  variant,
  className,
}: {
  variant: MeetingSceneVariant;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 200 130" className={className} role="img" aria-label="ภาพทีมงานกำลังประชุม">
      <rect width="200" height="130" fill="#efe7dc" />
      <rect y="100" width="200" height="30" fill="#e2d6c6" />

      {variant === "table" && (
        <>
          <rect x="12" y="12" width="44" height="46" rx="2" fill="#c9d6dc" stroke="#ffffff" strokeWidth="3" />
          <line x1="34" y1="12" x2="34" y2="58" stroke="#ffffff" strokeWidth="2" />
          <rect x="112" y="16" width="56" height="30" rx="2" fill="#ffffff" stroke="#3a2f2a" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={118 + i * 8} y={34 - (i % 3) * 5} width="5" height={8 + (i % 3) * 5} fill="#e35205" fillOpacity={0.5 + (i % 2) * 0.4} />
          ))}
          <Person x={62} y={60} s={4} k={1} />
          <Person x={86} y={58} s={3} k={0} />
          <Person x={110} y={60} s={0} k={2} />
          <Person x={134} y={58} s={1} k={1} />
          <rect x="34" y="86" width="136" height="12" rx="3" fill="#8a5a3c" />
          <rect x="84" y="80" width="14" height="7" rx="1" fill="#ffffff" transform="rotate(-8 91 83)" />
          <Plant x={180} y={90} />
          <Person x={58} y={104} s={5} k={0} back />
          <Person x={132} y={104} s={5} k={3} back />
        </>
      )}

      {variant === "board" && (
        <>
          <rect x="44" y="12" width="112" height="62" rx="2" fill="#ffffff" stroke="#3a2f2a" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <rect
              key={i}
              x={52 + (i % 5) * 16}
              y={20 + Math.floor(i / 5) * 16}
              width="11"
              height="11"
              fill={["#f4c95d", "#9cc9a4", "#f39a6b", "#9fb6e0"][i % 4]}
            />
          ))}
          <path d="M54 60 q14 -8 28 0 t28 0 t28 -2" fill="none" stroke="#e35205" strokeWidth="2" />
          <line x1="150" y1="64" x2="168" y2="76" stroke="#2b211c" strokeWidth="3" strokeLinecap="round" />
          <Person x={172} y={70} s={0} k={1} />
          <Person x={62} y={100} s={1} k={2} back />
          <Person x={96} y={98} s={2} k={0} back />
          <Person x={130} y={100} s={4} k={1} back />
        </>
      )}

      {variant === "round" && (
        <>
          <line x1="100" y1="0" x2="100" y2="12" stroke="#3a2f2a" strokeWidth="1.5" />
          <path d="M90 18 h20 l-4 -6 h-12z" fill="#3a2f2a" />
          <ellipse cx="100" cy="21" rx="8" ry="3" fill="#f4c95d" fillOpacity="0.8" />
          <rect x="14" y="22" width="40" height="32" rx="2" fill="#ffffff" stroke="#3a2f2a" strokeWidth="1.5" />
          <circle cx="26" cy="38" r="6" fill="#9cc9a4" />
          <rect x="36" y="33" width="12" height="3" fill="#e35205" />
          <rect x="36" y="40" width="10" height="3" fill="#9fb6e0" />
          <rect x="150" y="18" width="36" height="40" rx="2" fill="#c9d6dc" stroke="#ffffff" strokeWidth="3" />
          <Person x={64} y={66} s={2} k={0} />
          <Person x={88} y={64} s={0} k={1} />
          <Person x={112} y={64} s={3} k={2} />
          <Person x={136} y={66} s={4} k={0} />
          <rect x="40" y="90" width="120" height="16" rx="8" fill="#e9e2d6" stroke="#8a7a6a" strokeWidth="1" />
          <rect x="76" y="84" width="16" height="9" rx="1" fill="#6b6560" />
          <rect x="108" y="84" width="16" height="9" rx="1" fill="#6b6560" />
          <rect x="94" y="96" width="12" height="7" fill="#ffffff" />
          <Plant x={26} y={96} />
        </>
      )}
    </svg>
  );
}
