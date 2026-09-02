import type { LedgerRow } from "@/lib/fn/types";
import { formatDateAR } from "@/lib/money";
import { useMoneyDisplay } from "@/lib/privacy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function paymentNote(p: NonNullable<LedgerRow["payment"]>) {
  return [p.paymentMethod, p.transferAccount, p.documentation.length ? p.documentation.join(", ") : null]
    .filter(Boolean)
    .join(" · ");
}

export function TxList({ rows, empty }: { rows: LedgerRow[]; empty: string }) {
  const { formatARS, maskText, maskName } = useMoneyDisplay();
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{maskText(row.concept)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateAR(row.date)}
              {row.clientName ? ` · ${maskName(row.clientName)}` : ""}
              {row.payment ? ` · ${paymentNote(row.payment)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "tabular-nums text-sm font-medium",
                row.type === "charge" ? "text-charge" : "text-payment",
              )}
            >
              {row.type === "charge" ? "+" : "−"}
              {formatARS(row.amount)}
            </p>
            <Badge variant={row.type === "charge" ? "charge" : "payment"} className="mt-1">
              {row.type === "charge" ? "Cargo" : "Pago"}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BalanceFigure({ amount }: { amount: number }) {
  const { formatARS } = useMoneyDisplay();
  const owed = amount > 0;
  const credit = amount < 0;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {owed ? "Saldo adeudado" : credit ? "A favor del cliente" : "Al día"}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl tabular-nums tracking-tight",
          owed && "text-charge",
          credit && "text-payment",
        )}
      >
        {formatARS(Math.abs(amount))}
      </p>
    </div>
  );
}

function MoneyCell({
  amount,
  kind,
  empty,
}: {
  amount: number;
  kind: "charge" | "payment" | "saldo";
  empty?: boolean;
}) {
  const { formatARS } = useMoneyDisplay();
  if (empty) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        kind === "charge" && "font-medium text-charge",
        kind === "payment" && "font-medium text-payment",
        kind === "saldo" && amount > 0 && "font-medium text-charge",
        kind === "saldo" && amount < 0 && "font-medium text-payment",
      )}
    >
      {formatARS(amount)}
    </span>
  );
}

export function StatementTable({ rows }: { rows: LedgerRow[] }) {
  const { maskText } = useMoneyDisplay();
  let running = 0;
  const lined = rows.map((row) => {
    running += row.type === "charge" ? row.amount : -row.amount;
    running = Math.round(running * 100) / 100;
    return { row, running };
  });
  const charges = rows.reduce((s, r) => s + (r.type === "charge" ? r.amount : 0), 0);
  const payments = rows.reduce((s, r) => s + (r.type === "payment" ? r.amount : 0), 0);
  const final = lined.at(-1)?.running ?? 0;

  if (rows.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">Todavía no hay movimientos en esta cuenta.</p>
    );
  }

  return (
    <table className="w-full min-w-3xl border-collapse text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border bg-card">
          <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha
          </th>
          <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concepto
          </th>
          <th className="border-l border-border bg-charge/5 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-charge">
            Cargos
          </th>
          <th className="bg-payment/5 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-payment">
            Pagos
          </th>
          <th className="border-l border-border bg-muted/70 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-foreground">
            Saldo
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-border">
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">—</td>
          <td className="px-3 py-2 italic text-muted-foreground">Saldo inicial</td>
          <td className="border-l border-border bg-charge/5 px-3 py-2 text-right text-muted-foreground">
            —
          </td>
          <td className="bg-payment/5 px-3 py-2 text-right text-muted-foreground">—</td>
          <td className="border-l border-border bg-muted/30 px-3 py-2 text-right">
            <MoneyCell amount={0} kind="saldo" />
          </td>
        </tr>
        {lined.map(({ row, running: saldo }) => (
          <tr key={row.id} className="border-b border-border hover:bg-muted/30">
            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
              {formatDateAR(row.date)}
            </td>
            <td className="px-3 py-2">
              <p className="max-w-md truncate font-medium">{maskText(row.concept)}</p>
              {row.payment ? (
                <p className="text-xs text-muted-foreground">{paymentNote(row.payment)}</p>
              ) : null}
            </td>
            <td className="border-l border-border bg-charge/5 px-3 py-2 text-right">
              <MoneyCell amount={row.amount} kind="charge" empty={row.type !== "charge"} />
            </td>
            <td className="bg-payment/5 px-3 py-2 text-right">
              <MoneyCell amount={row.amount} kind="payment" empty={row.type !== "payment"} />
            </td>
            <td className="border-l border-border bg-muted/30 px-3 py-2 text-right">
              <MoneyCell amount={saldo} kind="saldo" />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0">
        <tr className="border-t-2 border-border bg-card">
          <td colSpan={2} className="px-3 py-2.5 font-medium">
            Totales
          </td>
          <td className="border-l border-border bg-charge/5 px-3 py-2.5 text-right">
            <MoneyCell amount={charges} kind="charge" />
          </td>
          <td className="bg-payment/5 px-3 py-2.5 text-right">
            <MoneyCell amount={payments} kind="payment" />
          </td>
          <td className="border-l border-border bg-muted/70 px-3 py-2.5 text-right">
            <MoneyCell amount={final} kind="saldo" />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
