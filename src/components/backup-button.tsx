import { Download } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportBackup, exportClients, exportLedger } from "@/lib/fn/backup";
import { clientsSheet, downloadWorkbook, ledgerSheet, stamp } from "@/lib/excel";

type Kind = "clients" | "ledger" | "full";

const LABELS: Record<Kind, { idle: string; busy: string }> = {
  clients: { idle: "Excel clientes", busy: "Preparando…" },
  ledger: { idle: "Excel mayor", busy: "Preparando…" },
  full: { idle: "Respaldo completo", busy: "Preparando…" },
};

export function BackupButton({
  kind,
  variant = "outline",
  compact,
}: {
  kind: Kind;
  variant?: "outline" | "default" | "secondary";
  compact?: boolean;
}) {
  const mut = useMutation({
    mutationFn: async () => {
      if (kind === "clients") {
        const rows = await exportClients();
        downloadWorkbook(stamp("cifra-clientes"), [clientsSheet(rows)]);
        return rows.length;
      }
      if (kind === "ledger") {
        const rows = await exportLedger();
        downloadWorkbook(stamp("cifra-mayor"), [ledgerSheet(rows)]);
        return rows.length;
      }
      const data = await exportBackup();
      downloadWorkbook(stamp("cifra-respaldo"), [
        clientsSheet(data.clients),
        ledgerSheet(data.ledger),
      ]);
      return data.clients.length + data.ledger.length;
    },
    onSuccess: (n) => {
      toast.success(
        n === 0 ? "El archivo está vacío, no hay nada que respaldar todavía." : "Descarga lista. Guardala en tu computadora.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const label = mut.isPending ? LABELS[kind].busy : compact ? "Excel" : LABELS[kind].idle;
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
      aria-label={LABELS[kind].idle}
    >
      <Download className="h-4 w-4" />
      <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
    </Button>
  );
}
