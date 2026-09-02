import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function gananciasLabel(included: boolean) {
  return included ? "Ganancias en mensual" : "Ganancias en DDJJ";
}

export function GananciasBadge({
  included,
  className,
}: {
  included: boolean;
  className?: string;
}) {
  return (
    <Badge variant={included ? "secondary" : "outline"} className={cn(className)}>
      {gananciasLabel(included)}
    </Badge>
  );
}
