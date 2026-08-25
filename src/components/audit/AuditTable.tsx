"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { AUDIT_ACTION_CONFIG, AUDIT_ENTITY_LABELS } from "@/lib/constants";
import type { AuditLog } from "@/types";

interface AuditTableProps {
  logs: AuditLog[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Lista de cada movimiento hecho en el CRM, del mas reciente al mas viejo. */
export function AuditTable({ logs }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin movimientos"
        description="No hay acciones registradas con los filtros seleccionados."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Fecha</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Accion</TableHead>
            <TableHead>Sobre</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const config = AUDIT_ACTION_CONFIG[log.action];
            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  {log.userName}
                </TableCell>
                <TableCell>
                  <span
                    className="inline-flex h-5 items-center rounded-4xl px-2 text-xs font-medium"
                    style={{
                      color: config?.color || "#475569",
                      backgroundColor: config?.bgColor || "#f1f5f9",
                    }}
                  >
                    {config?.label || log.action}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="text-muted-foreground">
                    {AUDIT_ENTITY_LABELS[log.entity] || log.entity}
                  </span>
                  {log.entityLabel && (
                    <span className="ml-1.5 font-medium">{log.entityLabel}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.detail || "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
