import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  formatARS as formatARSRaw,
  formatUSD as formatUSDRaw,
  formatMonths as formatMonthsRaw,
  honorarioSummary as honorarioSummaryRaw,
} from "@/lib/money";

const STORAGE_KEY = "cifra-hide-balances";
const MASK_ARS = "$ xxxx";
const MASK_USD = "USD xxxx";
const MASK_NAME = "······";
const MASK_CUIT = "••-••••••••-•";
const MASK_MONTHS = "x,x";

type PrivacyCtx = {
  hidden: boolean;
  toggle: () => void;
};

const PrivacyContext = createContext<PrivacyCtx>({
  hidden: false,
  toggle: () => {},
});

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readStored());
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function useMoneyDisplay() {
  const { hidden } = usePrivacy();
  return useMemo(
    () => ({
      hidden,
      formatARS: (n: number) => (hidden ? MASK_ARS : formatARSRaw(n)),
      formatUSD: (n: number) => (hidden ? MASK_USD : formatUSDRaw(n)),
      honorarioSummary: (c: {
        fixedFee: boolean;
        monthlyModules: number;
        monthlyAmount: number;
      }) => {
        const raw = honorarioSummaryRaw(c);
        if (hidden && raw.kind === "amount") {
          return { ...raw, label: `${MASK_ARS} / mes` };
        }
        return raw;
      },
      compact: (n: number) =>
        hidden ? "xxxx" : new Intl.NumberFormat("es-AR", { notation: "compact" }).format(n),
      formatMonths: (n: number) => (hidden ? MASK_MONTHS : formatMonthsRaw(n)),
      maskName: (name?: string | null) => (hidden ? MASK_NAME : name?.trim() || "—"),
      maskCuit: (cuit?: string | null, empty = "Sin CUIT") =>
        hidden ? MASK_CUIT : cuit?.trim() || empty,
      maskText: (s: string) =>
        hidden
          ? s
              .replace(/\$\s*[\d.]+(?:,\d{1,2})?/g, MASK_ARS)
              .replace(/US\$\s*[\d.]+(?:,\d{1,2})?/gi, MASK_USD)
          : s,
    }),
    [hidden],
  );
}
