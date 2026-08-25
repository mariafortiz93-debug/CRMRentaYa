"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, Menu, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { useSession } from "@/lib/session-context";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useSession();

  return (
    <>
      {/*
        Aviso mientras el colaborador siga usando la clave que le asignaron.
        Desaparece solo en cuanto la cambia desde "Mis datos".
      */}
      {user?.mustChangePassword && (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <KeyRound className="h-4 w-4 shrink-0" />
          <span>Todavia usas la clave que te asignaron. Cambiala por una tuya.</span>
          <Link
            href="/perfil"
            className={buttonVariants({
              variant: "outline",
              size: "xs",
              className: "cursor-pointer",
            })}
          >
            Cambiar clave
          </Link>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="md:hidden cursor-pointer" />}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <MobileNav />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contactos, deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>
        </div>

        {user && (
          <Link
            href="/perfil"
            className="hidden sm:block text-right cursor-pointer"
            title="Mis datos"
          >
            <span className="block text-sm font-medium leading-tight">
              {user.name}
            </span>
            <span className="block text-xs text-muted-foreground leading-tight">
              @{user.username}
            </span>
          </Link>
        )}

        <Button variant="ghost" size="icon" className="relative cursor-pointer">
          <Bell className="h-5 w-5" />
        </Button>
      </header>
    </>
  );
}
