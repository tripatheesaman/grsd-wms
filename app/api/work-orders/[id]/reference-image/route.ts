import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/database';
import { ApiResponse, WorkOrder } from '@/app/types';
import { requireRoleAtLeast } from '@/app/api/middleware';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const workOrderId = parseInt(id);
  if (isNaN(workOrderId)) {
    return NextResponse.json({ success: false, error: 'Invalid work order ID' }, { status: 400 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('reference_image') as File;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Invalid file type. Only images and PDFs are allowed.' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      const currentResult = await client.query(
        'SELECT reference_document FROM work_orders WHERE id = $1',
        [workOrderId]
      );
      if (currentResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }
      const currentReference = currentResult.rows[0].reference_document;
      if (currentReference) {
        const oldFilePath = join(process.cwd(), 'public', currentReference);
        if (existsSync(oldFilePath)) {
          try {
            await unlink(oldFilePath);
          } catch (deleteError) {
            console.error('Failed to delete old reference file:', deleteError);
          }
        }
      }
      const fileExtension = file.name.split('.').pop();
      const fileName = `work-order-${workOrderId}-ref-${Date.now()}.${fileExtension}`;
      const uploadPath = join(process.cwd(), 'public', 'uploads', 'references');
      const filePath = join(uploadPath, fileName);
      const publicPath = `uploads/references/${fileName}`;
      const { mkdir } = await import('fs/promises');
      try {
        await mkdir(uploadPath, { recursive: true });
      } catch (mkdirError) {
        console.error('Failed to create upload directory:', mkdirError);
        return NextResponse.json({ success: false, error: 'Failed to create upload directory' }, { status: 500 });
      }
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);
      const updateResult = await client.query(
        'UPDATE work_orders SET reference_document = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [publicPath, workOrderId]
      );
      if (updateResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Failed to update work order' }, { status: 500 });
      }
      const updatedWorkOrder = updateResult.rows[0];
      return NextResponse.json<ApiResponse<WorkOrder>>({
        success: true,
        data: updatedWorkOrder,
        message: 'Reference image updated successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating reference image:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRoleAtLeast(request, 'admin');
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const workOrderId = parseInt(id);
  if (isNaN(workOrderId)) {
    return NextResponse.json({ success: false, error: 'Invalid work order ID' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    const currentResult = await client.query(
      'SELECT reference_document FROM work_orders WHERE id = $1',
      [workOrderId]
    );
    if (currentResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }
    const currentReference = currentResult.rows[0].reference_document;
    if (!currentReference) {
      return NextResponse.json({ success: false, error: 'No reference document to delete' }, { status: 400 });
    }
    const filePath = join(process.cwd(), 'public', currentReference);
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (deleteError) {
        console.error('Failed to delete reference file:', deleteError);
      }
    }
    const updateResult = await client.query(
      'UPDATE work_orders SET reference_document = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [workOrderId]
    );
    if (updateResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to update work order' }, { status: 500 });
    }
    const updatedWorkOrder = updateResult.rows[0];
    return NextResponse.json<ApiResponse<WorkOrder>>({
      success: true,
      data: updatedWorkOrder,
      message: 'Reference image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reference image:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
