import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PublicSectionProps = {
  children: ReactNode;
  className?: string;
  tone?: "deep" | "deep-soft" | "ink" | "mist";
};

type PublicSectionIntroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

type PublicGlassPanelProps = {
  children: ReactNode;
  className?: string;
};

type PublicPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  align?: "left" | "center";
  children?: ReactNode;
  stats?: Array<{ label: string; value: string }>;
};

const sectionToneClass: Record<NonNullable<PublicSectionProps["tone"]>, string> = {
  deep: "bg-[linear-gradient(180deg,#081220_0%,#091523_52%,#0b1726_100%)] text-white",
  "deep-soft":
    "bg-[linear-gradient(180deg,rgba(8,18,32,0.96)_0%,rgba(11,23,38,0.98)_100%)] text-white",
  ink: "bg-[linear-gradient(180deg,#0c1829_0%,#112033_100%)] text-white",
  mist: "bg-[linear-gradient(180deg,#0f1d2e_0%,#132538_100%)] text-white",
};

export function PublicSection({
  children,
  className,
  tone = "deep",
}: PublicSectionProps) {
  return (
    <section className={cn("relative overflow-hidden", sectionToneClass[tone], className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-gold/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-[160px]" />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}

export function PublicSectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: PublicSectionIntroProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "",
        className,
      )}
    >
      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-gold-light/88 sm:tracking-[0.38em]">
        {eyebrow}
      </p>
      <h2 className="mt-4 max-w-[16ch] font-heading text-[clamp(2.1rem,8vw,3.55rem)] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[clamp(2.8rem,5vw,4.15rem)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 max-w-2xl font-body text-sm leading-7 text-white/80 sm:mt-5 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PublicGlassPanel({
  children,
  className,
}: PublicGlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[1.2rem] border border-white/16 bg-white/[0.08] p-4 shadow-[0_32px_80px_-42px_rgba(4,14,29,0.96)] backdrop-blur-2xl sm:rounded-[1.55rem] sm:p-5 lg:rounded-[1.75rem] lg:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PublicPageHero({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt = "",
  align = "left",
  children,
  stats,
}: PublicPageHeroProps) {
  return (
    <section className="relative overflow-hidden pt-20 sm:pt-24 lg:pt-28">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#06111e_0%,#081625_44%,#0b1726_100%)]" />

      {imageSrc ? (
        <div className="absolute inset-0">
          <Image
            alt={imageAlt}
            className="object-cover opacity-34"
            fill
            priority
            sizes="100vw"
            src={imageSrc}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,27,0.92)_0%,rgba(5,15,27,0.84)_100%)] sm:bg-[linear-gradient(90deg,rgba(5,15,27,0.96)_0%,rgba(5,15,27,0.78)_42%,rgba(5,15,27,0.88)_100%)]" />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[18%] h-64 w-64 rounded-full bg-gold/10 blur-[130px]" />
        <div className="absolute right-[12%] top-[24%] h-72 w-72 rounded-full bg-blue-500/12 blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:px-10 lg:pb-16">
        <div
          className={cn(
            "max-w-[56rem]",
            align === "center" ? "mx-auto text-center" : "",
          )}
        >
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-gold-light/92 sm:text-[0.72rem] sm:tracking-[0.4em]">
            {eyebrow}
          </p>
          <h1 className="mt-4 max-w-[15ch] font-heading text-[clamp(2.25rem,8vw,4.75rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="mt-4 max-w-[38rem] font-body text-sm leading-7 text-white/82 sm:mt-5 sm:text-base">
            {description}
          </p>
        </div>

        {children ? <div className="mt-8 sm:mt-10">{children}</div> : null}

        {stats?.length ? (
          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
            {stats.map((stat) => (
              <PublicGlassPanel key={stat.label} className="p-4 sm:p-5">
                <p className="text-[0.68rem] uppercase tracking-[0.22em] text-white/60 sm:tracking-[0.28em]">
                  {stat.label}
                </p>
                <p className="mt-2 font-heading text-[1.6rem] font-semibold text-white sm:text-[1.9rem]">
                  {stat.value}
                </p>
              </PublicGlassPanel>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PublicGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10", className)}>
      {children}
    </div>
  );
}
