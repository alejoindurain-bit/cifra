import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { PrivacyProvider } from "@/lib/privacy";
import { ThemeProvider } from "@/lib/theme";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <PrivacyProvider>
          {children}
          <Toaster />
        </PrivacyProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
