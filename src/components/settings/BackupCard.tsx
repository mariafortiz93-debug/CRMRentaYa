"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, HardDriveDownload, Upload, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session-context";

/**
 * Respaldos de toda la informacion. Solo para el super administrador.
 *
 * Toda la base del CRM es un solo archivo, asi que respaldar es bajar ese
 * archivo y guardarlo en un sitio seguro.
 */
export function BackupCard() {
  const { isSuperAdmin, refresh } = useSession();
  const [descargando, setDescargando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isSuperAdmin) return null;

  const descargar = async () => {
    setDescargando(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo generar el respaldo");
        return;
      }

      // El nombre viene en la cabecera para que coincida con la fecha del
      // servidor y no con la del computador de quien lo descarga.
      const disposition = res.headers.get("Content-Disposition") || "";
      const nombre =
        /filename="([^"]+)"/.exec(disposition)?.[1] || "crm-respaldo.json";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Respaldo descargado: ${nombre}`);
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setDescargando(false);
    }
  };

  const restaurar = async () => {
    if (!archivo || texto !== "RESTAURAR") return;

    setRestaurando(true);
    setConfirmOpen(false);

    try {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("confirmar", "RESTAURAR");

      const res = await fetch("/api/backup", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo restaurar");
        return;
      }

      toast.success(
        `Restaurado: ${data.filas?.contacts ?? 0} clientes y ${
          data.filas?.users ?? 0
        } usuarios`
      );

      // El respaldo trae sus propios usuarios: puede que el actual ya no exista
      // o tenga otros permisos, asi que hay que releer la sesion.
      await refresh();
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setRestaurando(false);
      setArchivo(null);
      setTexto("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4" />
            Respaldos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Toda la informacion del CRM (clientes, visitas, gestiones, usuarios e
            historial) vive en un solo archivo. Descargalo cada cierto tiempo y
            guardalo fuera del servidor.
          </p>

          <Button
            onClick={descargar}
            disabled={descargando}
            className="cursor-pointer"
          >
            <Download className="h-4 w-4 mr-2" />
            {descargando ? "Preparando..." : "Descargar respaldo"}
          </Button>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Restaurar un respaldo</p>
            <p className="text-sm text-muted-foreground">
              Reemplaza <strong>toda</strong> la informacion actual por la del
              archivo. Antes de hacerlo, el servidor guarda una copia de lo que
              hay ahora, por si te equivocas de archivo.
            </p>

            <Input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="cursor-pointer"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            />

            <Button
              variant="outline"
              disabled={!archivo || restaurando}
              onClick={() => setConfirmOpen(true)}
              className="cursor-pointer"
            >
              <Upload className="h-4 w-4 mr-2" />
              {restaurando ? "Restaurando..." : "Restaurar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(v) => !v && setConfirmOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-destructive" />
              Restaurar y reemplazar todo?
            </DialogTitle>
            <DialogDescription>
              Los clientes, visitas, gestiones y usuarios de ahora se cambian por
              los del archivo <strong>{archivo?.name}</strong>. Si el respaldo no
              incluye tu usuario, tendras que volver a entrar con uno que si
              este.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirmar-restaurar">
              Escribe RESTAURAR para confirmar
            </Label>
            <Input
              id="confirmar-restaurar"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="RESTAURAR"
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={texto !== "RESTAURAR"}
              onClick={restaurar}
              className="cursor-pointer"
            >
              Restaurar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
