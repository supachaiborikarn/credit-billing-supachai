<!-- SUMMARY: Deploy บน Vercel auto-deploy จาก main branch, ใช้ Cloudinary เก็บรูป,
     env vars: DATABASE_URL + CLOUDINARY_*, health check: /api/health,
     Next.js 16 framework -->

# Deployment

## Overview
ระบบ deploy อัตโนมัติบน Vercel เมื่อ push ไป main branch

## Stack
| Component | Service |
|-----------|---------|
| **Framework** | Next.js 16 |
| **Hosting** | Vercel |
| **Database** | PostgreSQL (Neon) |
| **Image Storage** | Cloudinary |
| **ORM** | Prisma |

## Vercel Config
- **Dashboard**: https://vercel.com/benzs-projects-2423502c/credit-billing-supachai/deployments
- **Auto-deploy**: push → main → auto deploy (1-2 นาที)
- **Health check**: `/api/health`

## Environment Variables
| Variable | คำอธิบาย |
|----------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## Deploy Checklist
1. Test local: `npm run build`
2. Backup database
3. ตรวจสอบ env variables
4. Push to GitHub (main branch)
5. ตรวจสอบ `/api/health` หลัง deploy

## Changelog
- 2026-05-20: ตรวจ Vercel production failures จาก commit `dd3e3f1` และ `59ed862`; ทั้งคู่ fail ที่ TypeScript `shift is possibly null` ใน GAS close shift page, ส่วน production ล่าสุด `c98cecf` Ready และ `/api/health` ตอบ database connected
- 2026-02-24: สร้างไฟล์ brain topic นี้
- 2026-02-23: อัปเดต DATABASE_URL หลัง migrate Neon
