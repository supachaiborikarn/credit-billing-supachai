import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // 'start' or 'end'
        const nozzle = formData.get('nozzle') as string; // 1-4
        const date = formData.get('date') as string;
        const stationId = formData.get('stationId') as string || 'unknown';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
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
        const publicId = `meters/${stationId}/${date}/nozzle${nozzle}_${type}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            public_id: publicId,
            folder: 'credit-billing',
            overwrite: true,
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
