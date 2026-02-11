import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only images, PDFs, and Word documents are allowed.' },
        { status: 400 }
      );
    }
    const maxSize = 5 * 1024 * 1024; 
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;
    const workOrderNoRaw = formData.get('work_order_no') || formData.get('workOrderNo');
    const explicitWorkOrderNo = typeof workOrderNoRaw === 'string' && workOrderNoRaw.trim().length > 0
      ? workOrderNoRaw.trim()
      : null;
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const subDir = explicitWorkOrderNo || `${year}/${month}`;
    if (!explicitWorkOrderNo) {
      console.warn('Upload warning: work_order_no missing; saving under year/month folder', {
        fileType: file?.type,
        fileName: file?.name,
        fileSize: file?.size,
        subDir,
      });
    }
    const uploadDir = join(process.cwd(), 'public', 'uploads', subDir);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(bytes));
    await writeFile(filePath, buffer);
    const relativePath = `uploads/${subDir}/${fileName}`;
    return NextResponse.json({
      success: true,
      data: {
        path: relativePath,
        originalName: file.name,
        size: file.size,
        type: file.type
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 