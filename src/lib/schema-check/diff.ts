import type { ColumnInfo, SchemaSnapshot } from "./schema.functions";

export type ColumnDiff = {
  column: string;
  changes: Array<{ field: keyof ColumnInfo; expected: unknown; actual: unknown }>;
};

export type TableDiff = {
  table: string;
  status: "missing" | "extra" | "changed";
  missingColumns?: ColumnInfo[];
  extraColumns?: ColumnInfo[];
  changedColumns?: ColumnDiff[];
};

export type IndexDiff = {
  key: string;
  status: "missing" | "extra" | "changed";
  expected?: string;
  actual?: string;
};

export type SchemaDiffResult = {
  tables: TableDiff[];
  indexes: IndexDiff[];
  ok: boolean;
};

export function diffSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiffResult {
  const tableDiffs: TableDiff[] = [];
  const expectedTables = Object.keys(expected.tables);
  const actualTables = Object.keys(actual.tables);

  for (const t of expectedTables) {
    if (!(t in actual.tables)) {
      tableDiffs.push({ table: t, status: "missing" });
      continue;
    }
    const exp = expected.tables[t];
    const act = actual.tables[t];
    const expByName = new Map(exp.map((c) => [c.column, c]));
    const actByName = new Map(act.map((c) => [c.column, c]));

    const missingColumns: ColumnInfo[] = [];
    const extraColumns: ColumnInfo[] = [];
    const changedColumns: ColumnDiff[] = [];

    for (const [name, ec] of expByName) {
      const ac = actByName.get(name);
      if (!ac) {
        missingColumns.push(ec);
        continue;
      }
      const changes: ColumnDiff["changes"] = [];
      (["type", "nullable", "default"] as const).forEach((f) => {
        if ((ec[f] ?? null) !== (ac[f] ?? null)) {
          changes.push({ field: f, expected: ec[f], actual: ac[f] });
        }
      });
      if (changes.length) changedColumns.push({ column: name, changes });
    }
    for (const [name, ac] of actByName) {
      if (!expByName.has(name)) extraColumns.push(ac);
    }

    if (missingColumns.length || extraColumns.length || changedColumns.length) {
      tableDiffs.push({
        table: t,
        status: "changed",
        missingColumns: missingColumns.length ? missingColumns : undefined,
        extraColumns: extraColumns.length ? extraColumns : undefined,
        changedColumns: changedColumns.length ? changedColumns : undefined,
      });
    }
  }
  for (const t of actualTables) {
    if (!(t in expected.tables)) tableDiffs.push({ table: t, status: "extra" });
  }

  const indexDiffs: IndexDiff[] = [];
  const expIdx = expected.indexes ?? {};
  const actIdx = actual.indexes ?? {};
  for (const k of Object.keys(expIdx)) {
    if (!(k in actIdx)) indexDiffs.push({ key: k, status: "missing", expected: expIdx[k] });
    else if (expIdx[k] !== actIdx[k])
      indexDiffs.push({ key: k, status: "changed", expected: expIdx[k], actual: actIdx[k] });
  }
  for (const k of Object.keys(actIdx)) {
    if (!(k in expIdx)) indexDiffs.push({ key: k, status: "extra", actual: actIdx[k] });
  }

  return { tables: tableDiffs, indexes: indexDiffs, ok: tableDiffs.length === 0 && indexDiffs.length === 0 };
}
