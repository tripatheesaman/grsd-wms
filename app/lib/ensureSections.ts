import type { PoolClient } from 'pg';

let schemaEnsured = false;
let migrationPromise: Promise<void> | null = null;

async function runMigration(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE section_type AS ENUM ('workshops', 'nem');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS section section_type NOT NULL DEFAULT 'workshops';
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS section section_type NOT NULL DEFAULT 'workshops';
    ALTER TABLE technicians ADD COLUMN IF NOT EXISTS section section_type NOT NULL DEFAULT 'workshops';
    ALTER TABLE units ADD COLUMN IF NOT EXISTS section section_type NOT NULL DEFAULT 'workshops';
  `);

  // spare_parts.unit FK references units(name) via units_name_key — drop before changing units uniqueness.
  await client.query(`
    ALTER TABLE spare_parts DROP CONSTRAINT IF EXISTS fk_spare_parts_unit;
  `);

  await client.query(`
    ALTER TABLE units DROP CONSTRAINT IF EXISTS units_name_key;
    DROP INDEX IF EXISTS units_name_key;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS units_section_name_idx ON units (section, name);
  `);

  await client.query(`
    ALTER TABLE technicians DROP CONSTRAINT IF EXISTS technicians_staff_id_key;
    DROP INDEX IF EXISTS technicians_staff_id_key;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS technicians_section_staff_id_idx ON technicians (section, staff_id);
  `);

  await client.query(`
    ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_work_order_no_key;
    DROP INDEX IF EXISTS work_orders_work_order_no_key;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS work_orders_section_no_idx ON work_orders (section, work_order_no);
  `);

  await client.query(`
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completion_review_stage VARCHAR(20);
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS incharge_reviewed_by INTEGER;
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS incharge_reviewed_at TIMESTAMP;
    ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS incharge_rejection_reason TEXT;
  `);

  await client.query(`
    UPDATE work_orders
    SET completion_review_stage = 'admin'
    WHERE status = 'completion_requested' AND completion_review_stage IS NULL;
  `);

  await client.query(`
    DO $$ BEGIN
      ALTER TABLE action_date_technicians ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END $$;
  `);

  await client.query(`
    DO $$ BEGIN
      ALTER TABLE action_technicians ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END $$;
  `);
}

/**
 * Applies section schema once per process. Uses a dedicated connection so callers
 * can release their own client without interrupting migration.
 */
export async function ensureSectionSchema(client?: PoolClient): Promise<void> {
  void client;
  if (schemaEnsured) return;

  if (!migrationPromise) {
    migrationPromise = (async () => {
      const { default: pool } = await import('./database');
      const migrationClient = await pool.connect();
      try {
        await runMigration(migrationClient);
        schemaEnsured = true;
      } catch (err) {
        migrationPromise = null;
        throw err;
      } finally {
        migrationClient.release();
      }
    })();
  }

  await migrationPromise;
}
