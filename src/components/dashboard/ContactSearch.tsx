"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, IdCard, Phone } from "lucide-react";
import { SOURCE_LABELS, VISIT_RESULT_CONFIG } from "@/lib/constants";
import type { LeadSource, VisitResult } from "@/types";

interface StageInfo {
  id: string;
  name: string;
  color: string;
}

interface Found {
  id: string;
  name: string;
  phone: string | null;
  identificationNumber: string | null;
  stageId: string | null;
  source: string;
  visitResult: string | null;
}

export function ContactSearch({ stages }: { stages: StageInfo[] }) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;
    // Pequeña espera para no consultar en cada tecla.
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/contacts?search=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setResults(Array.isArray(d) ? d : []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Con menos de 2 caracteres no se muestra nada, sin tocar el estado.
  const visibleResults = term.length < 2 ? [] : results;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Buscar cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe la cedula, el nombre o el telefono..."
            className="pl-9"
          />
        </div>

        {term.length >= 2 && (
          <div className="space-y-2">
            {searching && visibleResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Buscando...</p>
            ) : visibleResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No se encontro ningun cliente con &quot;{term}&quot;.
              </p>
            ) : (
              visibleResults.map((c) => {
                const stage = c.stageId ? stageById.get(c.stageId) : null;
                const vr = c.visitResult
                  ? VISIT_RESULT_CONFIG[c.visitResult as VisitResult]
                  : null;
                return (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{c.name.trim()}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {c.identificationNumber && (
                          <span className="inline-flex items-center gap-1">
                            <IdCard className="h-3 w-3" />
                            {c.identificationNumber}
                          </span>
                        )}
                        {c.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </span>
                        )}
                        <span>{SOURCE_LABELS[c.source as LeadSource] || c.source}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {vr && (
                        <span
                          className="text-[10px] font-semibold rounded px-1.5 py-0.5"
                          style={{ backgroundColor: vr.bgColor, color: vr.color }}
                        >
                          {vr.label}
                        </span>
                      )}
                      {stage ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin etapa</span>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
