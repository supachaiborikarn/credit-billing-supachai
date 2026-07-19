# Credit Billing System - คู่มือการ Deploy

## 📋 ข้อมูลระบบ

| รายการ | ค่า |
|--------|-----|
| **Framework** | Next.js 16 |
| **Database** | PostgreSQL (Neon) |
| **ORM** | Prisma |
| **Hosting** | Vercel |
| **Image Storage** | Cloudinary |

---

## 🚀 Deploy บน Vercel

### ขั้นตอนการ Deploy

1. **Push code ไป GitHub**
```bash
git add .
git commit -m "Deploy updates"
git push origin main
```

2. **Vercel จะ auto-deploy** เมื่อ push ไป main branch

3. **ตรวจสอบ deployment**
   - ไปที่ https://vercel.com/dashboard
   - ดู build logs
   - ตรวจสอบ `/api/health` ว่าระบบทำงานปกติ

---

## 🔐 Environment Variables (Vercel)

ตั้งค่าใน Vercel Dashboard → Settings → Environment Variables:

| Variable | ตัวอย่าง | คำอธิบาย |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://...` | URL ฐานข้อมูล Neon |
| `CLOUDINARY_CLOUD_NAME` | `your-cloud` | ชื่อ Cloudinary cloud |
| `CLOUDINARY_API_KEY` | `123456789` | API key |
| `CLOUDINARY_API_SECRET` | `xxx` | API secret |
| `TANK_LOY_PRINT_AGENT_TOKEN` | `รหัสสุ่มอย่างน้อย 32 bytes` | รหัสสำหรับ Windows ที่พิมพ์สรุปวันแท๊งลอยอัตโนมัติ |

---

## 💾 การ Backup ฐานข้อมูล

### วิธี Backup ด้วยมือ (Neon Dashboard)

1. ไปที่ https://console.neon.tech
2. เลือก Project
3. ไปที่ Settings → Backups
4. กด "Create backup"

### วิธี Backup ด้วย Command Line

```bash
# Export ข้อมูลทั้งหมด
pg_dump "DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Import กลับ (กรณีต้อง restore)
psql "DATABASE_URL" < backup_20251228.sql
```

### วิธี Backup ด้วย Script อัตโนมัติ

ใช้ script ที่เตรียมไว้:

```bash
# Backup
./scripts/backup-db.sh

# Restore (ระวัง: จะลบข้อมูลเดิม!)
./scripts/restore-db.sh backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

### ตั้งค่า Cron สำหรับ Backup อัตโนมัติทุกวัน

```bash
# แก้ไข crontab
crontab -e

# เพิ่มบรรทัดนี้ (backup ตี 2 ทุกวัน)
0 2 * * * cd /path/to/project && ./scripts/backup-db.sh
```

### 🔴 สำคัญ: Backup ก่อนทำอะไรเสมอ!

- ก่อนแก้ไขโค้ดสำคัญ
- ก่อน deploy เวอร์ชันใหม่
- ก่อนรัน migration
- อย่างน้อยสัปดาห์ละ 1 ครั้ง

---

## 🔍 การตรวจสอบระบบ (Health Check)

### ตรวจสอบว่าระบบทำงานปกติ

```bash
curl https://your-domain.vercel.app/api/health
```

**ผลลัพธ์ที่ควรได้:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-12-28T10:30:00.000Z"
}
```

**ถ้าเห็น `"status": "error"`** = มีปัญหา ต้องตรวจสอบ

---

## 🛠️ การแก้ไขปัญหาเบื้องต้น

### ปัญหา: ระบบโหลดช้า
- ตรวจสอบ Vercel Dashboard → Analytics
- ดู API response times

### ปัญหา: Database connection failed
- ตรวจสอบ DATABASE_URL ใน Vercel env
- ตรวจสอบ Neon dashboard ว่า database online

### ปัญหา: รูปภาพไม่แสดง
- ตรวจสอบ Cloudinary credentials
- ตรวจสอบ quota ของ Cloudinary

---

## 📞 การติดต่อฉุกเฉิน

- **Vercel Status**: https://www.vercel-status.com
- **Neon Status**: https://neonstatus.com
- **Cloudinary Status**: https://status.cloudinary.com

---

## 📝 Checklist ก่อน Deploy

- [ ] Test บน local ผ่านแล้ว (`npm run build`)
- [ ] Backup database แล้ว
- [ ] ตรวจสอบ env variables ครบ
- [ ] Push to GitHub
- [ ] ตรวจสอบ `/api/health` หลัง deploy
