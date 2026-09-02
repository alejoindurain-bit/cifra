import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8 shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="6" className="fill-primary" />
      <rect x="8" y="8" width="4" height="16" className="fill-primary-foreground" />
      <rect x="14" y="8" width="10" height="4" className="fill-primary-foreground" />
      <rect x="14" y="14" width="10" height="4" className="fill-primary-foreground" />
      <rect x="14" y="20" width="8" height="4" className="fill-primary-foreground" />
    </svg>
  );
}
