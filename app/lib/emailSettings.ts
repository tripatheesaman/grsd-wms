import { PoolClient } from 'pg';
import pool from '@/app/lib/database';

export interface EmailSettings {
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  completion_request_recipients: string;
  reminder_recipients: string;
  reminder_days: number;
  reminder_enabled: boolean;
}

const DEFAULT_SETTINGS: EmailSettings = {
  smtp_enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: '',
  smtp_password: '',
  from_email: '',
  from_name: 'WMS Notifications',
  completion_request_recipients: '',
  reminder_recipients: '',
  reminder_days: 2,
  reminder_enabled: true,
};

export async function ensureEmailSettingsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      smtp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      smtp_host TEXT NOT NULL DEFAULT '',
      smtp_port INTEGER NOT NULL DEFAULT 587,
      smtp_secure BOOLEAN NOT NULL DEFAULT FALSE,
      smtp_user TEXT NOT NULL DEFAULT '',
      smtp_password TEXT NOT NULL DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT 'WMS Notifications',
      completion_request_recipients TEXT NOT NULL DEFAULT '',
      reminder_recipients TEXT NOT NULL DEFAULT '',
      reminder_days INTEGER NOT NULL DEFAULT 2,
      reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT email_settings_single_row CHECK (id = 1)
    )
  `);

  await client.query(`
    INSERT INTO email_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getEmailSettings(client?: PoolClient): Promise<EmailSettings> {
  if (client) {
    await ensureEmailSettingsTable(client);
    const result = await client.query('SELECT * FROM email_settings WHERE id = 1');
    if (result.rows.length === 0) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...result.rows[0] };
  }

  const pooledClient = await pool.connect();
  try {
    await ensureEmailSettingsTable(pooledClient);
    const result = await pooledClient.query('SELECT * FROM email_settings WHERE id = 1');
    if (result.rows.length === 0) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...result.rows[0] };
  } finally {
    pooledClient.release();
  }
}

export function parseRecipients(recipients: string): string[] {
  return recipients
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
