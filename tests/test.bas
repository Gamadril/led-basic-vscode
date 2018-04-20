' **************************************
' *  CRONIOS1: NIXIE Clock Demo        *
' *  LED-Basic >= 15.1.9 required      *
' *  modyfied by Vanessa Ver. 1.0      *
' **************************************
' Bedienungsanleitung:
' Bei Neustart und gleichzeitig gedrückter Taste erfolgt eine Zurücksetzung
' auf Default Werte.
' Drehregler stellt die Farben ein, kurzer Druck schaltet zwischen Uhrzeit
' und Datum um. Die Farbeinstellung wird bei Druck gespeichert.
' Datum springt nach ca. 4 Sekunden automatisch auf Uhrzeit zurück.
' Langer Druck auf die Taste startet das Einstellungsmenü.
' Drehen = Funktion 1-9, kurzer Druck = ausführen, langer Druck = ende.
' Alarm ist priorisiert bei Timer / Stoppuhr.
' 1: Helligkeit einstellen
'    1..15 = Helligkeit fest
'    0 = Automatische Helligkeit über Sensor
' 2: Beeper ein/aus
'    0 = aus
'    1 = ein
' 3: Uhrzeit einstellen
'    kurzer Druck wechselt zwischen Stunden, Minuten, Sekunden
'    langer Druck setzt die eingestellte Zeit
' 4: Datum einstellen
'    kurzer Druck wechselt zwischen Tage, Monate, Jahre
'    langer Druck setzt das eingestellte Datum
' 5: Alarm ein/aus
'    0 = aus
'    1 = ein
' 6: Alarmzeit einstellen
'    kurzer Druck wechselt zwischen Stunden, Minuten
'    langer Druck setzt die eingestellte Alarmzeit
' 7: Datum auto Anzeige ein/aus
'    0 = aus
'    1 = ein
' 8: Timer (max 23:59:00)
'    kurzer Druck wechselt zwischen Stunden, Minuten
'    langer Druck setzt die eingestellte Timerzeit.
'    Danach kurzer Druck = Start / Stop
'    Langer Druck bei Stop = Ende
' 9: Stoppuhr (max 23:59:59)
'    kurzer Druck = Start / Stop
'    Langer Druck bei Stop = Ende
'******************************************************
### L60 CGRB P0 S2 M92

' Nixie Digit-Index
10: data 5, 0, 6, 1, 7, 2, 8, 3, 9, 4
' Color-Index (0..11)
20: data 5, 20, 50, 90, 130, 160, 200, 260, 300, 340, 1000, 1001, 1002
' Volume-Table
30: data 0, 3, 6, 9, 16, 25, 37, 51, 68, 87, 109, 133, 160, 189, 221, 255
' Music Timer / Stoppuhr max :-)
40:
data 13, 200, 15, 200, 17, 200, 13, 200, 13, 200, 15, 200, 17, 200, 13, 200
data 17, 200, 18, 200, 20, 400, 17, 200, 18, 200, 20, 400
' LED-INDEX SET
led.ihsv(0, 0,   0,   0) 'aus
led.ihsv(2, 0,   0, 128) 'weiss (setup)
led.ihsv(3, 5, 255, 128) 'rot (set alarm)
led.ihsv(4, 110, 254, 96) 'grün (timer / stoppuhr)
led.ihsv(5, 37, 254, 96) 'gelb (set date / time)
LED.blackout()

' EEPROM INIT
gosub 8000

' GLOBAL VARS
' c = color,   m = mode, t = temp, i = loop, j = zaehler, r = temp
' z = zaehler, h = hue, v = volume, a = alarm show / auto date

'==== STARTUP ===================================
99:
' MODE (0 = TIME, 1 = DATE)
a = 0
m = 0
z = 0
goto 190
'==== MAIN LOOP =================================
100:
    t = IO.getenc()    ' Read Encoder
    if t = c then goto 105
    c = t              ' color set
    z = 0              ' zaehler reset

