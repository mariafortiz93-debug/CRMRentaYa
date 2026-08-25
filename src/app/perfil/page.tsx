"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/session-context";
import {
  PERMISSION_GROUPS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  hasPermission,
} from "@/lib/permissions";

export default function PerfilPage() {
  const { user, loading, refresh } = useSession();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [savingDatos, setSavingDatos] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [savingClave, setSavingClave] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUsername(user.username);
  }, [user]);

  const guardarDatos = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDatos(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudieron guardar los datos");
        return;
      }
      await refresh();
      toast.success("Datos actualizados");
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSavingDatos(false);
    }
  };

  const cambiarClave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== repeatPassword) {
      toast.error("La clave nueva y su repeticion no coinciden");
      return;
    }

    setSavingClave(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo cambiar la clave");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      await refresh();
      toast.success("Clave actualizada");
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSavingClave(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">No hay sesion activa.</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mis datos</h1>
        <p className="text-sm text-muted-foreground">
          Aqui cambias tu nombre, tu usuario y tu clave.
        </p>
      </div>

      {user.mustChangePassword && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Todavia estas usando la clave que te asignaron. Cambiala por una que
            solo conozcas tu.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4" />
            Datos de la cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardarDatos} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre y apellido</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como apareces en los registros"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={username}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="con el que inicias sesion"
                />
                <p className="text-xs text-muted-foreground">
                  Solo letras, numeros, punto, guion y guion bajo.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingDatos || !name.trim() || !username.trim()}
              className="cursor-pointer"
            >
              <Save className="h-4 w-4 mr-2" />
              {savingDatos ? "Guardando..." : "Guardar datos"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Cambiar la clave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={cambiarClave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Clave actual</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Clave nueva</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Minimo 8 caracteres.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repeatPassword">Repetir la clave nueva</Label>
                <Input
                  id="repeatPassword"
                  type="password"
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={savingClave || !currentPassword || !newPassword}
              className="cursor-pointer"
            >
              <KeyRound className="h-4 w-4 mr-2" />
              {savingClave ? "Cambiando..." : "Cambiar clave"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Mi rol y mis permisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Badge>{ROLE_LABELS[user.role]}</Badge>
            <p className="text-sm text-muted-foreground">
              {ROLE_DESCRIPTIONS[user.role]}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {group.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.permissions.map((p) => (
                    <Badge
                      key={p.key}
                      variant={hasPermission(user, p.key) ? "default" : "outline"}
                      className={
                        hasPermission(user, p.key) ? "" : "text-muted-foreground"
                      }
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Los permisos los cambia el super administrador desde la seccion
            Usuarios.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
