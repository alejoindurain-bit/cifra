import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { ImportBackupForm } from "@/components/import-backup-form";

export const Route = createFileRoute("/importar")({ component: ImportarRoute });

function ImportarRoute() {
  return (
    <AuthGate role="owner">
      <AppShell title="Importar respaldo" description="Cargar clientes y libro mayor desde un Excel">
        <ImportBackupForm />
      </AppShell>
    </AuthGate>
  );
}