# Real Darkness (Minecraft Bedrock add-on)

ไฟล์ติดตั้ง: `dist/RealDarkness.mcaddon` เปิดไฟล์นี้บนเครื่องที่มี Minecraft แล้วเกมจะ import ให้เอง

## เปิดใช้ในโลก
1. Behavior Packs: เปิด **Real Darkness** (Resource Pack ซึ่งรวมดวงอาทิตย์/พระจันทร์แล้ว จะถูกเปิดตามให้เอง)

## ไอเทมตั้งค่า
- ได้อัตโนมัติตอนเข้าโลกครั้งแรก หรือคราฟต์: เหล็ก ×8 ล้อมถ่าน ×1
- คลิกขวาเพื่อเปิดเมนู (เฉพาะ Operator): เปิด/ปิดหมอกความมืดอัตโนมัติ, แสงจากไอเทมที่ถือ

## หมอกอัตโนมัติ
- กว้าง/แคบตามแสงฟ้า (ดวงอาทิตย์/พระจันทร์, ข้างขึ้นข้างแรม, คืน/วันพิเศษ, อยู่กลางแจ้งหรือในถ้ำ)
- และตามแหล่งแสงในรัศมี 24 บล็อก: ยิ่งใกล้และยิ่งมาก หมอกยิ่งกว้าง (รวมลาวา ไฟ คบไฟ และไอเทมที่ผู้เล่นถือ)
- `/scriptevent realdarkness:debug` แสดงค่าที่ระบบใช้อยู่



## พัฒนา
- `python3 tools/make_textures.py`: สร้าง texture ใหม่
- `python3 tools/make_fogs.py`: สร้างไฟล์หมอก (8 สี × 13 ระดับความกว้าง)
- `npm install && npx tsc -p jsconfig.json`: ตรวจสคริปต์
- `python3 tools/build.py`: สร้าง `dist/RealDarkness.mcaddon`
