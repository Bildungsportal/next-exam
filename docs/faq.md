# Fehlerbehandlung – FAQ

## Verbindungsprobleme

### Die Prüfung wird nicht automatisch gefunden

Next-Exam ist eine Netzwerkapplikation. Überprüfen Sie, ob alle Teilnehmer:innen:

- sich im selben Netzwerk befinden,
- dieselbe Version von Next-Exam verwenden (Teacher und Student).

Die Firewall muss die Anwendung zulassen. Wird die Prüfung nicht automatisch gefunden, kann bei den Schüler:innen über **Manuell suchen** die **Server-Adresse** aus dem Teacher-Dashboard eingegeben werden.

### Versionsmismatch

Stimmen die Programmversionen von Teacher und Student nicht überein, wird die Anmeldung mit der Meldung **„Die Programmversionen stimmen nicht überein“** verweigert. In diesem Fall auf allen Geräten dieselbe Version installieren (Hinweis in der Student-App: Version zu alt / zu neu).

### Welche Ports werden von Next-Exam verwendet?

- Die **Teacher-API** nutzt Port **22422 (TCP)**.
- Für die automatische Erkennung („Autodiscovery“) von Prüfungen muss **Multicast** im lokalen Netzwerk erlaubt sein.
- Verwendete **Multicast-Ports (UDP)**: **6024** und **6025**.

### Next-Exam funktioniert nicht über VLANs hinweg

*Dies ist eine erwünschte Einschränkung und eine der Hauptfunktionen von VLANs. Dies kann nicht von der Software behoben werden.*

Sie können auf Ihrem Layer-3-Gerät jedoch dafür sorgen, dass Port 22422 (Teacher-API) über die VLANs hinweg geroutet wird. Erstellen Sie z. B. auf einer OPNsense-Firewall eine „pass“-Regel für das Zielnetzwerk mit Port-Filter 22422. Die automatische Erkennung funktioniert über VLANs hinweg nicht; die Schüler:innen geben die Server-Adresse manuell ein.

---

## Schüler:innenseite

### Next-Exam Student muss neu gestartet werden

Bei Fehlern in Next-Exam Student sollte das Programm geschlossen und neu gestartet werden. Der Editor bzw. Active Sheets stellt vorhandene Sicherungen automatisch wieder her („Backup gefunden“). Die Lehrkraft kann zusätzlich bereits geholte Sicherungen an die betroffene Person senden, um die Prüfung nahtlos fortzusetzen.

### Endgerät auf Schüler:innenseite muss getauscht werden

1. Neues Endgerät und Next-Exam Student starten.
2. Anmeldung (mit Name, Pincode und ggf. Server-Adresse) an der laufenden Prüfung.
3. Die Lehrkraft schickt der Person über den Dateimanager das letzte Backup.

### Datei wiederherstellen

Die Lehrkraft öffnet den Dateimanager (**Ordner öffnen**), wählt im Schüler:innen-Ordner die gewünschte Sicherung (Zeitstempel-Ordner) und sendet sie über **Datei senden** an die Person zurück. Im Editor kann der Inhalt der Datei übernommen werden.

---

## Lehrpersonenseite

### Prüfung fortsetzen

Jede Prüfung bleibt im Arbeitsordner **EXAM-TEACHER** gespeichert. Auf der Startseite unter **Lokale Prüfungen** die Prüfung anklicken, um sie mit allen Einstellungen fortzusetzen.

### Endgerät der Lehrkraft muss getauscht werden

1. Neues Endgerät und Next-Exam Teacher starten.
2. Prüfung mit demselben Namen und denselben Einstellungen wieder anlegen (oder aus dem Backupverzeichnis übernehmen).
3. **WICHTIG:** Die Schüler:innen verbinden sich **noch nicht** zum neuen Gerät. Zuerst muss **Geräte absichern** betätigt werden, um den abgesicherten Modus serverseitig erneut zu aktivieren.
4. Erst jetzt wird der PIN der neuen Prüfung mitgeteilt und die Schüler:innen melden sich neu an. Da sie den Prüfungsmodus nicht verlassen haben, gehen keine Inhalte verloren; sie werden automatisch übertragen. Verbinden sich Schüler:innen mit einer nicht abgesicherten Prüfung, wird die Prüfung auf ihrer Seite sofort beendet.
5. Optional kann aus dem Backupverzeichnis die letzte Version an einzelne Schüler:innen gesendet werden.

### Backup

Über **Erweitert** beim Prüfungsstart kann ein **Backupverzeichnis** (z. B. Netzwerkordner, USB-Stick) festgelegt werden; dort wird eine Kopie des Arbeitsverzeichnisses gepflegt.

---

## LanguageTool funktioniert nicht

Antivirenprogramme wie **Avast** oder **Norton** können die lokale LanguageTool-Instanz blockieren. In diesem Fall `Next-Exam-Student.exe` aus der Liste blockierter Programme entfernen bzw. zur Ausnahmeliste hinzufügen.

Zeigt der Teacher die Warnung, dass auf Port 8088 ein fremder Dienst lauscht („nicht LanguageTool“), belegt eine andere Anwendung am Schüler:innen-Gerät diesen Port; diese Anwendung beenden.

---

## Screenshots auf macOS funktionieren nicht

macOS benötigt eine explizite Berechtigung zur Bildschirmaufnahme. Wird diese nicht erteilt, überträgt Next-Exam nur das Programmfenster. Mit folgendem Terminalbefehl können alle Berechtigungen von Next-Exam zurückgesetzt und beim nächsten Start neu angefordert werden:

```bash
tccutil reset All com.nextexam.student
```

---

## Screenshots auf Linux funktionieren nicht

Wird beim Start die Bildschirmfreigabe nicht (oder nur für ein Fenster statt des gesamten Desktops) erteilt, fordert Next-Exam zum Neustart mit vollständiger Freigabe auf. Auf Gnome/Wayland-Systemen den kompletten Bildschirm im Freigabedialog auswählen.

---

## Ubuntu 22.04 kann *.AppImage-Pakete nicht starten

**libfuse2** muss auf Ubuntu nachinstalliert werden:

```bash
sudo apt install libfuse2
```

---

## Neuere Ubuntu-basierte Linux-Varianten können *.AppImage-Pakete nicht starten

**AppArmor** erlaubt keine unprivilegierten User-Namespaces. Mit folgenden Befehlen kann die Restriktion dauerhaft deaktiviert werden:

```bash
echo "kernel.apparmor_restrict_unprivileged_userns = 0" | sudo tee /etc/sysctl.d/20-apparmor-userns.conf
sudo sysctl -p /etc/sysctl.d/20-apparmor-userns.conf
```

Temporär kann das AppImage auch mit `--no-sandbox` gestartet werden.