105:
    s = IO.getrtc(1)
    r = IO.getrtc(0)
    if s % 10 = 4 and r / 10 = 0 gosub 3000 'random
    a = IO.eeread(8)
    s = IO.getrtc(0)
    if s = 50 and a = 1 goto 180 'auto Date
    a = IO.eeread(5)
    if a = 0 then goto 108
    s = IO.getrtc(1)
    r = IO.getrtc(0)
    if s % 10 = 2 or s % 10 = 6 and r = 0 gosub 700 'show alarm
    a = IO.eeread(6)
    s = IO.getrtc(2)
    if s <> a then goto 108
    a = IO.eeread(7)
    s = IO.getrtc(1)
    if s = a then gosub 9105     'beep.. Alarm !!

108:
    gosub 9000         ' GETKEY
    if k = 0 then goto 200
    if k = 1 then goto 110
    if k = 2 then goto 10000
    goto 100

110:
    gosub 9100         ' BEEP
'==== SHORT PRESS: MODE SWITCH ====
    if m = 0 then goto 180
    if m = 1 then goto 185
    goto 100
180:
    t = IO.eeread(m + 1)
    if t <> c then IO.eewrite(m + 1, c)
    m = 1               ' mode = date
    goto 190
185:
    t = IO.eeread(m + 1)
    if t <> c then IO.eewrite(m + 1, c)
    m = 0               ' mode = time
190:
    c = IO.eeread(m + 1)
    IO.setenc(c, 12, 0) ' set Encoder
    z = 0

200:
    if z & 15 <> 0 then goto 210
    t = IO.eeread(4)    ' Bright
    if t = 0 then v = IO.getldr() + 2 else v = read 30, t

210:
    LED.irange(0, 0, 59)
    if m <> 0 then goto 220
    gosub 500      ' SHOW TIME
    LED.show()     ' 40ms !!!
    goto 100
220:
    if m <> 1 then goto 100
    gosub 600      ' SHOW DATE
    LED.show()     ' 40ms !!!
    if z > 100 then goto 185  ' Return to TIME after 4000ms
    goto 100
'================================================
' SHOW TIME
' VAR: n, p, j
500:
    s = IO.getrtc(0)
    if s % 10 = 9 then goto 510
    n = s / 10
    p = 40
    gosub 1000        ' Seconds 10
    n = s % 10
    p = 50
    gosub 1000        ' Seconds 1
    j = 59
    goto 520

510:
    n = s / 10        ' Seconds Flip
    p = 40
    gosub 1000        ' Seconds 10
    n = j % 10
    p = 50
    gosub 1000        ' Seconds 1
    j = j - 1
    delay 98

520:
    s = IO.getrtc(1)
    n = s / 10
    p = 20
    gosub 1000        ' Minutes 10
    n = s % 10
    p = 30
    gosub 1000        ' Minutes 1

    s = IO.getrtc(2)
    n = s / 10
    p = 0
    gosub 1000        ' Hours 10
    n = s % 10
    p = 10
    
    gosub 1000        ' Hours 1

    z = z + 2
    return
'================================================
' SHOW DATE
' VAR: n, p
600:
    s = IO.getrtc(3)
    n = s / 10
    p = 0
    gosub 1000        ' Day 10
    n = s % 10
    p = 10
    gosub 1000        ' Day 1

    s = IO.getrtc(4)
    n = s / 10
    p = 20
    gosub 1000        ' Month 10
    n = s % 10
    p = 30
    gosub 1000        ' Month 1

    s = IO.getrtc(5)
    n = (s % 100) / 10
    p = 40
    gosub 1000        ' Year 10
    n = s % 10
    p = 50
    gosub 1000         ' Year 1

    z = z + 1
    return
'================================================
' SHOW Alarm
' VAR: n, p, s, i
700:
    LED.irange(0, 0, 59)
        
    LED.lrgb(0, 255, 0, 0, 3)

    s = IO.eeread(6)
    for i = 50 downto 10 step 10
    LED.iled(3, i + read 10, s / 10)
    LED.show()
    delay 200
    LED.iled(0, i + read 10, s / 10)
    next i
    LED.iled(3,     read 10, s / 10)

    for i = 50 downto 20 step 10
    LED.iled(3, i + read 10, s % 10)
    LED.show()
    delay 200
    LED.iled(0, i + read 10, s % 10)
    next i
    LED.iled(3, 10 + read 10, s % 10)

    s = IO.eeread(7)
    for i = 50 downto 30 step 10
    LED.iled(3, i + read 10, s / 10)
    LED.show()
    delay 200
    LED.iled(0, i + read 10, s / 10)
    next i
    LED.iled(3,20 + read 10, s / 10)

    for i = 50 downto 40 step 10
    LED.iled(3, i + read 10, s % 10)
    LED.show()
    delay 200
    LED.iled(0, i + read 10, s % 10)
    next i
    LED.iled(3, 30 + read 10, s % 10)

    LED.show()
    delay 200
    LED.iled(3, 50 + read 10,0)

    LED.show()
    delay 200
    LED.iled(0, 50 + read 10,0)
    LED.iled(3, 40 + read 10,0)

    LED.show()
    delay 200
    LED.iled(3, 50 + read 10,0)

    LED.show()
    delay 1500
    return
