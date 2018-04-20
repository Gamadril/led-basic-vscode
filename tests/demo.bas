' **************************************
' *  CRONIOS1: NIXIE Clock Demo        *
' *  LED-Basic >= 15.1.14 required     *
' *  modyfied by Vanessa Ver. 1.45     *
' **************************************
' Bedienungsanleitung:
'
' Bei Neustart und gleichzeitig gedrückter Taste erfolgt eine Zurücksetzung
' auf standard Werte (Bitte ausführen falls Funktionen nicht funktionieren).
'
' Drehregler stellt die Farben ein, kurzer Druck schaltet zwischen Uhrzeit
' und Datum um. Die Farbeinstellung wird bei Druck gespeichert.
' Datum springt nach ca. 3 Sekunden automatisch auf Uhrzeit zurück.
'
' Langer Druck auf die Taste während Zeitanzeige startet das Einstellungsmenü (weiss).
' Langer Druck auf die Taste während Datumanzeige startet das Systemparameter Menü (blau).
' Drehen = Funktion, kurzer Druck = ausführen, langer Druck = ende.
' Bei Inaktivität nach ca 4 sek zurück auf Zeit (ohne zu speichern).
'
' Alle Einstellungen bleiben bei Stromausfall erhalten ( EEPROM ).
' Bei angeschlossenem Terminal (PC) weitere Ausgabe von Werten.
' Alarm ist priorisiert bei Timer / Stoppuhr.
' Versionsanzeige bei Uhrstart.
' Random (Spielautomat) Anzeige (an / abschaltbar).
' Partymode (an / abschaltbar).
'
' Einstellungsmenü (weiss):
' 0: Helligkeit einstellen (12)
'    1..15 = Helligkeit fest
'    0 = Automatische Helligkeit über Sensor
' 1: Beeper ein/aus (1)
'    0 = aus
'    1 = ein
' 2: Uhrzeit einstellen
'    kurzer Druck wechselt zwischen Stunden, Minuten, Sekunden
'    langer Druck setzt die eingestellte Zeit
' 3: Datum einstellen
'    kurzer Druck wechselt zwischen Tage, Monate, Jahre
'    langer Druck setzt das eingestellte Datum
' 4: Alarm ein/aus (0)
'    0 = aus
'    1 = ein
' 5: Alarmzeit einstellen (12:00)
'    kurzer Druck wechselt zwischen Stunden, Minuten
'    langer Druck setzt die eingestellte Alarmzeit
' 6: Datum auto Anzeige ein/aus (1)
'    0 = aus
'    1 = ein
' 7: Timer (max 23:59:00)
'    kurzer Druck wechselt zwischen Stunden, Minuten
'    langer Druck setzt die eingestellte Timerzeit.
'    Danach kurzer Druck = Start / Stop
'    Langer Druck bei Stop = Ende
' 8: Stoppuhr (max 23:59:59)
'    kurzer Druck = Start / Stop
'    Langer Druck bei Stop = Ende
' 9: Partymode ein/aus (0)
'    0 = aus
'    1 = ein
'
' SYSTEMPARAMETER SETUP (blau):
' 0: Time Offset einstellen (0)
'    0..10 = Offset in Sekunden per 24 Stunden (wird um 2 Uhr aktualisiert)
'
' 1: Time Offset count plus/minus (1)
'    0 = Offset minus
'    1 = Offset plus
'
' 2: Minimum Helligkeit bei Auto Helligkeit (2)
'    0...30 = Minimum Helligkeit
'
' 3: Random (Spielautomat) ein/aus (1)
'    0 = aus
'    1 = ein
'
'******************************************************
### L60 CGRB P1 S2 M92 F40

