"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const OBLIGATORIO = "Campo obligatorio";
const req = z.string().trim().min(1, OBLIGATORIO);

/** Captura inicial del prospecto: solo nombre y telefono. */
const createSchema = z.object({
  name: req,
  phone: z.string(),
  phone2: z.string(),
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  identificationNumber: z.string(),
  expeditionCity: z.string(),
  companionName: z.string(),
  motorcycleInterest: z.string(),
  company: z.string(),
  source: z.string(),
  notes: z.string(),
});

/**
 * Registro Online: todos los campos son obligatorios menos empresa y notas
 * (empresa porque muchos clientes no la tienen; notas es un comentario libre).
 */
const fullSchema = z.object({
  name: req,
  phone: req,
  phone2: req,
  address: req,
  city: req,
  neighborhood: req,
  identificationNumber: req,
  expeditionCity: req,
  companionName: req,
  motorcycleInterest: req,
  company: z.string(),
  source: req,
  notes: z.string(),
});

type ContactFormData = z.infer<typeof createSchema>;

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<ContactFormData> & { id?: string };
  /** If set, after a successful edit the contact is moved to this stage. */
  advanceToStageId?: string | null;
  /** Called after a successful save (and advance). */
  onSaved?: () => void;
}

export function ContactForm({ open, onClose, initialData, advanceToStageId, onSaved }: ContactFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(isEditing ? fullSchema : createSchema),
    defaultValues: {
      name: initialData?.name || "",
      phone: initialData?.phone || "",
      phone2: initialData?.phone2 || "",
      address: initialData?.address || "",
      city: initialData?.city || "",
      neighborhood: initialData?.neighborhood || "",
      identificationNumber: initialData?.identificationNumber || "",
      expeditionCity: initialData?.expeditionCity || "",
      companionName: initialData?.companionName || "",
      motorcycleInterest: initialData?.motorcycleInterest || "boxer_ct100_ks",
      company: initialData?.company || "",
      source: initialData?.source || "otro",
      notes: initialData?.notes || "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const url = isEditing
        ? `/api/contacts/${initialData!.id}`
        : "/api/contacts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al guardar");

      if (isEditing && advanceToStageId) {
        await fetch(`/api/contacts/${initialData!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: advanceToStageId }),
        });
        toast.success("Registro completado. Pasa a Agendar Visita.");
      } else {
        toast.success(isEditing ? "Contacto actualizado" : "Contacto creado");
      }
      onSaved?.();
      reset();
      onClose();
      router.refresh();
    } catch {
      toast.error("Error al guardar el contacto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Contacto" : "Nuevo Contacto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register("name")} placeholder="Nombre completo" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefono{isEditing ? " *" : ""}</Label>
            <Input id="phone" {...register("phone")} placeholder="+57 300 1234567" />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          {!isEditing && (
            <p className="text-xs text-muted-foreground">
              Los demas datos (direccion, cedula, moto de interes, etc.) se completan
              despues, cuando el contacto llegue a la etapa de Registro Online.
            </p>
          )}

          {isEditing && (
            <>
              <p className="text-xs text-muted-foreground">
                Todos los campos son obligatorios excepto Empresa y Notas.
              </p>

              <div className="space-y-2">
                <Label htmlFor="phone2">Telefono 2 (WhatsApp) *</Label>
                <Input id="phone2" {...register("phone2")} placeholder="+57 300 1234567" />
                {errors.phone2 && (
                  <p className="text-xs text-destructive">{errors.phone2.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Direccion *</Label>
                <Input id="address" {...register("address")} placeholder="Calle 123 #45-67" />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad *</Label>
                  <Input id="city" {...register("city")} placeholder="Ciudad" />
                  {errors.city && (
                    <p className="text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Barrio *</Label>
                  <Input id="neighborhood" {...register("neighborhood")} placeholder="Barrio" />
                  {errors.neighborhood && (
                    <p className="text-xs text-destructive">{errors.neighborhood.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="identificationNumber">No. de identificacion *</Label>
                  <Input id="identificationNumber" {...register("identificationNumber")} placeholder="Cedula" />
                  {errors.identificationNumber && (
                    <p className="text-xs text-destructive">
                      {errors.identificationNumber.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expeditionCity">Ciudad de expedicion *</Label>
                  <Input id="expeditionCity" {...register("expeditionCity")} placeholder="Ciudad de expedicion" />
                  {errors.expeditionCity && (
                    <p className="text-xs text-destructive">
                      {errors.expeditionCity.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companionName">Nombre del acompañante *</Label>
                <Input id="companionName" {...register("companionName")} placeholder="Nombre del acompañante" />
                {errors.companionName && (
                  <p className="text-xs text-destructive">{errors.companionName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" {...register("company")} placeholder="Nombre de la empresa" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Como supo de la empresa *</Label>
                  <Select
                    value={watch("source")}
                    onValueChange={(v) => v && setValue("source", v)}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="redes">Redes sociales</SelectItem>
                      <SelectItem value="referido">Referido</SelectItem>
                      <SelectItem value="volanteo">Volanteo</SelectItem>
                      <SelectItem value="concesionario">Concesionario</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moto de interes *</Label>
                  <Select
                    value={watch("motorcycleInterest")}
                    onValueChange={(v) => v && setValue("motorcycleInterest", v)}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boxer_ct100_ks">Boxer CT100 KS</SelectItem>
                      <SelectItem value="boxer_ct100_es">Boxer CT100 ES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" {...register("notes")} placeholder="Notas sobre el contacto..." rows={3} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
