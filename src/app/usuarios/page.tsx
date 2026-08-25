"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Power, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ROLE_LABELS } from "@/lib/permissions";
import { useSession } from "@/lib/session-context";
import type { User } from "@/types";

function formatDate(value: string | null): string {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function UsuariosPage() {
  const { user: current } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  // Evita que un re-render vuelva a disparar el mismo borrado. Ya paso antes
  // con el borrado de contactos y se perdieron datos.
  const deleting = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      setUsers(await res.json());
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alternarActivo = async (target: User) => {
    try {
      const res = await fetch(`/api/users/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo cambiar el estado");
        return;
      }
      toast.success(target.active ? "Usuario desactivado" : "Usuario activado");
      load();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    }
  };

  const confirmarBorrado = async () => {
    if (!toDelete || deleting.current) return;

    // Se captura el objetivo y se cierra el dialogo ANTES del await, para que
    // un re-render no vuelva a lanzar el borrado sobre otra fila.
    const target = toDelete;
    deleting.current = true;
    setToDelete(null);

    try {
      const res = await fetch(`/api/users/${target.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo eliminar");
        return;
      }
      toast.success(`Se elimino a ${target.name}`);
      load();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      deleting.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Quien entra al CRM y que puede hacer cada uno.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo colaborador
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
          ) : users.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="Todavia no hay colaboradores"
              description="Crea el primer usuario para que el equipo empiece a trabajar en el CRM."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Permisos</TableHead>
                    <TableHead>Ultimo ingreso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isMe = u.id === current?.id;
                    return (
                      <TableRow key={u.id} className={u.active ? "" : "opacity-60"}>
                        <TableCell className="font-medium">
                          {u.name}
                          {isMe && (
                            <Badge variant="outline" className="ml-2">
                              Tu
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          @{u.username}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              u.role === "super_admin" ? "default" : "secondary"
                            }
                          >
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.role === "super_admin"
                            ? "Todos"
                            : `${u.permissions.length} activos`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(u.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.active ? "secondary" : "outline"}>
                            {u.active ? "Activo" : "Desactivado"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Editar"
                              className="cursor-pointer"
                              onClick={() => {
                                setEditing(u);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={u.active ? "Desactivar" : "Activar"}
                              className="cursor-pointer"
                              disabled={isMe}
                              onClick={() => alternarActivo(u)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Eliminar"
                              className="cursor-pointer text-destructive"
                              disabled={isMe}
                              onClick={() => setToDelete(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserFormDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <Dialog open={toDelete !== null} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar a {toDelete?.name}?</DialogTitle>
            <DialogDescription>
              No podra volver a entrar al CRM. Los movimientos que ya hizo
              siguen apareciendo en Registros con su nombre.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarBorrado}
              className="cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
