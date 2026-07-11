import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireApiSession } from '@/lib/api-auth';
import { canAccessStation } from '@/lib/auth-utils';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
    try {
        const auth = await requireApiSession();
        if (auth.response) return auth.response;

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // 'start' or 'end' or 'transfer'
        const nozzle = formData.get('nozzle') as string; // 1-4
        const date = formData.get('date') as string;
        const stationId = (formData.get('stationId') as string) || 'unknown';
        const requestedShiftId = formData.get('shiftId');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File is too large' }, { status: 413 });
        }

        if (!['start', 'end', 'transfer'].includes(type)) {
            return NextResponse.json({ error: 'Upload type is invalid' }, { status: 400 });
        }

        if ((type === 'start' || type === 'end') && !['1', '2', '3', '4'].includes(nozzle)) {
            return NextResponse.json({ error: 'Meter nozzle is invalid' }, { status: 400 });
        }

        if ((type === 'start' || type === 'end') && !canAccessStation(auth.user, stationId)) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์อัปโหลดรูปของสถานีนี้' }, { status: 403 });
        }

        // Check Cloudinary config
        if (!process.env.CLOUDINARY_CLOUD_NAME) {
            return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const dataUri = `data:${file.type};base64,${base64}`;

        // Generate public_id for organization
        const timestamp = Date.now();
        const shiftScope = typeof requestedShiftId === 'string' && requestedShiftId.trim()
            ? requestedShiftId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
            : 'unassigned';
        const publicId = type === 'transfer'
            ? `transfers/${stationId}/${date}/slip_${timestamp}`
            : `meters/${stationId}/${date}/${shiftScope}/nozzle${nozzle}_${type}_${timestamp}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            public_id: publicId,
            folder: 'credit-billing',
            overwrite: false,
            resource_type: 'image',
            transformation: [
                { width: 1200, height: 1200, crop: 'limit' }, // Limit size to save space
                { quality: 'auto:good' }, // Auto optimize quality
                { format: 'webp' } // Convert to WebP for smaller size
            ]
        });

        return NextResponse.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
    }
}
