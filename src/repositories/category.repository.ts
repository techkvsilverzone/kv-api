import { query, queryRows } from '../infrastructure/postgres/pool';

export interface CategoryRecord {
  name: string;
  parent: string | null;
}

export class CategoryRepository {
  public async findAll(): Promise<CategoryRecord[]> {
    // NULLS FIRST reproduces Mongo's `sort({ parent: 1 })`, which ordered
    // documents with a null parent (top-level categories) ahead of the rest.
    const rows = await queryRows<{ name: string; parent: string | null }>(
      'SELECT name, parent FROM categories ORDER BY parent ASC NULLS FIRST, name ASC',
    );
    return rows.map((row) => ({ name: row.name, parent: row.parent }));
  }

  /** Idempotent — creating a category (or subcategory, when `parent` is set) that already exists is a no-op. */
  public async create(name: string, parent: string | null = null): Promise<void> {
    // The unique index is on (name, COALESCE(parent, '')), so a plain
    // `ON CONFLICT (name, parent)` would not match it — the index expression
    // has to be restated for PostgreSQL to use it as the arbiter.
    await query(
      `INSERT INTO categories (name, parent)
       VALUES ($1, $2)
       ON CONFLICT (name, COALESCE(parent, '')) DO NOTHING`,
      [name, parent],
    );
  }

  public async delete(name: string, parent: string | null = null): Promise<void> {
    // `parent IS NOT DISTINCT FROM $2` matches null to null, which a plain
    // `parent = $2` would not.
    await query('DELETE FROM categories WHERE name = $1 AND parent IS NOT DISTINCT FROM $2', [
      name,
      parent,
    ]);
  }

  /** Removes every subcategory registered under `parent` (used when the parent category is deleted). */
  public async deleteChildren(parent: string): Promise<void> {
    await query('DELETE FROM categories WHERE parent = $1', [parent]);
  }
}
