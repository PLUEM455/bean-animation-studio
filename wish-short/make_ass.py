# Thai subtitles + on-screen text (libass shapes Thai). Times from place_voice.py; the phrase<->text mapping is inferred from silence gaps (not transcribed).
def ts(t): h=int(t//3600); m=int(t%3600//60); s=t%60; return f"{h}:{m:02d}:{s:05.2f}"
HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Sub,Prompt,64,&H00FFFFFF,&H000000FF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,70,70,330,1
Style: Shout,Prompt,104,&H0030D8FF,&H000000FF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,9,3,2,50,50,330,1
Style: Hook,Prompt,84,&H0030D8FF,&H000000FF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,8,3,8,60,60,300,1
Style: Big,Prompt,118,&H00FFFFFF,&H000000FF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,10,3,5,50,50,60,1
Style: Live,Prompt,46,&H00FFFFFF,&H000000FF,&H00201018,&H80000000,-1,0,0,0,100,100,0,0,1,4,0,7,60,60,110,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
POP = r"{\fscx60\fscy60\t(0,140,\fscx112\fscy112)\t(140,260,\fscx100\fscy100)}"
ev = []
def add(a, b, style, text, pop=True): ev.append((a, b, style, (POP if pop else "") + text.replace("\n", r"\N")))
add(0.20, 3.15, 'Hook', "ถ้าคนทั้งโลกขอพรได้ข้อเดียว\nคุณจะขออะไร?")
add(3.60, 6.32, 'Sub', "ตอนนี้ทั่วโลกกำลังขอพรกันอยู่")
add(6.70, 8.46, 'Sub', "เราไปดูที่ใจกลางเมืองกันก่อนเลยครับ")
add(8.80, 11.12, 'Sub', "คนเยอะมาก ยกมือกันเต็มถนน")
add(11.35, 11.78, 'Sub', "เดี๋ยวนะครับ")
add(12.20, 13.45, 'Sub', "ท้องฟ้าเริ่มแตกแล้ว")
add(13.68, 14.10, 'Shout', "เห้ย!")
add(22.04, 24.62, 'Sub', "ตอนนี้ผมได้ติดต่อสายตรงไปที่\nมือกล้องภาคสนามแล้วครับ")
add(24.70, 25.76, 'Sub', "ดูไปด้วยกันเลย")
add(29.06, 30.82, 'Sub', "มีของแปลกๆ โผล่มาเต็มไปหมด")
add(37.85, 38.95, 'Shout', "เห้ย! คนยักษ์?!")
add(41.34, 43.49, 'Sub', "ตอนนี้ตัวเมืองเละไม่เหลือชิ้นดีครับ")
add(46.85, 47.98, 'Sub', "ส่วนที่สนามบอล...")
add(48.36, 49.72, 'Sub', "เออ ยังเตะกันอยู่ครับ")
add(50.35, 50.75, 'Shout', "เห้ย!")
add(51.00, 52.18, 'Shout', "ไอ้ขาโก่งปีศาจ?!")
add(61.35, 62.90, 'Sub', "แล้วคุณล่ะครับ\nจะขออะไร?")
add(57.20, 59.00, 'Big', "สามวันต่อมา")
for a, b in [(21.8, 44.0), (50.2, 53.4)]: add(a, b, 'Live', r"{\1c&H2020FF&}●{\1c&HFFFFFF&} LIVE", pop=False)
with open('work/wish.ass', 'w', encoding='utf-8') as f:
    f.write(HEAD)
    for a, b, st, tx in ev: f.write(f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{tx}\n")
print(len(ev), 'events')
