/**
 * Lectura de archivos CSV que vienen de Excel.
 *
 * Lo usan las dos importaciones (contactos y estados de visita). Excel en
 * espanol guarda con `;` en vez de `,` y antepone un BOM al archivo, asi que
 * aqui se contemplan los dos separadores y se quita el BOM.
 */

/** Normaliza texto: sin acentos, minusculas, sin espacios sobrantes. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/** Parser de CSV que respeta comillas y saltos de linea dentro de campos. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Quita el BOM que Excel agrega y unifica los saltos de linea.
  const content = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Busca una columna por nombre, tolerando acentos, mayusculas, puntos y
 * espacios. Asi "No. Identificacion", "NO IDENTIFICACION" y "cedula" caen en
 * la misma columna.
 */
export function findColumn(header: string[], candidates: string[]): number {
  return header.findIndex((h) => {
    const n = normalize(h).replace(/[.\s_]/g, "");
    return candidates.some((c) => n === c || n.includes(c));
  });
}

/**
 * Invierte un mapa de valor -> etiqueta para poder leer de vuelta lo que se
 * exporto. El CSV lleva "Redes sociales", pero en la base se guarda "redes".
 */
export function labelToValue<T extends string>(
  labels: Record<T, string>,
  raw: string
): T | null {
  const target = normalize(raw);
  if (!target) return null;
  for (const [value, label] of Object.entries(labels) as [T, string][]) {
    if (normalize(label) === target || normalize(value) === target) return value;
  }
  return null;
}
