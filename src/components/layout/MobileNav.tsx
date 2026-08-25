"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/permissions";
import { useSession } from "@/lib/session-context";

export function MobileNav() {
  const pathname = usePathname();
  const { user, can, isSuperAdmin } = useSession();

  const items = NAV_ITEMS.filter(
    (item) => can(item.permission) && (!item.superAdminOnly || isSuperAdmin)
  );

  return (
    <div className="flex flex-col h-full bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex h-16 items-center px-6 border-b border-[var(--sidebar-border)]">
        <Image
          src="/logo-renta-ya-blanco.png"
          alt="Renta Ya Motocicletas"
          width={720}
          height={124}
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

      {user && (
        <div className="px-3 py-4 border-t border-[var(--sidebar-border)]">
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[var(--sidebar-foreground)]/70 transition-colors cursor-pointer hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
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
        </div>
      )}
    </div>
  );
}
