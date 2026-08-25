"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn } from "lucide-react";
import { useSession } from "@/lib/session-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo ingresar");
        return;
      }
      // Hay que releer la sesion antes de navegar: el menu y los permisos
      // salen del contexto, que se carga una sola vez y no se entera del
      // cambio de cookie por si solo. Sin esto se entra con el menu vacio.
      await refresh();
      router.replace(searchParams.get("destino") || "/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Clave</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu clave"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full cursor-pointer"
          >
            <LogIn className="h-4 w-4 mr-2" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-[var(--sidebar)] p-6">
      <Image
        src="/logo-renta-ya-blanco.png"
        alt="Renta Ya Motocicletas"
        width={720}
        height={124}
        priority
        className="h-12 w-auto"
      />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-xs text-white/50">CRM de gestion comercial</p>
    </div>
  );
}
