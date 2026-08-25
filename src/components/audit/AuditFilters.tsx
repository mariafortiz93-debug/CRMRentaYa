"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AUDIT_ACTION_CONFIG, AUDIT_CHART_ACTIONS } from "@/lib/constants";

/** Valor del desplegable cuando no se filtra. Los Select no aceptan "". */
const TODOS = "__todos__";

interface AuditFiltersProps {
  colaboradores: Array<{ id: string; name: string }>;
  userId: string;
  action: string;
}

/** Desplegables de colaborador y tipo de accion. Escriben en la direccion. */
export function AuditFilters({
  colaboradores,
  userId,
  action,
}: AuditFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== TODOS) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Colaborador</Label>
        <Select
          value={userId || TODOS}
          onValueChange={(v) => v && apply("userId", v)}
        >
          <SelectTrigger className="w-[200px] cursor-pointer">
            {/* Sin esto el desplegable mostraria el valor crudo del filtro. */}
            <SelectValue>
              {(value: string) =>
                colaboradores.find((c) => c.id === value)?.name || "Todos"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {colaboradores.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Tipo de movimiento</Label>
        <Select
          value={action || TODOS}
          onValueChange={(v) => v && apply("action", v)}
        >
          <SelectTrigger className="w-[190px] cursor-pointer">
            <SelectValue>
              {(value: string) =>
                value === "ingreso"
                  ? "Entradas al CRM"
                  : AUDIT_ACTION_CONFIG[value]?.label || "Todos"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {AUDIT_CHART_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {AUDIT_ACTION_CONFIG[a]?.label || a}
              </SelectItem>
            ))}
            <SelectItem value="ingreso">Entradas al CRM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