' Nixie Digit-Index
10: data 5, 0, 6, 1, 7, 2, 8, 3, 9, 4
' Color-Index (0..11)
20: data 5, 20, 50, 90, 130, 160, 200, 260, 300, 340, 1000, 1001, 1002
' Volume-Table
30: data 0, 3, 6, 9, 16, 25, 37, 51, 68, 87, 109, 133, 160, 189, 221, 255
' Music Timer / Stoppuhr max :-)
40:
data 13, 200, 15, 200, 17, 200, 13, 200, 13, 200, 15, 200, 17, 200, 13, 200,
data 17, 200, 18, 200, 20, 400, 17, 200, 18, 200, 20, 400,
' LED-INDEX SET
    led.ihsv(0, 0,   0,   0)  'aus
    led.ihsv(2, 0,   0, 128)  'weiss (Einstellungsmenü)
    led.ihsv(3, 5, 255, 128)  'rot (set alarm)
    led.ihsv(4, 110, 254, 96) 'grün (timer / stoppuhr)
    led.ihsv(5, 37, 254, 96)  'gelb (set date / time)
    led.ihsv(6, 240, 255, 128)'blau (setup system Parameter)
    LED.blackout()

' EEPROM INIT
    gosub 8000
' Version
    LED.iled(2,      read 10, 0)
    LED.iled(2, 10 + read 10, 1)
    LED.iled(2, 20 + read 10, 4)
    LED.iled(2, 30 + read 10, 5)
    LED.show()
    delay 3000
'================================================
' GLOBAL VARS
' c = color,   m = mode, t = temp, i = loop, j = zaehler, r = temp
' z = zaehler, h = hue, v = volume, a = alarm show / auto date, q = Zeitkorrekturflag
'==== STARTUP ===================================
    q = 0 ' Zeitkorrekturflag reset
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
    a = IO.getrtc(2)
    s = IO.getrtc(1)
    r = IO.getrtc(0)
    if a = 2 and s = 0 and r = 15 and q = 0 gosub 300 ' Zeitkorrektur
    if q = 1 and r = 28 then q = 0 ' Zeitkorrekturflag reset
    if s % 10 = 4 or s % 10 = 8 and r / 10 = 0 and (IO.eeread(13)) = 1 then gosub 4000 ' random (Spielautomat)
    if s % 10 = 1 or s % 10 = 3 or s % 10 = 5 or s % 10 = 7 or s % 10 = 9 and (IO.eeread(9)) = 1 and r = 0 goto 2900 ' Partymodus
    s = IO.getrtc(0)
    if s = 50 and (IO.eeread(8)) = 1 goto 180 ' auto Date
    if (IO.eeread(5)) = 0 then goto 108
    s = IO.getrtc(1)
    r = IO.getrtc(0)
    if s % 10 = 2 or s % 10 = 6 and r = 0 gosub 700 ' show alarm
    s = IO.getrtc(2)
    if s <> (IO.eeread(6)) then goto 108
    s = IO.getrtc(1)
    if s = (IO.eeread(7)) then gosub 9105     ' beep.. Alarm !!

108:
    gosub 9000         ' GETKEY
    if k = 0 then goto 200
    if k = 1 then goto 110
    if k = 2 and m = 1 then goto 10100 ' SYSTEMPARAMETER SETUP
    if k = 2 then goto 10000 ' Einstellungsmenü
    goto 100

110:
    gosub 9100         ' BEEP
'==== SHORT PRESS: MODE SWITCH ====
    if m = 0 then goto 180
    if m = 1 then goto 185
    goto 100
180:
    if (IO.eeread(m + 1)) <> c then IO.eewrite(m + 1, c)
    m = 1               ' mode = date
    goto 190
185:
    if (IO.eeread(m + 1)) <> c then IO.eewrite(m + 1, c)
    m = 0               ' mode = time
190:
    c = IO.eeread(m + 1)
    IO.setenc(c, 12, 0) ' set Encoder
    z = 0

200:
    if z & 15 <> 0 then goto 210
    i = IO.getldr() + IO.eeread(12)   ' Minimum Helligkeit Sensor
    if i > 254 then i = 254
    if (IO.eeread(4)) = 0 then v = i else v = read 30, IO.eeread(4) ' Helligkeit

210:
    LED.irange(0, 0, 59)
    if m <> 0 then goto 220
    gosub 500      ' SHOW TIME
    LED.show()
    goto 100
