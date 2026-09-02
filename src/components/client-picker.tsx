import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Search } from "lucide-react";
import { gananciasLabel } from "@/components/ganancias-badge";
import { searchClients } from "@/lib/fn/clients";
import type { Client } from "@/lib/fn/types";
import { useMoneyDisplay } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: Client | null;
  onChange: (client: Client | null) => void;
  placeholder?: string;
};

export function ClientPicker({ value, onChange, placeholder = "Buscar cliente…" }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const { formatARS, maskName, maskCuit } = useMoneyDisplay();

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 180);
    return () => window.clearTimeout(t);
  }, [q]);

  const query = useQuery({
    queryKey: ["clients-search", debounced],
    queryFn: () => searchClients({ data: { q: debounced } }),
    enabled: open,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? maskName(value.name) : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o CUIT"
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {query.isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Buscando…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Sin resultados</p>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full flex-col rounded-lg px-3 py-2.5 text-left hover:bg-muted"
              >
                <span className="text-sm font-medium">{maskName(c.name)}</span>
                <span className="text-xs text-muted-foreground">
                  {maskCuit(c.cuit)} · saldo {formatARS(c.balance)} · {gananciasLabel(c.gananciasInMonthly)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
