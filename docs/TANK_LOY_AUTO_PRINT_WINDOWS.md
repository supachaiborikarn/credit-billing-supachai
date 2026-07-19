# ตั้งพิมพ์สรุปวันแท๊งลอยอัตโนมัติบน Windows

ระบบจะพิมพ์รายงานของเมื่อวานทุกวันเวลา 07:00 น. ผ่าน Epson TM-m30III ที่ต่อ Wi-Fi วงเดียวกับคอมพิวเตอร์

ถ้าเลขปิดมิเตอร์ยังไม่ครบ 4 หัว คอมพิวเตอร์จะลองใหม่ทุก 10 นาทีจนถึง 10:00 น.

ระบบจะจำวันที่พิมพ์สำเร็จแล้วเพื่อกันกระดาษออกซ้ำ

## 1. เตรียมเครื่องพิมพ์

1. ให้คอมพิวเตอร์และ Epson ต่อ Wi-Fi วงเดียวกัน
2. เปิด ePOS-Print ในหน้าตั้งค่าของ Epson
3. จด IP ของ Epson เช่น `192.168.1.50`
4. ล็อก IP ของ Epson ในเราเตอร์ไว้ไม่ให้เปลี่ยนหลังปิดเปิดเครื่อง

## 2. ตั้งรหัสสำหรับคอมพิวเตอร์

สร้างรหัสสุ่มใน PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

นำรหัสที่ได้ไปตั้งใน Vercel ชื่อ `TANK_LOY_PRINT_AGENT_TOKEN` แล้ว deploy ระบบอีกครั้ง

เก็บรหัสนี้ไว้สำหรับตอนติดตั้งบน Windows

## 3. ติดตั้งบน Windows

คัดลอกไฟล์สามไฟล์นี้ไปไว้ในโฟลเดอร์เดียวกัน:

- `install-tank-loy-auto-print.cmd`
- `install-tank-loy-auto-print.ps1`
- `tank-loy-auto-print.ps1`

ชุดติดตั้งของหน้างานตั้ง URL เป็น `https://credit-billing-supachai.vercel.app` และ IP Epson เป็น `192.168.0.218` ไว้แล้ว

ดับเบิลคลิก `install-tank-loy-auto-print.cmd` เพื่อติดตั้ง โดยไฟล์รหัสในชุดติดตั้งจะถูกลบหลังเก็บลงโฟลเดอร์ระบบที่ล็อกสิทธิ์แล้ว

ถ้าต้องการรันผ่าน PowerShell โดยตรง ให้เปิดแบบ Run as administrator แล้วรัน:

```powershell
cd C:\TankLoyAutoPrint
.\install-tank-loy-auto-print.ps1 `
  -AppUrl "https://your-domain.vercel.app" `
  -PrinterIp "192.168.1.50"
```

ตัวติดตั้งจะถามรหัส `TANK_LOY_PRINT_AGENT_TOKEN` และตรวจว่าเชื่อมกับระบบและ Epson ได้หรือไม่

ตัวติดตั้งจะสร้าง Windows Scheduled Task ชื่อ `Supachai Tank Loy Auto Print`

## 4. ตรวจการเชื่อมต่อ

ตรวจ API และเครือข่ายของ Epson โดยไม่พิมพ์กระดาษ:

```powershell
& "C:\ProgramData\Supachai\TankLoyAutoPrint\tank-loy-auto-print.ps1" -CheckOnly
```

ทดสอพพิมพ์รายงานของเมื่อวาน:

```powershell
& "C:\ProgramData\Supachai\TankLoyAutoPrint\tank-loy-auto-print.ps1" -Force
```

`-Force` จะพิมพ์ซ้ำแม้วันนั้นเคยพิมพ์แล้ว

## 5. ตรวจผลการทำงาน

ไฟล์ log อยู่ที่:

```text
C:\ProgramData\Supachai\TankLoyAutoPrint\logs\auto-print.log
```

ถ้า log ขึ้น `uncertain previous result` ให้ตรวจว่ากระดาษออกแล้วหรือไม่ก่อนใช้ `-Force`

ตั้ง Time zone ของ Windows เป็น `(UTC+07:00) Bangkok, Hanoi, Jakarta` เพื่อให้เริ่มงาน 07:00 น. ตามเวลาไทย