'================================================
' color mode
1000:
    t = read 20, c
    if t > 360 then goto 1010
    LED.ihsv(1, t, 255, v)
    goto 1090
1010:
    if t <> 1000 then goto 1020
    LED.ihsv(1, 0, 0, v)
    goto 1090

1020:
    if t <> 1001 then goto 1030
    LED.ihsv(1, h, 255, v)
    h = z % 360
    goto 1090
1030:
    if t <> 1002 then goto 1030
    LED.ihsv(1, h, 255, v)
    h = (p * 6 + z) % 360
1090:
    LED.iled(1, p + read 10, n)
    return

'================================================
' SHOW Random (Spielautomat)
' VAR: s, n, p, i
3000:
    for i = 1 to 100
    LED.irange(0, 0, 59)

    s = random
    n = s % 10
    p = 40
    gosub 1000        ' Seconds 10
    n = ((s % 100)/10) + 1
    p = 50
    gosub 1000        ' Seconds 1
    n = (s % 1000)/100
    p = 20
    gosub 1000        ' Minutes 10
    n = (s % 100)/10
    p = 30
    gosub 1000        ' Minutes 1
    n = (s % 10000)/1000
    p = 0
    gosub 1000        ' Hours 10
    n = ((s % 1000)/100) + 1
    p = 10
    gosub 1000        ' Hours 1

    z = z + 2
    LED.show()
    delay 50 + i * 2
    next i
    IO.beep()

    return
'================================================
' EEPROM INIT
' 0 = 0xABCD
' 1 = Color Time (1)
' 2 = Color Date (5)
' 3 = Beep       (1)
' 4 = Bright     (12)
' 5 = Alarm      (0)
' 6-7 = Alarm Zeit (Stunde. Minute)(12,0)
' 8 = Datum auto Anzeige (1)
8000:
    z = IO.keystate() 'Sartup INIT
    if z = 1 then IO.eewrite(0, 0xFFFF)
    t = IO.eeread(0)
    if t = 0xABCD then goto 8010
    IO.eewrite(1, 1)
    IO.eewrite(2, 5)
    IO.eewrite(3, 1)
    IO.eewrite(4, 12)
    IO.eewrite(5, 0)
    IO.eewrite(6, 12)
    IO.eewrite(7, 0)
    IO.eewrite(8, 1)
    IO.eewrite(0, 0xABCD)
8010:
    return
'================================================
' GETKEY
' VAR: k, i, RET: k
' k: 0 = No Key, 1 = Short, 2 = LONG
9000:
    k = IO.getkey()
    if k = 0 then goto 9020
    i = 0
9010:
    k = IO.keystate()
    if k = 0 then goto 9015
    delay 10
    i = i + 1
    if i < 50 then goto 9010
    k = 2
    return
9015:
    k = 1        ' SHORT PRESS
9020:
    return
'================================================
' BEEP
9100:
    t = IO.eeread(3)
    if t = 0 then goto 9110 'no beep
9105:
    IO.beep(35)
    delay 25
    IO.beep(0)
9110:
    return
'================================================
' MODE SETUP
' VAR p: position, t: temp, y: value
10000:
    gosub 9100        ' BEEP
    p = 0
10005:
    z = 0
    IO.setenc(p, 8, 0)
10010:
    t = IO.getenc()    ' Read Encoder
    if t = p then goto 10020
    p = t
    z = 0              ' zaehler reset
10020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 10050
    if k = 1 then goto 10060
    gosub 9100        ' BEEP
    goto 99
10050:
    LED.irange(0, 0, 59)
    if z & 15 < 11 then LED.iled(2, read 10, p + 1)
    LED.show()
    z = z + 1
    if z > 200 then goto 99    ' RETURN
    goto 10010

