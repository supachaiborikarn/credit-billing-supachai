import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// Verify LINE signature (simplified check)
function verifySignature(body: string, signature: string): boolean {
    if (!LINE_CHANNEL_SECRET) return false;
    const crypto = require('crypto');
    const hash = crypto
        .createHmac('SHA256', LINE_CHANNEL_SECRET)
        .update(body)
        .digest('base64');
    return hash === signature;
}

// Download image content from LINE
async function downloadLineImage(messageId: string): Promise<Buffer> {
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// Upload buffer to Cloudinary
async function uploadToCloudinary(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        cloudinary.uploader.upload(
            dataUri,
            { folder: 'payment-slips', resource_type: 'image' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result?.secure_url || '');
            }
        );
    });
}

// Reply to LINE user
async function replyToLine(replyToken: string, messages: Array<{ type: string; text: string }>) {
    if (!LINE_CHANNEL_ACCESS_TOKEN) return;
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ replyToken, messages }),
    });
}

// POST /api/line-webhook — รับ webhook จาก LINE Official
export async function POST(request: Request) {
    try {
        const body = await request.text();
        const signature = request.headers.get('x-line-signature') || '';

        // Verify signature in production
        if (LINE_CHANNEL_SECRET && !verifySignature(body, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const data = JSON.parse(body);
        const events = data.events || [];

        for (const event of events) {
            if (event.type !== 'message') continue;

            const userId = event.source?.userId;
            const replyToken = event.replyToken;

            if (event.message.type === 'image') {
                // 1. Find owner by LINE user ID
                const owner = userId
                    ? await prisma.owner.findFirst({ where: { lineUserId: userId } })
                    : null;

                if (!owner) {
                    // ลูกค้ายังไม่ได้ลงทะเบียน LINE ID
                    await replyToLine(replyToken, [
                        {
                            type: 'text',
                            text: '❌ ไม่พบข้อมูลลูกค้าในระบบ\n\nกรุณาแจ้ง LINE User ID ของคุณให้ admin เพื่อลงทะเบียน',
                        },
                    ]);
                    continue;
                }

                // 2. Find latest PENDING billing collection for this owner
                const collection = await prisma.billingCollection.findFirst({
                    where: {
                        ownerId: owner.id,
                        status: { in: ['PENDING', 'PARTIAL'] },
                    },
                    orderBy: { createdAt: 'desc' },
                });

                if (!collection) {
                    await replyToLine(replyToken, [
                        {
                            type: 'text',
                            text: `สวัสดีค่ะ คุณ${owner.name}\n\n❌ ไม่พบใบวางบิลที่รอชำระ\n\nหากต้องการสอบถาม กรุณาติดต่อ admin`,
                        },
                    ]);
                    continue;
                }

                try {
                    // 3. Download image from LINE
                    const imageBuffer = await downloadLineImage(event.message.id);

                    // 4. Upload to Cloudinary
                    const imageUrl = await uploadToCloudinary(imageBuffer);

                    // 5. Create payment slip (pending verification by admin)
                    await prisma.paymentSlip.create({
                        data: {
                            billingCollectionId: collection.id,
                            slipImageUrl: imageUrl,
                            amount: 0, // Admin จะกรอกยอดเงินเอง
                            senderName: owner.name,
                            notes: `ส่งจาก LINE โดย ${owner.name}`,
                        },
                    });

                    const remaining = Number(collection.totalAmount) - Number(collection.paidAmount);

                    await replyToLine(replyToken, [
                        {
                            type: 'text',
                            text:
                                `✅ ได้รับสลิปเรียบร้อยค่ะ คุณ${owner.name}\n\n` +
                                `📄 ใบวางบิล: ${collection.collectionNo}\n` +
                                `💰 ยอดค้าง: ${remaining.toLocaleString('th-TH')} บาท\n\n` +
                                `⏳ รอ admin ตรวจสอบยอดเงินค่ะ`,
                        },
                    ]);
                } catch (uploadError) {
                    console.error('Error processing LINE image:', uploadError);
                    await replyToLine(replyToken, [
                        { type: 'text', text: '❌ เกิดข้อผิดพลาดในการอัพโหลดรูป กรุณาลองใหม่อีกครั้งค่ะ' },
                    ]);
                }
            } else if (event.message.type === 'text') {
                // Handle text messages — show billing status
                const owner = userId
                    ? await prisma.owner.findFirst({ where: { lineUserId: userId } })
                    : null;

                if (!owner) {
                    await replyToLine(replyToken, [
                        {
                            type: 'text',
                            text: '❌ ไม่พบข้อมูลลูกค้าในระบบ\n\nกรุณาแจ้ง LINE User ID ของคุณให้ admin เพื่อลงทะเบียน',
                        },
                    ]);
                    continue;
                }

                // Get pending billing collections
                const collections = await prisma.billingCollection.findMany({
                    where: {
                        ownerId: owner.id,
                        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
                    },
                    orderBy: { periodEnd: 'desc' },
                    take: 5,
                });

                if (collections.length === 0) {
                    await replyToLine(replyToken, [
                        { type: 'text', text: `สวัสดีค่ะ คุณ${owner.name}\n\n✅ ไม่มียอดค้างชำระค่ะ` },
                    ]);
                } else {
                    const lines = collections.map((c) => {
                        const remaining = Number(c.totalAmount) - Number(c.paidAmount);
                        const statusEmoji =
                            c.status === 'OVERDUE' ? '🔴' : c.status === 'PARTIAL' ? '🟡' : '⚪';
                        return `${statusEmoji} ${c.collectionNo}\n   ${c.periodLabel || ''}\n   ยอด: ${Number(c.totalAmount).toLocaleString('th-TH')} | คงเหลือ: ${remaining.toLocaleString('th-TH')} บาท`;
                    });

                    await replyToLine(replyToken, [
                        {
                            type: 'text',
                            text:
                                `สวัสดีค่ะ คุณ${owner.name}\n\n📋 ใบวางบิลที่รอชำระ:\n\n${lines.join('\n\n')}\n\n` +
                                `📸 ส่งรูปสลิปเพื่อแจ้งชำระเงินค่ะ`,
                        },
                    ]);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('LINE webhook error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// GET /api/line-webhook — LINE webhook verification
export async function GET() {
    return NextResponse.json({ ok: true });
}