220:
    if m <> 1 then goto 100
    gosub 600      ' SHOW DATE
    LED.show()
    if z > 120 then goto 185  ' Return to TIME after ca. 3sec
    goto 100
'================================================
' ZeitKorrektur (offset)
300:
    if (IO.eeread(11)) = 1 then r = r + IO.eeread(10)
    if (IO.eeread(11)) = 0 then r = r - IO.eeread(10)
    IO.setrtc(0, r)
    q = 1 ' Zeitkorrekturflag set
    return
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

    z = z + 1
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
    gosub 1000        ' Year 1

    z = z + 1
    return
'================================================
' SHOW Alarm
' VAR: n, p, s, i
700:
    if (IO.eeread(5)) = 1 and (IO.eeread(6)) + (IO.eeread(7)) = a + s then return ' alarm
    LED.irange(0, 0, 59)

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
    h = (z / 4) % 360
    goto 1090
1030:
    if t <> 1002 then goto 1030
    LED.ihsv(1, h, 255, v)
    h = (p * 6 + z) % 360
1090:
    LED.iled(1, p + read 10, n)
    return
'================================================
' Partymodus
2900:
    if (IO.eeread(5)) = 1 and (IO.eeread(6)) + (IO.eeread(7)) = a + s then goto 100 ' alarm
    i = random
    if i <= 4681 then gosub 3000 ' Partymodus
    if i > 4681 and i <= 9362 then gosub 3100 ' Partymodus
    if i > 9362 and i <= 14043 then gosub 3200 ' Partymodus
    if i > 14043 and i <= 18724 then gosub 3300 ' Partymodus
    if i > 18724 and i <= 23405 then gosub 3400 ' Partymodus
    if i > 23405 and i <= 28086 then gosub 3500 ' Partymodus
    if i > 28086 then gosub 3600 ' Partymodus
    goto 100
'............................................................
3000:
     for n = 1 to 300
        c = random % 360
        a = random % 60
        led.lhsv(a, c, 255, v)    ' Farbe
        if a - 1 >= 0 then LED.iled(0, a - 1)
        led.show()
        delay 50
     next n
     return
'............................................................
3100:
    for n = 1 to 3
3110:
    a = Random % 360
    b = Random % 360
    if a = b then goto 3110
        for i = 0 to 60
            LED.iall(0)
            led.lhsv(i,a, 255, v)      ' Farbe
            led.lhsv(60 - i, b, 255, v) ' Farbe
           led.show()
           delay 80
        next i
    next n
    return
'............................................................
3200:
    a = Random % 360
    b = Random % 360
    n = Random % 360
    z = Random % 360
    for i = 0 to 249
        LED.iall(0)
        led.lhsv(i % 60, z, 255, v)
        led.lhsv(60 - ((i + 1) % 60), a, 255, v)
        led.lhsv((i + 9) % 60, b, 255, v)
        led.lhsv(60 - ((i + 10) % 60), n, 255, v)
        led.show()
        delay 80
    next i
    return
'............................................................
3300:
    LED.iall(0)
    z = Random % 360
    for n = 0 to 5
      for i = 60 downto 0
      if n % 2 = 0 then led.lhsv(i, (z + n * i) % 360, 255, v) else led.lhsv(60 - i,(z + n * i) % 360, 255, v)
      led.show()
      next i
    next n
    return
'............................................................
3400:
    h = random % 360
    for i = 1 to 500
    LED.rainbow(h, 255, v, 0, 60, 3)
    LED.show()
    h = (h + i / 10) % 360
    next i
    return
'............................................................
3500:
    h = random % 360
    for i = 1 to 220
    LED.iall(0)
    LED.ihsv(9, (h + i) % 360, 255, v)
    LED.iled(9, h % 20)
    LED.repeat(0, 22, 2)
    LED.show()
    h = h + 1
    delay 80
    next i
    return
'............................................................
3600:
    for z = 1 to 350
    i = random % 100
    if i < 75 goto 3665
    h = ((random % 256) * v) / 256
    LED.ihsv(9, 0, 0, h)
    LED.iall(9)
3665:
    LED.show()
    next z
    return