10060:
    if p = 0 then goto 11000
    if p = 1 then goto 12000
    if p = 2 then goto 13000
    if p = 3 then goto 14000
    if p = 4 then goto 15000
    if p = 5 then goto 16000
    if p = 6 then goto 17000
    if p = 7 then goto 18000
    if p = 8 then goto 19000
    goto 10010
'================================================
' F1: BRIGHT SETUP
' VAR: y,t,z,k
11000:
    gosub 9100          ' BEEP
    y = IO.eeread(4)    ' Read Bright Value
11005:
    z = 0
    IO.setenc(y, 15, 0)
11010:
    t = IO.getenc()
    if t = y then goto 11020
    y = t
    z = 0
11020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 11050
    gosub 9100        ' BEEP
    goto  11070
11050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 11060
    LED.iled(2, 40 + read 10, y / 10)
    LED.iled(2, 50 + read 10, y % 10)
11060:
    LED.iled(3, read 10, 1)
    LED.show()
    z = z + 1
    if z <= 200 then goto 11010
11070:
    t = IO.eeread(4)    ' Read Bright Value
    if y <> t then IO.eewrite(4, y)
    goto 10005
'================================================
' F2: BEEP SETUP on/off
' VAR: y,t,z,k
12000:
    gosub 9100        ' BEEP
    y = IO.eeread(3)  ' Read Beep Value
12005:
    z = 0
    IO.setenc(y, 1, 0)
12010:
    t = IO.getenc()
    if t = y then goto 12020
    y = t
    z = 0
12020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 12050
    gosub 9100        ' BEEP
    goto  12070
12050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 12060
    LED.iled(2, 50 + read 10, y)
12060:
    LED.iled(3, read 10, 2)
    LED.show()
    z = z + 1
    if z <= 200 then goto 12010
12070:
    t = IO.eeread(3)    ' Read Bright Value
    if y <> t then IO.eewrite(3, y)
    goto 10005
'================================================
' F3: TIME SETUP
' VAR: w,x,y,t,z,k
13000:
    y = IO.getrtc(2)  ' Read Hour
    x = IO.getrtc(1)  ' Read Minute
    w = 0             ' Second = 0
13005:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(y, 23, 0)
13010:
    t = IO.getenc()
    if t = y then goto 13020
    y = t
    z = 0
13020:
    gosub 9000        ' GETKEY
    if k = 1 then goto 13100
    if k = 2 then goto 13300
13050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 13060
    LED.iled(2,      read 10, y / 10)
    LED.iled(2, 10 + read 10, y % 10)
