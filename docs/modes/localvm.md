# Prüfungsmodus Lokale VM

Im Modus **LocalVM** läuft die Prüfung in einer **lokalen virtuellen Maschine (QEMU)** direkt auf dem Schüler:innen-Gerät. Die Lehrkraft stellt ein vorbereitetes VM-Image (QCOW2) bereit; die Schüler:innen arbeiten im Vollbild in der VM.

!!! warning "Übertragungszeit einplanen"
    VM-Images sind groß und die Übertragung an die Schüler:innen-Geräte kann entsprechend lange dauern. Das Bereitstellen bzw. Herunterladen der VM-Disk muss daher unbedingt **im Vorfeld der Prüfung** erledigt werden, nicht erst am Prüfungstag.

## Lehrkraft

### Voraussetzungen

- **QEMU** muss auf dem Teacher-Gerät als System-Installation vorhanden sein. Fehlt QEMU, zeigt Next-Exam den Dialog „QEMU nicht gefunden“ mit Link zur Download-Seite.
- Unter **Windows** nutzt LocalVM QEMU mit **WHPX**; dafür muss das Windows-Feature „Hypervisor Platform“ aktiviert sein:

    ```powershell
    Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
    ```

    (PowerShell als Administrator, danach ggf. Neustart.)

### Konfiguration

1. Prüfungsmodus **LocalVM** wählen und das VM-Basisimage (QCOW2) festlegen. Das Image wird den Schüler:innen zum Download angeboten; Größe bzw. SHA-256-Prüfsumme dienen der Integritätsprüfung auf Schüler:innen-Seite.
2. **VM booten:** Die Lehrkraft kann die VM zur Kontrolle oder Vorbereitung selbst starten:
    - **Unveränderlich:** Boot über ein Overlay-QCOW2 – die Basis-Disk bleibt unberührt.
    - **Anpassbar:** Boot direkt von der Basis-Disk – die VM wird dadurch verändert und muss anschließend neu ausgerollt werden (Größe/SHA-256 ändern sich).
    - Die Anzeige erfolgt per **VNC** (ein externer Viewer wird geöffnet).
3. **VM-Auflösung (Student VNC):** Auswahl der Anzeigeauflösung für die Schüler:innen (1920×1080 Standard, außerdem 1680×1050, 1440×900, 1280×700, 1024×768).

## Schüler:in

Auch am Schüler:innen-Gerät muss **QEMU installiert** und die **Hardware-Virtualisierung** (Intel VT-x bzw. AMD-V) im BIOS/UEFI aktiviert sein; andernfalls erscheinen entsprechende Hinweisdialoge. Vor dem Start führt Next-Exam eine **Systemprüfung** zur Kompatibilität durch.

Ablauf beim Absichern:

1. **VM-Disk beziehen:** Falls noch nicht vorhanden, wird die VM-Disk über **„VM von Teacher holen“** heruntergeladen oder über **„Dateisystem durchsuchen…“** aus einer lokalen QCOW2-Datei importiert.
2. **Integritätsprüfung:** Dateigröße bzw. SHA-256 des Basisimages werden gegen die Lehrkraft-Vorgabe geprüft (kann einige Minuten dauern). Weicht der Hash ab, bleibt der Zugriff gesperrt und die Lehrkraft wird informiert.
3. **VM-Start:** Die VM startet und wird im Vollbild per VNC angezeigt („Status: startet …“ → „Status: läuft“). Bei Verbindungsfehlern versucht Next-Exam automatisch eine Neuverbindung.

Innerhalb der VM steht ein Austauschordner bereit, über den Arbeitsdateien mit dem Prüfungsordner synchronisiert und an die Lehrkraft übertragen werden.
