import { Logo } from "@/components/brand/logo";
import { SparkleIcon } from "@/components/icons";
import { MeetingScene, type MeetingSceneVariant } from "./meeting-scene";

const demoResults: { variant: MeetingSceneVariant; score: number }[] = [
  { variant: "table", score: 97 },
  { variant: "board", score: 94 },
  { variant: "round", score: 91 },
];

// แผงซ้ายหน้า Login
export function LoginHero() {
  return (
    <section className="hidden flex-col justify-center bg-hero px-14 py-16 lg:flex xl:px-20">
      <Logo tone="light" />

      <h1 className="mt-12 max-w-xl text-5xl font-extrabold leading-[1.1] tracking-tight text-hero-ink xl:text-[3.4rem]">
        Every asset your organization owns — one search away.
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-hero-ink-muted">
        Upload, organize and find documents and images by name, tag or meaning.
        <br />
        ค้นหาไฟล์ได้ด้วยความหมาย ไม่ต้องจำชื่อไฟล์
      </p>

      <div
        className="mt-12 max-w-2xl rounded-3xl border border-hero-line bg-hero-raised p-6"
        aria-label="ตัวอย่างการค้นหาด้วยความหมาย"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-4">
          <SparkleIcon className="size-5 shrink-0 text-brand" />
          <span className="flex-1 truncate text-ink">รูปภาพทีมงานกำลังประชุม</span>
          <span className="rounded-lg bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">
            Semantic
          </span>
        </div>

        <ul className="mt-4 grid grid-cols-3 gap-3">
          {demoResults.map(({ variant, score }) => (
            <li key={variant} className="overflow-hidden rounded-2xl bg-surface">
              <div className="relative">
                <MeetingScene variant={variant} className="block h-auto w-full" />
                <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-sm font-bold text-ink shadow-sm">
                  <SparkleIcon className="size-3.5 text-brand" />
                  {score}%
                </span>
              </div>
              <div className="space-y-2 px-3 py-3" aria-hidden="true">
                <div className="h-2 w-3/4 rounded-full bg-line-soft" />
                <div className="h-2 w-2/5 rounded-full bg-line-soft" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