13060:
    LED.iled(5, 20 + read 10, x / 10)
    LED.iled(5, 30 + read 10, x % 10)
    LED.iled(5, 40 + read 10, (w * 5) / 10)
    LED.iled(5, 50 + read 10, (w * 5) % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 13010    ' 20 Sek.
    goto 13320
'................................................
13100:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(x, 59, 0)
13110:
    t = IO.getenc()
    if t = x then goto 13120
    x = t
    z = 0
13120:
    gosub 9000        ' GETKEY
    if k = 1 then goto 13200
    if k = 2 then goto 13300
13150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 13160
    LED.iled(2, 20 + read 10, x / 10)
    LED.iled(2, 30 + read 10, x % 10)
13160:
    LED.iled(5,      read 10, y / 10)
    LED.iled(5, 10 + read 10, y % 10)
    LED.iled(5, 40 + read 10, (w * 5) / 10)
    LED.iled(5, 50 + read 10, (w * 5) % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 13110    ' 20 Sek.
    goto 13320
'................................................
13200:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(w, 11, 0)
13210:
    t = IO.getenc()
    if t = w then goto 13220
    w = t
    z = 0
13220:
    gosub 9000        ' GETKEY
    if k = 1 then goto 13005
    if k = 2 then goto 13300
13250:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 13260
    LED.iled(2, 40 + read 10, (w * 5) / 10)
    LED.iled(2, 50 + read 10, (w * 5) % 10)
13260:
    LED.iled(5,      read 10, y / 10)
    LED.iled(5, 10 + read 10, y % 10)
    LED.iled(5, 20 + read 10, x / 10)
    LED.iled(5, 30 + read 10, x % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 13210    ' 20 Sek.
    goto 13320
'................................................
13300:
    gosub 9100        ' BEEP
13310:
    IO.setrtc(0, w * 5)    ' Write Seconds
    IO.setrtc(1, x)        ' Write Minutes
    IO.setrtc(2, y)        ' Write Hours
13320:
    goto 10005
'================================================
' F4: DATE SETUP
' VAR: w,x,y,t,z,k
14000:
    y = (IO.getrtc(3)) - 1    ' Read Day
    x = (IO.getrtc(4)) - 1    ' Read Month
    w = (IO.getrtc(5)) % 100  ' Read Year
14005:
    gosub 9100                ' BEEP
    z = 0
    IO.setenc(y, 30, 0)
14010:
    t = IO.getenc()
    if t = y then goto 14020
    y = t
    z = 0
14020:
    gosub 9000        ' GETKEY
    if k = 1 then goto 14100
    if k = 2 then goto 14300
14050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 14060
    LED.iled(2,      read 10, (y + 1) / 10)
    LED.iled(2, 10 + read 10, (y + 1) % 10)
14060:
    LED.iled(5, 20 + read 10, (x + 1) / 10)
    LED.iled(5, 30 + read 10, (x + 1) % 10)
    LED.iled(5, 40 + read 10, w / 10)
    LED.iled(5, 50 + read 10, w % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 14010    ' 20 Sek.
    goto 14320
'................................................
14100:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(x, 11, 0)
14110:
    t = IO.getenc()
    if t = x then goto 14120
    x = t
    z = 0
14120:
    gosub 9000        ' GETKEY
    if k = 1 then goto 14200
    if k = 2 then goto 14300
14150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 14160
    LED.iled(2, 20 + read 10, (x + 1) / 10)
    LED.iled(2, 30 + read 10, (x + 1) % 10)
14160:
    LED.iled(5,      read 10, (y + 1) / 10)
    LED.iled(5, 10 + read 10, (y + 1) % 10)
    LED.iled(5, 40 + read 10, w / 10)
    LED.iled(5, 50 + read 10, w % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 14110    ' 20 Sek.
    goto 14320
'................................................
14200:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(w, 99, 0)
14210:
    t = IO.getenc()
    if t = w then goto 14220
    w = t
    z = 0
14220:
    gosub 9000        ' GETKEY
    if k = 1 then goto 14005
    if k = 2 then goto 14300
14250:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 14260
    LED.iled(2, 40 + read 10, w / 10)
    LED.iled(2, 50 + read 10, w % 10)
14260:
    LED.iled(5,      read 10, (y + 1) / 10)
    LED.iled(5, 10 + read 10, (y + 1) % 10)
    LED.iled(5, 20 + read 10, (x + 1) / 10)
    LED.iled(5, 30 + read 10, (x + 1) % 10)
    LED.show()
    z = z + 1
    if z <= 500 then goto 14210    ' 20 Sek.
    goto 14320
'................................................
14300:
    gosub 9100        ' BEEP
14310:
    IO.setrtc(5, w + 2000)     ' Write Year
    IO.setrtc(4, x + 1)        ' Write Month
    IO.setrtc(3, y + 1)        ' Write Day
14320:
    goto 10005
'================================================
' F5: ALARM ein /aus
' VAR: y,t,z,k
15000:
    gosub 9100        ' BEEP
    y = IO.eeread(5)  ' Read alarm Value
15005:
    z = 0
    IO.setenc(y, 1, 0)
15010:
    t = IO.getenc()
    if t = y then goto 15020
    y = t
    z = 0
15020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 15050
    gosub 9100        ' BEEP
    goto  15070
15050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 15060
    LED.iled(2, 50 + read 10, y)
15060:
    LED.iled(3, read 10, 5)
    LED.show()
    z = z + 1
    if z <= 200 then goto 15010
15070:
    t = IO.eeread(5)    ' Read alarm Value
    if y <> t then IO.eewrite(5, y)
    goto 10005

'================================================
' F6: ALARM SETUP
' VAR: w,x,y,t,z,k
16000:
    y = IO.eeread(6)  ' Read alarm Hour
    x = IO.eeread(7)  ' Read alarm Minute
    w = 0             ' Second = 0
16005:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(y, 23, 0)
16010:
    t = IO.getenc()
    if t = y then goto 16020
    y = t
    z = 0
16020:
    gosub 9000        ' GETKEY
    if k = 1 then goto 16100
    if k = 2 then goto 16300
16050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 16060
    LED.iled(2,      read 10, y / 10)
    LED.iled(2, 10 + read 10, y % 10)
16060:
    LED.iled(3, 20 + read 10, x / 10)
    LED.iled(3, 30 + read 10, x % 10)
    LED.iled(3, 40 + read 10, 0)
    LED.iled(3, 50 + read 10, 0)
    LED.show()
    z = z + 1
    if z <= 500 then goto 16010    ' 20 Sek.
    goto 16320
'................................................
16100:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(x, 59, 0)
16110:
    t = IO.getenc()
    if t = x then goto 16120
    x = t
    z = 0
16120:
    gosub 9000        ' GETKEY
    if k = 1 then goto 16005
    if k = 2 then goto 16300
16150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 16160
    LED.iled(2, 20 + read 10, x / 10)
    LED.iled(2, 30 + read 10, x % 10)
16160:
    LED.iled(3,      read 10, y / 10)
    LED.iled(3, 10 + read 10, y % 10)
    LED.iled(3, 40 + read 10, 0)
    LED.iled(3, 50 + read 10, 0)
    LED.show()
    z = z + 1
    if z <= 500 then goto 16110    ' 20 Sek.
    goto 16320
'................................................
16300:
    gosub 9100        ' BEEP
16310:
    t = IO.eeread(7)
    if x <> t then IO.eewrite(7, x) ' Write alarm Minutes
    t = IO.eeread(6)
    if y <> t then IO.eewrite(6, y) ' Write alarm Hours
16320:
    goto 10005
'================================================
' F7: Auto Datum Anzeige ein /aus
' VAR: y,t,z,k
17000:
    gosub 9100        ' BEEP
    y = IO.eeread(8)  ' Read auto Datum Value
17005:
    z = 0
    IO.setenc(y, 1, 0)
17010:
    t = IO.getenc()
    if t = y then goto 17020
    y = t
    z = 0
17020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 17050
    gosub 9100        ' BEEP
    goto  17070
17050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 17060
    LED.iled(2, 50 + read 10, y)
17060:
    LED.iled(3, read 10, 7)
    LED.show()
    z = z + 1
    if z <= 200 then goto 17010
17070:
    t = IO.eeread(8)    ' Read auto Datum Value
    if y <> t then IO.eewrite(8, y)
    goto 10005
'================================================
' F8: Timer set and go
' VAR: w,x,y,t,z,k,w,a
18000:
    y = 0  ' Timer Hour = 0
    x = 0  ' Timer Minute = 0
    w = 0  ' Timer Second = 0
18005:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(y, 23, 0)
18010:
    t = IO.getenc()
    if t = y then goto 18020
    y = t
    z = 0
18020:
    gosub 9000        ' GETKEY
    if k = 1 then goto 18100
    if k = 2 then goto 18300
18050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 18060
    LED.iled(2,      read 10, y / 10)
    LED.iled(2, 10 + read 10, y % 10)
18060:
    LED.iled(4, 20 + read 10, x / 10)
    LED.iled(4, 30 + read 10, x % 10)
    LED.iled(4, 40 + read 10, 0)
    LED.iled(4, 50 + read 10, 0)
    LED.show()
    z = z + 1
    if z <= 500 then goto 18010    ' 20 Sek.
    goto 18320
'................................................
18100:
    gosub 9100        ' BEEP
    z = 0
    IO.setenc(x, 59, 0)
18110:
    t = IO.getenc()
    if t = x then goto 18120
    x = t
    z = 0
18120:
    gosub 9000        ' GETKEY
    if k = 1 then goto 18005
    if k = 2 then goto 18300
18150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 18160
    LED.iled(2, 20 + read 10, x / 10)
    LED.iled(2, 30 + read 10, x % 10)
18160:
    LED.iled(4,      read 10, y / 10)
    LED.iled(4, 10 + read 10, y % 10)
    LED.iled(4, 40 + read 10, 0)
    LED.iled(4, 50 + read 10, 0)
    LED.show()
    z = z + 1
    if z <= 500 then goto 18110    ' 20 Sek.
    goto 18320
'................................................
' Timer go
18200:
    s = IO.getrtc(0)
    t = s
18205:
    gosub 9000        ' GETKEY
    if k = 1 then goto 18315 'start /stop
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99 'alarm prio
    s = IO.getrtc(0)
    if s = t then goto 18205
    LED.irange(0, 0, 59)
    LED.iled(4,      read 10, y / 10)
    LED.iled(4, 10 + read 10, y % 10)
    LED.iled(4, 20 + read 10, x / 10)
    LED.iled(4, 30 + read 10, x % 10)
    LED.iled(4, 40 + read 10, w / 10)
    LED.iled(4, 50 + read 10, w % 10)
    LED.show()

    w = w - 1
    if w < 0 then gosub 18210
    if x < 0 then gosub 18220
    if w + x + y = 0 then goto 18230 ' timer end music
    goto 18200
18210:
    w = 59
    x = x - 1
    return
18220:
    x = 59
    y = y - 1
    return
18230:
    n = 0
18240:
    t = read 40, n
    d = read 40, n + 1
    n = n + 2
    if t = 0 then goto 99 ' timer end
    IO.beep(t)
    delay d
    IO.beep(0)
    delay 100
goto 18240
'................................................
18300:
    gosub 9100        ' BEEP
18310:
    LED.irange(0, 0, 39)
    LED.iled(4,      read 10, y / 10)
    LED.iled(4, 10 + read 10, y % 10)
    LED.iled(4, 20 + read 10, x / 10)
    LED.iled(4, 30 + read 10, x % 10)
    LED.show()
18315:
    if x + y + w = 0 then goto 18320 ' no timer
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99 'alarm prio
    gosub 9000        ' GETKEY
    if k = 0 then goto 18315
    if k = 1 then goto 18200
    if k = 2 then goto 18320
18320:
    goto 10005
'================================================
'alarm priorisiert bei timer /stoppuhr
18500:
    m = IO.eeread(6)
    r = IO.eeread(7)
    m = m + r
    j = IO.getrtc(2)
    r = IO.getrtc(1)
    r = r + j
    if m = r then a = 2
    return

'================================================
'F9: Stoppuhr
' VAR: w,x,y,t,z,k,w,a
19000:
    y = 0  ' Stopp Hour = 0
    x = 0  ' Stopp Minute = 0
    w = 0  ' Stopp Second = 0
    LED.irange(0, 0, 59)
    LED.iled(4,      read 10, y / 10)
    LED.iled(4, 10 + read 10, y % 10)
    LED.iled(4, 20 + read 10, x / 10)
    LED.iled(4, 30 + read 10, x % 10)
    LED.iled(4, 40 + read 10, w / 10)
    LED.iled(4, 50 + read 10, w % 10)
    LED.show()
    w = w + 1
    goto 19300
'.......................................
' Stoppuhr go
19200:
    s = IO.getrtc(0)
    t = s
19205:
    gosub 9000        ' GETKEY
    if k = 1 then goto 19315 'start /stop
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99 'alarm prio
    s = IO.getrtc(0)
    if s = t then goto 19205
    LED.irange(0, 0, 59)
    LED.iled(4,      read 10, y / 10)
    LED.iled(4, 10 + read 10, y % 10)
    LED.iled(4, 20 + read 10, x / 10)
    LED.iled(4, 30 + read 10, x % 10)
    LED.iled(4, 40 + read 10, w / 10)
    LED.iled(4, 50 + read 10, w % 10)
    LED.show()

    w = w + 1
    if w > 59 then gosub 19210
    if x > 59 then gosub 19220
    if w + x + y = 141 then goto 19230 ' Stoppuhr max (23:59:59)
    goto 19200
19210:
    w = 0
    x = x + 1
    return
19220:
    x = 0
    y = y + 1
    return
19230:
    n = 0
19240:
    t = read 40, n
    d = read 40, n + 1
    n = n + 2
    if t = 0 then goto 99 ' Stoppuhr max end
    IO.beep(t)
    delay d
    IO.beep(0)
    delay 100
goto 19240
'................................................
19300:
    gosub 9100        ' BEEP
19315:
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99 'alarm prio
    gosub 9000        ' GETKEY
    if k = 0 then goto 19315
    if k = 1 then goto 19200
    if k = 2 then goto 19320
19320:
    goto 10005
'================================================
end
