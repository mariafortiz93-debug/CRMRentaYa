"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/permissions";
import { useSession } from "@/lib/session-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, can, isSuperAdmin, refresh } = useSession();

  const items = NAV_ITEMS.filter(
    (item) => can(item.permission) && (!item.superAdminOnly || isSuperAdmin)
  );

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] min-h-screen">
      <div className="flex h-16 items-center px-6 border-b border-[var(--sidebar-border)]">
        <Image
          src="/logo-renta-ya-blanco.png"
          alt="Renta Ya Motocicletas"
          width={720}
          height={124}
          priority
          className="h-8 w-auto"
        />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                  : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-[var(--sidebar-border)] space-y-1">
        {user && (
          <Link
            href="/perfil"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-pointer",
              pathname === "/perfil"
                ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
                : "text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
            )}
          >
            <UserRound className="h-5 w-5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="block truncate text-xs opacity-70">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </Link>
        )}

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            await refresh();
            router.replace("/login");
            router.refresh();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--sidebar-foreground)]/70 transition-colors cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Salir
        </button>
      </div>
    </aside>
  );
}
