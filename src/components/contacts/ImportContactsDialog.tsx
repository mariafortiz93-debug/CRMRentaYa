"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  creados: number;
  actualizados: number;
  omitidos: number;
  sinFuente: number;
  etapaDesconocida: string[];
  duplicados: string[];
}

interface ImportContactsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportContactsDialog({ open, onClose }: ImportContactsDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/import-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error al importar");
        return;
      }
      setResult(data as ImportResult);
      toast.success(
        `${data.creados} contactos nuevos y ${data.actualizados} actualizados`
      );
      router.refresh();
    } catch {
      toast.error("No se pudo leer el archivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contactos</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Sube un archivo con la <strong>misma estructura</strong> que genera el
            boton Exportar. El archivo que descargas se puede volver a subir tal
            cual, sin cambiarle nada.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Si no tienes el archivo</p>
            <p className="text-sm text-muted-foreground">
              Descarga la exportacion actual y usala como plantilla: completa las
              filas en Excel y vuelve a subirla.
            </p>
            <Button
              variant="outline"
              onClick={() => window.open("/api/export?type=contacts")}
              className="cursor-pointer"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar plantilla
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Sube el archivo</p>
            <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
              <li>
                Se identifica a cada persona por su <strong>No. de
                identificacion</strong>; si la fila no la trae, por el telefono.
              </li>
              <li>
                Si el cliente ya existe se <strong>actualiza</strong>; si no,
                se crea. No se duplica a nadie.
              </li>
              <li>
                Las <strong>celdas vacias no borran</strong> lo que ya esta
                guardado en el CRM.
              </li>
              <li>
                Si el archivo trae la columna <strong>Etapa</strong>, cada
                cliente vuelve a esa columna del pipeline. Si no, entra como
                Prospecto.
              </li>
            </ul>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="cursor-pointer"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Importando..." : "Seleccionar archivo CSV"}
            </Button>
          </div>

          {result && (
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                {result.creados} contactos nuevos · {result.actualizados}{" "}
                actualizados
              </div>
              {result.omitidos > 0 && (
                <p className="text-muted-foreground">
                  {result.omitidos} filas sin nombre (se omitieron)
                </p>
              )}
              {result.sinFuente > 0 && (
                <div className="text-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.sinFuente} filas sin fuente reconocida
                  </div>
                  <p className="text-xs mt-1">
                    Los nuevos quedaron como &quot;Otro&quot;. Revisa la columna
                    &quot;Como supo de la empresa&quot;.
                  </p>
                </div>
              )}
              {result.duplicados.length > 0 && (
                <div className="text-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.duplicados.length} con cedula o telefono repetido
                  </div>
                  <p className="text-xs mt-1">
                    Se crearon aparte para no pisar al que ya estaba. Revisalos:
                  </p>
                  <p className="text-xs mt-1 break-words">
                    {result.duplicados.slice(0, 5).join(" · ")}
                  </p>
                </div>
              )}
              {result.etapaDesconocida.length > 0 && (
                <div className="text-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Etapas no reconocidas
                  </div>
                  <p className="text-xs mt-1 break-words">
                    {result.etapaDesconocida.slice(0, 5).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose} className="cursor-pointer">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
