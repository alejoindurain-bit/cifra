import { Fragment, useState, type ChangeEvent } from "react";
import { Download, FileText, Upload, X, Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadTemplate, previewImport, commitImport } from "@/lib/fn/backup";
import { toast } from "sonner";

type ClientPreview = {
  row: number;
  name: string;
  status: "new" | "exists";
  existingId?: number;
  data: Record<string, unknown>;
};

type TransactionPreview = {
  row: number;
  date: string;
  clientName: string;
  concept: string;
  amount: number;
  type: "charge" | "payment";
  status: "ok" | "client_missing" | "duplicate";
  data: Record<string, unknown>;
};

type PreviewResponse = {
  clients: ClientPreview[];
  transactions: TransactionPreview[];
  errors: Array<{ sheet: string; row: number; reason: string }>;
};

type CommitResponse = {
  clientsInserted: number;
  clientsUpdated: number;
  clientsSkipped: number;
  transactionsInserted: number;
  transactionsSkipped: number;
  errors: Array<{ sheet: string; row: number; reason: string }>;
};

type ClientDecision = "update" | "skip";
type TransactionDecision = "create" | "skip";

export function ImportBackupForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
  const [expandedTx, setExpandedTx] = useState<Set<number>>(new Set());
  const [clientDecisions, setClientDecisions] = useState<Record<number, ClientDecision>>({});
  const [txDecisions, setTxDecisions] = useState<Record<number, TransactionDecision>>({});

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xls") && !f.name.endsWith(".xlsx")) {
      toast.error("El archivo debe ser .xls o .xlsx");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("El archivo no debe superar 5 MB");
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);
  };

  const readFileAsText = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(f);
    });
  };

  const runPreview = async () => {
    if (!file) return;
    setPreviewing(true);
    try {
      const xml = await readFileAsText(file);
      const res = await previewImport({ data: { xml } });
      setPreview(res as any);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al analizar el archivo");
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!file || !preview) return;
    setImporting(true);
    try {
      const xml = await readFileAsText(file);
      const res = await commitImport({
        data: {
          xml,
          clientDecisions: clientDecisions as Record<string, "update" | "skip">,
          txDecisions: txDecisions as Record<string, "create" | "skip">,
        },
      });
      setResult(res as any);
      toast.success(
        `Importación completada: ${res.clientsInserted} clientes insertados, ${res.clientsUpdated} actualizados, ${res.transactionsInserted} transacciones`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadTemplate();
      const r = res as { filename: string; xml: string };
      const blob = new Blob([r.xml], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar plantilla");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge variant="default" className="bg-green-100 text-green-800">Nuevo</Badge>;
      case "exists":
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Existe</Badge>;
      case "ok":
        return <Badge variant="default" className="bg-green-100 text-green-800">OK</Badge>;
      case "client_missing":
        return <Badge variant="default" className="bg-red-100 text-red-800">Falta cliente</Badge>;
      case "duplicate":
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Duplicado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!preview) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Importar respaldo</h1>
          <p className="text-muted-foreground mt-1">
            Subí un archivo Excel (.xls/.xlsx) con el mismo formato que el respaldo para cargar clientes y libro mayor.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Subir archivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center relative">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Arrastra tu archivo Excel aquí</p>
              <p className="text-sm text-muted-foreground mt-1">o hacé clic en el botón de abajo</p>
              <label className="mt-4 inline-block">
                <input
                  id="import-file-input"
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button variant="outline" type="button" asChild>
                  <span>Seleccionar archivo</span>
                </Button>
              </label>
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button onClick={runPreview} disabled={previewing}>
                    {previewing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analizando…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Analizar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between">
              <h3 className="font-medium">¿Nuevo estudio? Descarga la plantilla vacía</h3>
              <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                <Download className="h-4 w-4" />
                Descargar plantilla
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- PREVIEW VIEW ---
  const newClients = preview.clients.filter((c) => c.status === "new").length;
  const existingClients = preview.clients.filter((c) => c.status === "exists").length;
  const okTx = preview.transactions.filter((t) => t.status === "ok").length;
  const missingClientTx = preview.transactions.filter((t) => t.status === "client_missing").length;
  const duplicateTx = preview.transactions.filter((t) => t.status === "duplicate").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Vista previa de importación</h1>
        <p className="text-muted-foreground mt-1">
          Revisá los datos antes de importar. Los clientes existentes se pueden actualizar o saltar.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{newClients}</div>
            <div className="text-sm text-muted-foreground">Clientes nuevos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{existingClients}</div>
            <div className="text-sm text-muted-foreground">Clientes existentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{okTx}</div>
            <div className="text-sm text-muted-foreground">Transacciones OK</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{missingClientTx}</div>
            <div className="text-sm text-muted-foreground">Falta cliente</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{duplicateTx}</div>
            <div className="text-sm text-muted-foreground">Duplicadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      {preview.errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Errores ({preview.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto">
              <ul className="space-y-1 text-sm">
                {preview.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    {e.sheet} fila {e.row}: {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      {preview.clients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Clientes ({preview.clients.length})
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Plantilla
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Fila</th>
                    <th className="pb-2 pr-4">Nombre</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2 pr-4">Acción</th>
                    <th className="pb-2">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.clients.map((c) => (
                    <Fragment key={c.row}>
                    <tr>
                      <td className="py-2 pr-4">{c.row}</td>
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4">{getStatusBadge(c.status)}</td>
                      <td className="py-2 pr-4">
                        <Select
                          value={clientDecisions[c.row] || (c.status === "exists" ? "skip" : "update")}
                          onValueChange={(v) => {
                            setClientDecisions((prev) => ({ ...prev, [c.row]: v as ClientDecision }));
                          }}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Acción" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="update">Actualizar</SelectItem>
                            <SelectItem value="skip">Saltar</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedClients((prev) =>
                              prev.has(c.row)
                                ? new Set([...prev].filter((x) => x !== c.row))
                                : new Set([...prev, c.row]),
                            )
                          }
                        >
                          {expandedClients.has(c.row) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    {expandedClients.has(c.row) && (
                      <tr>
                        <td colSpan={5} className="p-4 bg-muted">
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(c.data, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      {preview.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transacciones ({preview.transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Fila</th>
                    <th className="pb-2 pr-4">Fecha</th>
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4">Concepto</th>
                    <th className="pb-2 pr-4">Monto</th>
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Estado</th>
                    <th className="pb-2 pr-4">Acción</th>
                    <th className="pb-2">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.transactions.map((t) => (
                    <Fragment key={t.row}>
                    <tr className={t.status === "client_missing" ? "bg-red-50" : ""}>
                      <td className="py-2 pr-4">{t.row}</td>
                      <td className="py-2 pr-4">{t.date}</td>
                      <td className="py-2 pr-4 font-medium">{t.clientName}</td>
                      <td className="py-2 pr-4">{t.concept}</td>
                      <td className="py-2 pr-4 text-right">{t.amount.toLocaleString("es-AR")}</td>
                      <td className="py-2 pr-4">
                        {t.type === "charge" ? (
                          <Badge variant="secondary">Cargo</Badge>
                        ) : (
                          <Badge variant="default">Pago</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4">{getStatusBadge(t.status)}</td>
                      <td className="py-2 pr-4">
                        <Select
                          value={txDecisions[t.row] || "create"}
                          onValueChange={(v) => {
                            setTxDecisions((prev) => ({ ...prev, [t.row]: v as TransactionDecision }));
                          }}
                          disabled={t.status === "client_missing"}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="Acción" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Crear</SelectItem>
                            <SelectItem value="skip">Saltar</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setExpandedTx((prev) =>
                              prev.has(t.row)
                                ? new Set([...prev].filter((x) => x !== t.row))
                                : new Set([...prev, t.row]),
                            )
                          }
                        >
                          {expandedTx.has(t.row) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    {expandedTx.has(t.row) && (
                      <tr>
                        <td colSpan={9} className="p-4 bg-muted">
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(t.data, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => setFile(null)}>
          <X className="h-4 w-4" />
          Cambiar archivo
        </Button>
        <Button onClick={runImport} disabled={importing} className="w-full sm:w-auto">
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importando…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Importar {newClients + existingClients} clientes + {okTx} transacciones
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              Importación completada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{result.clientsInserted}</div>
                <div className="text-sm text-green-600">Clientes insertados</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{result.clientsUpdated}</div>
                <div className="text-sm text-blue-600">Clientes actualizados</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{result.clientsSkipped}</div>
                <div className="text-sm text-gray-600">Clientes saltados</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{result.transactionsInserted}</div>
                <div className="text-sm text-green-600">Transacciones insertadas</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{result.transactionsSkipped}</div>
                <div className="text-sm text-yellow-600">Transacciones saltadas</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-700 mb-2">Errores ({result.errors.length})</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e.sheet} fila {e.row}: {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}