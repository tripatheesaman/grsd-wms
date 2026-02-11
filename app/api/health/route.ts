import { NextResponse } from 'next/server';
import pool from '@/app/lib/database';
export async function GET() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
