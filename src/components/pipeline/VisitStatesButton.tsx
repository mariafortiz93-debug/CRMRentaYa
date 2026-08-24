"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { VisitStatesDialog } from "./VisitStatesDialog";

export function VisitStatesButton({ from, to }: { from?: string; to?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="cursor-pointer">
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Estados de visita
      </Button>
      <VisitStatesDialog open={open} onClose={() => setOpen(false)} from={from} to={to} />
    </>
  );
}
