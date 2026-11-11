# Real Darkness (Minecraft Bedrock add-on)

ไฟล์ติดตั้ง: `dist/RealDarkness.mcaddon` เปิดไฟล์นี้บนเครื่องที่มี Minecraft แล้วเกมจะ import ให้เอง

## เปิดใช้ในโลก
1. Behavior Packs: เปิด **Real Darkness** (Resource Pack ซึ่งรวมดวงอาทิตย์/พระจันทร์แล้ว จะถูกเปิดตามให้เอง)
2. อยากเห็นจุดไฟจากระยะไกลในความมืด: เปิด Vibrant Visuals และปิดหมอกในเมนูตั้งค่า (ความมืดจะมาจากระบบแสงแทน)

## ไอเทมตั้งค่า
- ได้อัตโนมัติตอนเข้าโลกครั้งแรก หรือคราฟต์: เหล็ก ×8 ล้อมถ่าน ×1
- คลิกขวาเพื่อเปิดเมนู (เฉพาะ Operator): หมอกตอนกลางคืน, ความหนาหมอก (บาง/กลาง/หนา/มืดสนิท), แสงจากไอเทมที่ถือ



## พัฒนา
- `python3 tools/make_textures.py`: สร้าง texture ใหม่
- `python3 tools/make_fogs.py`: สร้างไฟล์หมอก (4 ระดับ × 10 แบบคืน + ปรากฏการณ์ดวงอาทิตย์)
- `npm install && npx tsc -p jsconfig.json`: ตรวจสคริปต์
- `python3 tools/build.py`: สร้าง `dist/RealDarkness.mcaddon`