'================================================
' SHOW Random (Spielautomat)
' VAR: s, n, p, i
4000:
    if (IO.eeread(5)) = 1 and (IO.eeread(6)) + (IO.eeread(7)) = a + s then return ' alarm
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

     z = z + 4
     LED.show()
     delay 10 + i * 2
    next i
    s = IO.getrtc(1)
    return
'================================================
' EEPROM INIT
8000:
    z = IO.getkey() 'Sartup INIT (Reset)
    if z = 1 then IO.eewrite(0, 0xFFFF)
    t = IO.eeread(0)
    if t = 0xABCD then goto 8010
    gosub 9105 ' beep
    IO.eewrite(1, 1)             ' 1 = Color Time (1)
    IO.eewrite(2, 5)             ' 2 = Color Date (5)
    IO.eewrite(3, 1)             ' 3 = Beep       (1)
    IO.eewrite(4, 12)            ' 4 = Bright     (12)
    IO.eewrite(5, 0)             ' 5 = Alarm      (0)
    IO.eewrite(6, 12)            ' 6-7 = Alarm Zeit (Stunde. Minute)(12,0)
    IO.eewrite(7, 0)             ' 6-7 = Alarm Zeit (Stunde. Minute)(12,0)
    IO.eewrite(8, 1)             ' 8 = Datum auto Anzeige (1)
    IO.eewrite(9, 0)             ' 9 = Partymodus (0)
    IO.eewrite(10, 0)            ' 10 = Time Offset (0)
    IO.eewrite(11, 1)            ' 11 = Time Offset count plus / minus (1)
    IO.eewrite(12, 2)            ' 12 = Min Brightness bei Auto (2)
    IO.eewrite(13, 1)            ' 13 = random (spielautomat) (1)
    IO.eewrite(0, 0xABCD)        ' 0 = 0xABCD
8010:
    print "CRONIOS1 NIXIE"
    print "  by Vanessa"
    for i = 0 to 13   ' Ausgabe der EEPROM-Daten
     t = IO.eeread(i)
     print "EEP[";i;"] = ";t
    next i
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
    if (IO.eeread(3)) = 0 then goto 9110 ' no beep
9105:
    IO.beep(35)
    delay 25
    IO.beep(0)
9110:
    return
'================================================
' Einstellungsmenü
' VAR p: position, t: temp, y: value
10000:
    gosub 9100        ' BEEP
    p = 0
10005:
    z = 0
    IO.setenc(p, 9, 0)
10010:
    t = IO.getenc()    ' Read Encoder
    if t = p then goto 10020
    p = t
    z = 0              ' zaehler reset
10020:
    gosub 9000         ' GETKEY
    if k = 0 then goto 10050
    if k = 1 then goto 10060
    gosub 9100         ' BEEP
    goto 99
10050:
    LED.irange(0, 0, 59)
    if z & 15 < 11 then LED.iled(2, read 10, p) ' weiss setup
    LED.show()
    z = z + 1
    if z > 300 then goto 99    ' RETURN
    goto 10010

10060:
    if p = 0 then goto 11000 ' F0: BRIGHT SETUP
    if p = 1 then goto 12000 ' F1: BEEP SETUP on / off
    if p = 2 then goto 13000 ' F2: TIME SETUP
    if p = 3 then goto 14000 ' F3: DATE SETUP
    if p = 4 then goto 15000 ' F4: ALARM on / off
    if p = 5 then goto 16000 ' F5: ALARM SETUP
    if p = 6 then goto 17000 ' F6: Auto Datum Anzeige on / off
    if p = 7 then goto 18000 ' F7: Timer set and go
    if p = 8 then goto 19000 ' F8: Stoppuhr
    if p = 9 then goto 20000 ' F9: Partymodus SETUP on / off
    goto 10010
'================================================
' SYSTEMPARAMETER SETUP
' VAR p: position, t: temp, y: value
10100:
    gosub 9100        ' BEEP
    p = 0
10105:
    z = 0
    IO.setenc(p, 3, 0)
10110:
    t = IO.getenc()    ' Read Encoder
    if t = p then goto 10120
    p = t
    z = 0              ' zaehler reset
