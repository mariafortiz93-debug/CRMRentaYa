"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Search, Users, Download, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/constants";
import { SOURCE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import type { Contact, LeadSource, PipelineStage } from "@/types";

interface ContactsTableProps {
  contacts: Contact[];
  stages: PipelineStage[];
  /** Se llama tras eliminar, para que la pagina recargue la lista. */
  onChanged?: () => void;
}

export function ContactsTable({ contacts, stages, onChanged }: ContactsTableProps) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);

  const handleDelete = async () => {
    // Doble candado: si ya hay un borrado en curso, o el dialogo ya se cerro,
    // no se dispara otra vez. Evita que un re-render encadene borrados.
    if (!toDelete || inFlight.current) return;
    inFlight.current = true;

    const target = toDelete;
    // Cerrar el dialogo ANTES del await: a partir de aqui `toDelete` es null,
    // asi que cualquier clic fantasma cae en el guard de arriba.
    setToDelete(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/contacts/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success(`"${target.name.trim()}" eliminado`);
      onChanged?.();
    } catch {
      toast.error("Error al eliminar el contacto");
    } finally {
      setDeleting(false);
      inFlight.current = false;
    }
  };

  const filtered = contacts.filter((c) => {
    return (
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.identificationNumber?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase())
    );
  });

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No hay contactos"
        description="Agrega tu primer contacto para comenzar a gestionar tu pipeline de ventas."
        actionLabel="Agregar contacto"
        onAction={() => router.push("/contacts?new=true")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, telefono o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/export?type=contacts")}
            className="cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden sm:table-cell">Etapa</TableHead>
              <TableHead className="hidden sm:table-cell">Empresa</TableHead>
              <TableHead className="hidden md:table-cell">Fuente</TableHead>
              <TableHead className="hidden md:table-cell">Score</TableHead>
              <TableHead className="hidden lg:table-cell">Fecha</TableHead>
              <TableHead className="w-10 text-right">Accion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((contact) => (
              <TableRow
                key={contact.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/contacts/${contact.id}`)}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.phone || "Sin telefono"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {contact.stageId && stageById.get(contact.stageId) ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: stageById.get(contact.stageId)!.color }}
                      />
                      {stageById.get(contact.stageId)!.name}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {contact.company || "-"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {SOURCE_LABELS[contact.source as LeadSource] || contact.source}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${contact.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {contact.score}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {formatDate(contact.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(contact);
                    }}
                    className="p-1.5 rounded hover:bg-destructive/10 cursor-pointer"
                    title={`Eliminar ${contact.name.trim()}`}
                    aria-label={`Eliminar ${contact.name.trim()}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} de {contacts.length} contactos
      </p>

      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar contacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Vas a eliminar a <strong>{toDelete?.name.trim()}</strong>. Se borran
              tambien sus actividades y visitas agendadas.
            </p>
            <p className="text-sm text-destructive">
              Esta accion no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setToDelete(null)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? "Eliminando..." : "Si, eliminar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
