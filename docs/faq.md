
# Fehlerbehandlung – FAQ

## Fehlermeldungen beim Verbindungsaufbau und deren Ursachen

Überprüfen Sie, ob alle Teilnehmer:innen:

- sich im selben Netzwerk befinden,
- kompatible Versionen von Next-Exam verwenden (Lehrpersonen und Schüler:innen).

Wird die Prüfung nicht automatisch gefunden, kann die IP-Adresse bei den Schüler:innen manuell eingegeben werden, um eine Verbindung zu **Next-Exam-Teacher** herzustellen.

---

## Fortsetzen der Prüfung bei Fehlern auf Schüler:innenseite

Bei Fehlern in **Next-Exam-Student** sollte das Programm geschlossen und neu gestartet werden.  
Der Editor stellt bereits vorhandene Dateien automatisch wieder her. Die Lehrperson kann zusätzlich bereits gesicherte Dateien an die betroffene Person senden, um die Prüfung nahtlos fortzusetzen.

---

## Fortsetzen der Prüfung bei Fehlern auf Lehrpersonenseite

Wird **Next-Exam-Teacher** während einer laufenden Prüfung beendet, ist Folgendes zu beachten:

- Die Schüler:innen dürfen die Verbindung zum Prüfungsserver erst wiederherstellen, wenn **Next-Exam-Teacher** erneut gestartet und alle Einstellungen wiederhergestellt wurden.
- Insbesondere muss die **Absicherung der Geräte** erneut aktiviert werden. Andernfalls verbinden sich die Schüler:innen mit einer nicht gesicherten Umgebung, was zum sofortigen Abbruch der Prüfung führt.

---

## LanguageTool funktioniert nicht

Antivirenprogramme wie **Avast Antivirus** oder **Norton Antivirus** können die LanguageTool-Funktion blockieren.  
In diesem Fall:

1. Starten Sie das Programm „Avast Security“.
2. Entfernen Sie `Next-Exam-Student.exe` aus der Liste blockierter Programme oder fügen Sie es zur Ausnahmeliste hinzu.

---

## Screenshots auf macOS funktionieren nicht

macOS benötigt eine explizite Berechtigung zum Erstellen von Screenshots.  
Wird diese nicht erteilt, überträgt **Next-Exam** nur das Programmfenster.

---

## Screenshots auf Linux funktionieren nicht

Linux benötigt **ImageMagick**, um Screenshots zu erstellen.  
Ist dieses nicht installiert, überträgt **Next-Exam** nur das Programmfenster.  
Auf **Gnome/Wayland-Systemen** werden Screenshots derzeit nicht unterstützt.

---

## Die Prüfung wird nicht automatisch gefunden

**Next-Exam** ist eine Netzwerkapplikation. Um die volle Funktionalität zu gewährleisten, muss die Firewall die Anwendung zulassen.  
Falls keine Ausnahme für Schüler:innen gesetzt werden kann, muss die IP-Adresse der Lehrperson manuell eingegeben werden.

---

## Welche Ports werden von Next-Exam verwendet?

- Die **Teacher-API** nutzt Port **22422 (TCP)**.
- Für die automatische Erkennung („Autodiscovery“) von Prüfungen muss **Multicast** im lokalen Netzwerk erlaubt sein.
- Verwendete **Multicast-Ports (UDP)**: **6024** und **6025**.

---

## Ubuntu 22.04 kann *.AppImage Pakete nicht starten

**libfuse2** muss auf Ubuntu nachinstalliert werden.
>sudo apt install libfuse2

---

## Neuere Linux Ubuntu basierte Varianten können Next-Exam nicht starten

> echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-electron.conf  
> sudo sysctl --system

deaktiviert die Einschränkung von User Namespaces durch **AppArmor**. Electron benötigt dies oft für AppImages, da es sonst keine ausreichenden Rechte bekommt, um richtig zu starten.