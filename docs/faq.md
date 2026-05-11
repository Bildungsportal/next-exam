
# Fehlerbehandlung – FAQ

## Fehlermeldungen beim Verbindungsaufbau und deren Ursachen

Überprüfen Sie, ob alle Teilnehmer:innen:

- sich im selben Netzwerk befinden,
- kompatible Versionen von Next-Exam verwenden (Lehrpersonen und Schüler:innen).

Wird die Prüfung nicht automatisch gefunden, kann die Server-Adresse bei den Schüler:innen manuell eingegeben werden, um eine Verbindung zu **Next-Exam-Teacher** herzustellen.

---

## Schüler:innenseite

### Next-Exam-Student muss neu gestartet werden

Bei Fehlern in **Next-Exam-Student** sollte das Programm geschlossen und neu gestartet werden.
Der Editor stellt bereits vorhandene Dateien automatisch wieder her. Die Lehrperson kann zusätzlich bereits gesicherte Dateien an die betroffene Person senden, um die Prüfung nahtlos fortzusetzen.

### Endgerät auf Schüler:innenseite muss getauscht werden
Schritt für Schritt:
1. Neues Endgerät und Next-Exam-Student starten
2. Anmeldung (mit PIN und ev. IP-Adresse) an der bereits laufenden Prüfung
3. Die Lehrperson schickt dem Schüler/der Schülerin das letzte Backup

---

## Lehrpersonenseite

### Endgerät muss getauscht werden

Schritt für Schritt:

1. Neues Endgerät und Next-Exam-Teacher starten
2. Prüfung mit dem selben Namen und den selben Einstellungen wieder anlegen.
3. **WICHTIG!** Die Schüler:innen verbinden sich **NOCH NICHT** zum neuen Gerät.  
   Zuerst muss der Button „0 Geräte absichern“ betätigt werden, um die **Absicherung der Geräte** erneut zu aktivieren.
4. Der PIN der neuen Prüfung wird den Schüler:innen **erst jetzt** mitgeteilt und sie melden sich an der neuen Prüfung an.  
   Da die Schüler:innen den Prüfungsmodus nicht verlassen haben, sind die Inhalte nicht verloren gegangen. Sie werden automatisch an den Teacher übertragen.  
   Verbinden sich die Schüler:innen mit einer nicht gesicherten Umgebung, führt dies zum sofortigen Abbruch der Prüfung auf Schüler:innenseite.
5. Falls es notwendig ist, kann optional aus dem Backupverzeichnis die letzte Version an den/die Schüler:in gesendet werden.

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

Mit Hilfe von folgendem Terminalbefehl können sie alle Berechtigungen von Next-Exam löschen und beim nächsten Start neu setzen.

```bash
tccutil reset All com.nextexam-student.app
```


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

## Neuere Ubuntu basierte Linux Variannten können *.AppImage* Pakete nicht starten

**appArmor** erlaubt keine unpriviligierten Usernamespaces. Mit folgendem Befehl können sie die Restriktion dauerhaft deaktivieren.

```bash
echo "kernel.apparmor_restrict_unprivileged_userns = 0" | sudo tee /etc/sysctl.d/20-apparmor-userns.conf

sudo sysctl -p /etc/sysctl.d/20-apparmor-userns.conf // Apply change instantly

```
Temporär kann man das AppImage auch mit `--no-sandbox` starten.

---

## Next-Exam funktioniert nicht über VLANs hinweg

*Dies ist eine erwünschte Einschränkung und eine der Hauptfunktionen von VLANs. Dies kann nicht von der Software behoben werden.*

Sie können auf ihrerm Layer3 Device jedoch dafür sorgen dass der Port 22422 (Next-Exam Teacher API Port) über die VLANs hinweg geroutet wird. Dazu erstellen Sie zB. auf der "OPNSense" Firewall eine "pass" Regel für das Ziel Netzwerk. Bei "Port" filtern sie den Port "22422"

Durch diese Einstellungen werden Ziele in anderen Subnetzen erreichbar sofern der definierte Port angesprochen wird.
