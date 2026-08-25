import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { backupFileName, createBackup, restoreBackup } from "@/lib/backup";

/** Tope del archivo que se acepta al restaurar: 100 MB. */
const MAX_BYTES = 100 * 1024 * 1024;

/** Descarga una copia completa de la base de datos. */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  try {
    const bytes = await createBackup();
    const nombre = backupFileName();

    logAction(auth.user, {
      action: "crear",
      entity: "respaldo",
      entityLabel: nombre,
      detail: `Descargo un respaldo de la base (${Math.round(
        bytes.length / 1024
      )} KB)`,
    });

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `No se pudo generar el respaldo: ${
          error instanceof Error ? error.message : "error desconocido"
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * Restaura un respaldo. Reemplaza TODO lo que hay ahora.
 *
 * Se exige el campo `confirmar=RESTAURAR` para que una peticion suelta no
 * pueda borrar la operacion por accidente.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envia el archivo de respaldo" },
      { status: 400 }
    );
  }

  if (form.get("confirmar") !== "RESTAURAR") {
    return NextResponse.json(
      { error: "Falta la confirmacion para restaurar" },
      { status: 400 }
    );
  }

  const file = form.get("archivo");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No llego ningun archivo" },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "El archivo esta vacio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo es demasiado grande" },
      { status: 413 }
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await restoreBackup(bytes);

    // Se registra despues de restaurar: el historial que trae el respaldo ya
    // reemplazo al anterior, asi que esta linea queda como la primera nueva.
    logAction(auth.user, {
      action: "importar",
      entity: "respaldo",
      entityLabel: file.name,
      detail: `Restauro un respaldo (${result.filas.contacts ?? 0} clientes, ${
        result.filas.users ?? 0
      } usuarios)`,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo restaurar el respaldo",
      },
      { status: 400 }
    );
  }
}
