import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageShell({
  title,
  intro,
  children,
  width = "md",
  actions,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  actions?: ReactNode;
}) {
  const w = { sm: "max-w-md", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-7xl" }[width];
  return (
    <div className={cn("mx-auto px-4 py-6 md:px-6 md:py-10", w)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
          {intro && <div className="mt-2 text-[15px] text-ink-muted">{intro}</div>}
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
