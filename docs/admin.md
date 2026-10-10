# Systemvoraussetzungen
Die konkreten Anforderungen an das System hängen vom verwendeten Prüfungsmodus und den darin eingesetzten Anwendungen ab.

## Grundvoraussetzungen

Für den normalen Betrieb von Next-Exam gelten folgende Voraussetzungen:

- aktuelles **Windows, macOS oder Linux**
- funktionsfähige **Netzwerkverbindung** zwischen Teacher- und Student-Geräten
- **Next-Exam Teacher und Student müssen dieselbe Version** verwenden
- die lokale Firewall muss die Kommunikation von Next-Exam zulassen
- für die automatische Erkennung im lokalen Netzwerk muss **Multicast** möglich sein
- alternativ kann eine Verbindung über die Server-Adresse manuell hergestellt werden

!!! info "Hardware-Mindestanforderung"
    Für den normalen Betrieb von Next-Exam ist keine spezielle Hochleistungs-Hardware erforderlich. Die tatsächlichen Hardwareanforderungen hängen vom verwendeten Prüfungsmodus und den eingesetzten Anwendungen ab.

## Anforderungen je nach Prüfungsmodus

### Kiosk-Modus unter Windows

Für den Kiosk-Modus unter Windows gelten zusätzliche Voraussetzungen:

- Windows **Pro, Education, Enterprise oder IoT Enterprise**
- Administratorrechte für die Einrichtung
- Windows Home wird für diesen Modus nicht unterstützt

### Lokale VM

Bei Verwendung einer lokalen virtuellen Maschine (Local VM) sind zusätzliche Voraussetzungen erforderlich:

- **QEMU**
- aktivierte Hardware-Virtualisierung:
  - Intel VT-x oder
  - AMD-V
- unter Windows zusätzlich die **Windows Hypervisor Platform**

### macOS und Linux

Unter macOS und Linux können für bestimmte Funktionen zusätzliche Systemberechtigungen erforderlich sein.

Dies betrifft insbesondere Funktionen wie:

- Bildschirmüberwachung
- Bildschirmaufnahmen bzw. Screenshots
- Zugriff auf bestimmte Systemressourcen

## Netzwerk

Next-Exam benötigt eine funktionierende Netzwerkkommunikation zwischen den beteiligten Geräten.

Bei einem typischen Prüfungsszenario sollten daher insbesondere folgende Punkte berücksichtigt werden:

- Teacher- und Student-Geräte befinden sich im erreichbaren Netzwerk.
- Die erforderlichen Verbindungen werden nicht durch eine Firewall blockiert.
- Bei automatischer Geräteerkennung ist **Multicast** im lokalen Netzwerk verfügbar.
- Bei getrennten Netzwerken oder eingeschränkter Multicast-Unterstützung kann die Verbindung über eine Server-Adresse hergestellt werden.

## Empfehlung für Schulen

Für einen stabilen Schulbetrieb empfiehlt es sich, Next-Exam vor dem ersten Einsatz auf den tatsächlich verwendeten Schulgeräten und im vorhandenen Schulnetzwerk zu testen.

Dabei sollten insbesondere folgende Punkte geprüft werden:

1. Installation und Start von Next-Exam Student
2. Verbindung zwischen Teacher und Student
3. Firewall- und Netzwerkeinstellungen
4. verwendeter Prüfungsmodus
5. benötigte Systemberechtigungen



## Installation

Next-Exam steht für Windows, macOS und Linux zur Verfügung. Je nach Verwendung wird zwischen **Next-Exam Student** und **Next-Exam Teacher** unterschieden.

### 1. Next-Exam herunterladen

Die aktuellen Installationsdateien stehen auf der GitHub-Seite von Next-Exam zur Verfügung:

[Next-Exam Releases auf GitHub](https://github.com/Bildungsportal/next-exam/releases)

Wählen Sie dort die gewünschte Version und laden Sie die passende Datei für Ihr Betriebssystem herunter.

| Betriebssystem | Student | Teacher |
|---|---|---|
| **Windows** | `.exe` oder `.msi` | `.exe` oder `.msi` |
| **macOS** | `.dmg` für Intel oder Apple Silicon | `.dmg` für Intel oder Apple Silicon |
| **Linux** | `.AppImage` | `.AppImage` |

!!! tip
    Verwenden Sie nach Möglichkeit die **aktuelle stabile Version**. Pre-Releases sind für Tests und zur Erprobung neuer Funktionen vorgesehen.

### 2. Installation

### Windows

Laden Sie die **EXE- oder MSI-Datei** herunter und starten Sie die Installation.

- **EXE:** portable-Version - keine Installation notwendig.
- **MSI:** Zur Installation (bzw. automatisierten Verteilung) vorgesehen.

Nach Abschluss der Installation kann Next-Exam über das Startmenü gestartet werden.

### macOS

Laden Sie die für Ihren Mac passende **DMG-Datei** herunter:

- **ARM64** für Macs mit Apple Silicon
- **Intel x64** für Macs mit Intel-Prozessor

Öffnen Sie anschließend die DMG-Datei und ziehen Sie Next-Exam in den Ordner **Programme**.

### Linux

Laden Sie die passende **AppImage-Datei** herunter.

Machen Sie die Datei anschließend ausführbar und starten Sie Next-Exam:

```bash
chmod +x Next-Exam-*.AppImage
./Next-Exam-*.AppImage