10120:
    gosub 9000         ' GETKEY
    if k = 0 then goto 10150
    if k = 1 then goto 10160
    gosub 9100         ' BEEP
    goto 99
10150:
    LED.irange(0, 0, 59)
    if z & 15 < 11 then LED.iled(6, read 10, p) ' blau system setup
    LED.show()
    z = z + 1
    if z > 300 then goto 99    ' RETURN
    goto 10110

10160:
    if p = 0 then goto 11100 ' S0: TIME OFFSET Sek. per 24 Stunden
    if p = 1 then goto 12100 ' S1: TIME OFFSET count plus / minus
    if p = 2 then goto 11200 ' S2: MIN BRIGHTNESS bei Auto Helligkeit
    if p = 3 then goto 12200 ' S3: RANDOM ON / OFF
    'if p = 4 then goto 15000 ' S4:
    'if p = 5 then goto 16000 ' S5:
    'if p = 6 then goto 17000 ' S6:
    'if p = 7 then goto 18000 ' S7:
    'if p = 8 then goto 19000 ' S8:
    'if p = 9 then goto 20000 ' S9:
    goto 10110
'================================================
' F0: BRIGHT SETUP
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
    LED.iled(3, read 10, 0)
    LED.show()
    z = z + 1
    if z <= 300 then goto 11010
11070:
    if y <> (IO.eeread(4)) then IO.eewrite(4, y) ' Read Bright Value
    goto 10005
'================================================
' S0: TIME OFFSET Sek. per 24 Stunden
' VAR: y,t,z,k
11100:
    gosub 9100          ' BEEP
    y = IO.eeread(10)   ' Read Offset Value
11105:
    z = 0
    IO.setenc(y, 10, 0)
11110:
    t = IO.getenc()
    if t = y then goto 11120
    y = t
    z = 0
11120:
    gosub 9000        ' GETKEY
    if k = 0 then goto 11150
    gosub 9100        ' BEEP
    goto  11170
11150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 11160
    LED.iled(2, 40 + read 10, y / 10)
    LED.iled(2, 50 + read 10, y % 10)
11160:
    LED.iled(6, read 10, 0)
    LED.show()
    z = z + 1
    if z <= 300 then goto 11110
11170:
    if y <> (IO.eeread(10)) then IO.eewrite(10, y) ' Read Offset Value
    goto 10105
'================================================
' S2: MIN BRIGHTNESS bei Auto Helligkeit
' VAR: y,t,z,k
11200:
    gosub 9100          ' BEEP
    y = IO.eeread(12)    ' Read Min Brightness Value
11205:
    z = 0
    IO.setenc(y, 30, 0)
11210:
    t = IO.getenc()
    if t = y then goto 11220
    y = t
    z = 0
11220:
    gosub 9000        ' GETKEY
    if k = 0 then goto 11250
    gosub 9100        ' BEEP
    goto  11270
11250:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 11260
    LED.iled(2, 40 + read 10, y / 10)
    LED.iled(2, 50 + read 10, y % 10)
11260:
    LED.iled(6, read 10, 2)
    LED.show()
    z = z + 1
    if z <= 300 then goto 11210
11270:
    if y <> (IO.eeread(12)) then IO.eewrite(12, y) ' Read Min Brightness Value
    goto 10105
'================================================
' F1: BEEP SETUP on / off
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
    LED.iled(3, read 10, 1)
    LED.show()
    z = z + 1
    if z <= 300 then goto 12010
12070:
    if y <> (IO.eeread(3)) then IO.eewrite(3, y) ' Read Beep Value
    goto 10005
'================================================
' S1: TIME OFFSET count plus / minus
' VAR: y,t,z,k
12100:
    gosub 9100        ' BEEP
    y = IO.eeread(11)  ' Read offset count Value
12105:
    z = 0
    IO.setenc(y, 1, 0)
12110:
    t = IO.getenc()
    if t = y then goto 12120
    y = t
    z = 0
12120:
    gosub 9000        ' GETKEY
    if k = 0 then goto 12150
    gosub 9100        ' BEEP
    goto  12170
