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
  actualizados: number;
  sinCambios: number;
  noEncontrados: string[];
  estadoInvalido: string[];
}

interface VisitStatesDialogProps {
  open: boolean;
  onClose: () => void;
  /** Rango de fechas activo, para que la plantilla salga del mismo periodo. */
  from?: string;
  to?: string;
}

export function VisitStatesDialog({ open, onClose, from, to }: VisitStatesDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = () => {
    const params = new URLSearchParams({ type: "visit-states" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.open(`/api/export?${params.toString()}`);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/import-visit-states", {
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
      toast.success(`${data.actualizados} estados actualizados`);
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
          <DialogTitle>Estados de visita</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">1. Descarga la plantilla</p>
            <p className="text-sm text-muted-foreground">
              Trae los clientes con visita y una columna <strong>Estado Visita</strong> para
              completar con Aprobado, Negado o Sin proceso.
            </p>
            <Button variant="outline" onClick={downloadTemplate} className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              Descargar plantilla
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">2. Sube el archivo completado</p>
            <p className="text-sm text-muted-foreground">
              Los clientes se identifican por su <strong>No. de identificacion</strong>. Si
              pones un motivo, se guarda para los negados y sin proceso.
            </p>
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
                {result.actualizados} clientes actualizados
              </div>
              {result.sinCambios > 0 && (
                <p className="text-muted-foreground">
                  {result.sinCambios} filas sin estado (se omitieron)
                </p>
              )}
              {result.noEncontrados.length > 0 && (
                <div className="text-amber-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.noEncontrados.length} cedulas no encontradas
                  </div>
                  <p className="text-xs mt-1 break-words">
                    {result.noEncontrados.slice(0, 10).join(", ")}
                    {result.noEncontrados.length > 10 ? "…" : ""}
                  </p>
                </div>
              )}
              {result.estadoInvalido.length > 0 && (
                <div className="text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {result.estadoInvalido.length} con estado no reconocido
                  </div>
                  <p className="text-xs mt-1 break-words">
                    {result.estadoInvalido.slice(0, 5).join(" · ")}
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
