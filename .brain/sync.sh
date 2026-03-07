#!/bin/bash
# Brain Auto-Sync Script
# ใช้สำหรับ commit และ push การเปลี่ยนแปลงของ brain ไป GitHub

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ตรวจสอบว่ามีการเปลี่ยนแปลงใน .brain/ หรือไม่
if git diff --quiet .brain/ && git diff --cached --quiet .brain/; then
    echo "✅ No changes in .brain/ - nothing to sync"
    exit 0
fi

# Stage เฉพาะไฟล์ใน .brain/
git add .brain/

# Commit พร้อม message อัตโนมัติ
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
CHANGED_FILES=$(git diff --cached --name-only .brain/ | head -5)
git commit -m "🧠 brain: auto-update ${TIMESTAMP}" -m "Changed files:" -m "${CHANGED_FILES}"

# Push ไป remote
git push origin main

echo "✅ Brain synced successfully at ${TIMESTAMP}"
