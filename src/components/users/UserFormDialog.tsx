"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  PERMISSION_GROUPS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PRESETS,
  type Permission,
  type Role,
} from "@/lib/permissions";
import type { User } from "@/types";

interface UserFormDialogProps {
  open: boolean;
  /** null = crear uno nuevo. */
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}

const ROLES: Role[] = ["super_admin", "coordinador", "asesor", "visitador"];

export function UserFormDialog({
  open,
  user,
  onClose,
  onSaved,
}: UserFormDialogProps) {
  const editing = user !== null;

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("asesor");
  const [permissions, setPermissions] = useState<Permission[]>(
    ROLE_PRESETS.asesor
  );
  const [saving, setSaving] = useState(false);

  // Al abrir, se cargan los datos del usuario que se va a editar, o los
  // valores por defecto si es uno nuevo.
  useEffect(() => {
    if (!open) return;
    if (user) {
      setName(user.name);
      setUsername(user.username);
      setRole(user.role);
      setPermissions(user.permissions);
    } else {
      setName("");
      setUsername("");
      setRole("asesor");
      setPermissions(ROLE_PRESETS.asesor);
    }
    setPassword("");
  }, [open, user]);

  /** Cambiar el rol reinicia los permisos a los tipicos de ese rol. */
  const cambiarRol = (nuevo: Role) => {
    setRole(nuevo);
    setPermissions(ROLE_PRESETS[nuevo]);
  };

  const alternar = (key: Permission) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      username,
      role,
      permissions,
    };
    if (password) payload.password = password;

    try {
      const res = await fetch(
        editing ? `/api/users/${user.id}` : "/api/users",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo guardar el usuario");
        return;
      }
      toast.success(editing ? "Usuario actualizado" : "Usuario creado");
      onSaved();
      onClose();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const superAdmin = role === "super_admin";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Editar a ${user.name}` : "Nuevo colaborador"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Cambia sus datos, sus credenciales o lo que puede hacer."
              : "Define su usuario, su clave inicial y a que secciones entra."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre y apellido</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Kelly Rodriguez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-username">Usuario</Label>
              <Input
                id="user-username"
                value={username}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. kelly"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-password">
                {editing ? "Clave nueva (opcional)" : "Clave inicial"}
              </Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? "Dejar vacio para no cambiarla" : "Minimo 8 caracteres"}
              />
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "Si la cambias, la persona vera un aviso para poner una propia."
                  : "Se le pedira cambiarla la primera vez que entre."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => v && cambiarRol(v as Role)}>
                <SelectTrigger className="cursor-pointer">
                  {/* Sin esto se veria "asesor" en vez de "Asesor comercial". */}
                  <SelectValue>
                    {(value: Role) => ROLE_LABELS[value] || "Selecciona"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Permisos</p>
              <p className="text-xs text-muted-foreground">
                {superAdmin
                  ? "El super administrador siempre tiene todo activo."
                  : "Marca solo lo que esta persona necesita."}
              </p>
            </div>

            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {group.title}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.permissions.map((p) => (
                    <label
                      key={p.key}
                      className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                        superAdmin
                          ? "opacity-60"
                          : "cursor-pointer hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
                        disabled={superAdmin}
                        checked={superAdmin || permissions.includes(p.key)}
                        onChange={() => alternar(p.key)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                !name.trim() ||
                !username.trim() ||
                (!editing && password.length < 8)
              }
              className="cursor-pointer"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
