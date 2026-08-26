/**
 * Primera fila de una consulta, o `undefined` si no hay ninguna.
 *
 * En SQLite una consulta de una sola fila terminaba en un metodo que devolvia
 * el registro directamente. Postgres siempre devuelve un arreglo, asi que esos
 * casos pasaron a ser `await one(db.select()...)`. El ayudante existe para que
 * las rutas se sigan leyendo igual de bien y para no repetir `[0]` en ciento y
 * pico de sitios.
 */
export async function one<T>(query: PromiseLike<T[]>): Promise<T | undefined> {
  const rows = await query;
  return rows[0];
}

/**
 * Igual que `one()`, pero para consultas que por definicion devuelven fila:
 * un INSERT o un UPDATE con `.returning()`. Si no devuelve nada es que algo
 * fallo de verdad, y es mejor enterarse que seguir con un `undefined`.
 */
export async function oneOrFail<T>(query: PromiseLike<T[]>): Promise<T> {
  const row = (await query)[0];
  if (!row) throw new Error("La consulta no devolvio ninguna fila");
  return row;
}
