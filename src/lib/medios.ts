import { PAYMENT_METHODS, TRANSFER_ACCOUNTS } from "@/lib/constants";
import type { EstudioPaymentMethod } from "@/lib/fn/types";

export function mapMedioToPayment(medio: EstudioPaymentMethod): {
  paymentMethod: string;
  transferAccount: string | null;
} {
  if (medio.kind === "transferencia" || medio.kind === "mercado_pago") {
    return { paymentMethod: "Transferencia", transferAccount: medio.name };
  }
  if (medio.kind === "dolares") return { paymentMethod: "Dólares", transferAccount: null };
  if (medio.kind === "cheque") return { paymentMethod: "Cheque", transferAccount: null };
  return { paymentMethod: medio.name, transferAccount: null };
}

export function transferAccountNames(methods: EstudioPaymentMethod[]): string[] {
  return methods
    .filter((m) => m.active && (m.kind === "transferencia" || m.kind === "mercado_pago"))
    .map((m) => m.name);
}

export function paymentMethodLabels(methods: EstudioPaymentMethod[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const m of methods.filter((x) => x.active)) {
    const mapped = mapMedioToPayment(m);
    if (!seen.has(mapped.paymentMethod)) {
      seen.add(mapped.paymentMethod);
      labels.push(mapped.paymentMethod);
    }
  }
  return labels;
}

export function cajaMedios(methods: EstudioPaymentMethod[] | undefined | null): {
  labels: string[];
  accounts: string[];
} {
  const active = (methods ?? []).filter((m) => m.active);
  const labels = paymentMethodLabels(active);
  const accounts = transferAccountNames(active);
  return {
    labels: labels.length ? labels : [...PAYMENT_METHODS],
    accounts: accounts.length ? accounts : [...TRANSFER_ACCOUNTS],
  };
}