12150:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 12160
    LED.iled(2, 50 + read 10, y)
12160:
    LED.iled(6, read 10, 1)
    LED.show()
    z = z + 1
    if z <= 300 then goto 12110
12170:
    if y <> (IO.eeread(11)) then IO.eewrite(11, y) ' Read offset count Value
    goto 10105
'================================================
' S3: Random (Spielautomat) ein/aus
' VAR: y,t,z,k
12200:
    gosub 9100        ' BEEP
    y = IO.eeread(13)  ' Read random Value
12205:
    z = 0
    IO.setenc(y, 1, 0)
12210:
    t = IO.getenc()
    if t = y then goto 12220
    y = t
    z = 0
12220:
    gosub 9000        ' GETKEY
    if k = 0 then goto 12250
    gosub 9100        ' BEEP
    goto  12270
12250:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 12260
    LED.iled(2, 50 + read 10, y)
12260:
    LED.iled(6, read 10, 3)
    LED.show()
    z = z + 1
    if z <= 300 then goto 12210
12270:
    if y <> (IO.eeread(13)) then IO.eewrite(13, y) ' Read random Value
    goto 10105
'================================================
' F2: TIME SETUP
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
' F3: DATE SETUP
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
' F4: ALARM on / off
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
    LED.iled(3, read 10, 4)
    LED.show()
    z = z + 1
    if z <= 300 then goto 15010
15070:
    if y <> (IO.eeread(5)) then IO.eewrite(5, y) ' Read alarm Value
    goto 10005

'================================================
' F5: ALARM SETUP
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
    if x <> (IO.eeread(7)) then IO.eewrite(7, x) ' Write alarm Minutes
    if y <> (IO.eeread(6)) then IO.eewrite(6, y) ' Write alarm Hours
16320:
    goto 10005
'================================================
' F6: Auto Datum Anzeige on / off
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
    LED.iled(3, read 10, 6)
    LED.show()
    z = z + 1
    if z <= 300 then goto 17010
17070:
    if y <> (IO.eeread(8)) then IO.eewrite(8, y) ' Read auto Datum Value
    goto 10005
'================================================
' F7: Timer set and go
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
    if k = 1 then goto 18315 ' start /stop
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99     ' alarm prio
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
    if a = 2 goto 99  ' alarm prio
    gosub 9000        ' GETKEY
    if k = 0 then goto 18315
    if k = 1 then goto 18200
    if k = 2 then goto 18320
18320:
    goto 10005
'================================================
' Alarm priorisiert bei Timer / Stoppuhr
18500:
    if (IO.eeread(6)) + (IO.eeread(7)) = (IO.getrtc(1)) + (IO.getrtc(2)) then a = 2
    return

'================================================
' F8: Stoppuhr
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
    if k = 1 then goto 19315 ' start /stop
    a = IO.eeread(5)
    if a = 1 gosub 18500
    if a = 2 goto 99 ' alarm prio
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
    if a = 2 goto 99  ' alarm prio
    gosub 9000        ' GETKEY
    if k = 0 then goto 19315
    if k = 1 then goto 19200
    if k = 2 then goto 19320
19320:
    goto 10005
'================================================
' F9: Partymodus SETUP on / off
' VAR: y,t,z,k
20000:
    gosub 9100        ' BEEP
    y = IO.eeread(9)  ' Read Partymode Value
20005:
    z = 0
    IO.setenc(y, 1, 0)
20010:
    t = IO.getenc()
    if t = y then goto 20020
    y = t
    z = 0
20020:
    gosub 9000        ' GETKEY
    if k = 0 then goto 20050
    gosub 9100        ' BEEP
    goto  20070
20050:
    LED.irange(0, 0, 59)
    if z & 15 > 10 then goto 20060
    LED.iled(2, 50 + read 10, y)
20060:
    LED.iled(3, read 10, 9)
    LED.show()
    z = z + 1
    if z <= 300 then goto 20010
20070:
    if y <> (IO.eeread(9)) then IO.eewrite(9, y) ' Read Partymode Value
    goto 10005
'================================================
end
