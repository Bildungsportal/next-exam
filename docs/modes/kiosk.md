# Kiosk-Modus (Betriebssystem)

Der **Kiosk-Modus** sperrt das Schüler:innen-Gerät zusätzlich auf **Betriebssystemebene** ab – unabhängig davon, welcher [Prüfungsmodus](../teacher.md#prufungsmodus-wahlen) verwendet wird. Unter Windows läuft die Prüfung dabei in einem eigenen, gesperrten Benutzerkonto (Windows Assigned Access), unter Linux in einer eigenen Kiosk-Sitzung (Compositor **cage**). Damit ist z. B. auch der Zugriff auf andere Programme, das Startmenü und externe Datenträger blockiert.

Die Einrichtung erfolgt **direkt am Schüler:innen-Gerät** in der Student-App und wird nicht über die Teacher-App gesteuert oder ausgerollt.

---

## Windows

### Voraussetzungen

- **Windows Pro, Education, Enterprise oder IoT Enterprise.** Windows Home wird nicht unterstützt (Multi-App Assigned Access benötigt eine dieser Editionen).
- **Administrator-Rechte** am Gerät (UAC-Abfrage bei der Einrichtung).

### Einrichten

Auf der Student-Startseite steht dazu die Schaltfläche **Kiosk-Modus einrichten** zur Verfügung (unterhalb von „Lokal absperren“); sie erscheint automatisch, solange der Kiosk-Modus auf dem Gerät noch nicht eingerichtet ist.

<!-- SCREENSHOT: kiosk_win_setup -->
<figure markdown="span">
    ![Windows Kiosk-Modus einrichten](../img/kiosk_win_setup.png){width="50%"}
    <figcaption>Dialog „Windows Kiosk-Modus“</figcaption>
</figure>

Im Dialog **Windows Kiosk-Modus** wird die Einrichtung bestätigt (Administrator-Rechte per UAC-Abfrage erforderlich). Next-Exam richtet dabei ein separates Betriebssystem-Benutzerkonto ein (kein Passwort), blockiert USB-Massenspeicher und löscht das Profil nach jeder Prüfung.

- Optional können zusätzlich freigegebene Anwendungen definiert werden: Dazu wird im Arbeitsverzeichnis **EXAM-STUDENT** eine Datei **`kiosk-allowed-apps.txt`** angelegt (ein vollständiger Programmpfad pro Zeile, Zeilen mit `#` werden ignoriert). Diese Anwendungen stehen den Schüler:innen im Kiosk-Modus als zusätzliche Schaltflächen zur Verfügung.
- Optional kann zusätzlich eine Datei **`firewall-rules.ps1`** im selben Ordner hinterlegt werden, um bei der Einrichtung eigene Firewall-Regeln zu setzen.

Nach erfolgreicher Einrichtung muss sich die Person am Windows-Gerät **abmelden** und am Anmeldebildschirm das Benutzerkonto **`next-exam-kiosk`** auswählen (kein Passwort nötig). Next-Exam startet darin automatisch im abgesicherten Vollbild.

!!! warning "Zeitaufwand einplanen"
    Die Einrichtung des Windows Kiosk-Modus (inkl. Anlegen des Benutzerkontos) benötigt etwas Zeit und sollte **im Vorfeld der Prüfung** und nicht erst am Prüfungstag erfolgen.

### Beenden

Ein Verlassen des Kiosk-Modus muss über den Button **Next-Exam beenden** bestätigt werden; anschließend ist weder ein Neustart von Next-Exam noch das Öffnen anderer Anwendungen möglich – die Prüfung gilt als beendet, bis erneut eingeloggt wird. Die Abmeldung selbst erfolgt manuell über Windows (kein automatisches Abmelden durch Next-Exam).

---

## Linux (Cage)

### Voraussetzungen

- **Root-Rechte** am Gerät (Authentifizierung über die PolicyKit-Abfrage des Systems bei der Einrichtung).

### Einrichten

Analog zu Windows steht auf der Student-Startseite die Schaltfläche **Kiosk-Modus einrichten** zur Verfügung. Nach Bestätigung des Dialogs **Linux Kiosk-Modus (Cage)** installiert Next-Exam den Compositor **cage** (falls nicht vorhanden) und richtet im Login-Manager einen eigenen Sitzungstyp **„Next Exam Kiosk“** ein.

<!-- SCREENSHOT: kiosk_linux_setup -->
<figure markdown="span">
    ![Linux Kiosk-Modus einrichten](../img/kiosk_linux_setup.png){width="50%"}
    <figcaption>Dialog „Linux Kiosk-Modus (Cage)“</figcaption>
</figure>

Zum Start der abgesicherten Umgebung wählt die Person am Login-Manager den Sitzungstyp **„Next Exam Kiosk“** und meldet sich mit dem eigenen Linux-Konto an; Next-Exam startet darin automatisch im abgesicherten Vollbild (kein separates Kiosk-Benutzerkonto wie unter Windows).

### Beenden

Ein Verlassen des Kiosk-Modus muss ebenfalls über **Next-Exam beenden** bestätigt werden und beendet die Kiosk-Sitzung (Abmeldung). Ein erneuter Start ist nur über den Login-Manager (Sitzungstyp „Next Exam Kiosk“) möglich.

---

## Sichtbarkeit im Teacher-Dashboard

Läuft ein Gerät im Kiosk-Modus, erscheint im entsprechenden Schüler:innen-Widget ein Schloss-Symbol mit dem Hinweis „Schüler:in läuft im Kiosk-Modus“. Eine Konfiguration oder ein Ausrollen des Kiosk-Modus über die Teacher-App ist nicht möglich – die Einrichtung erfolgt ausschließlich lokal am jeweiligen Schüler:innen-Gerät.

## Offene Screenshots

| Dateiname | Beschreibung |
|---|---|
| `img/kiosk_win_setup.png` | Student: Dialog „Windows Kiosk-Modus“ |
| `img/kiosk_linux_setup.png` | Student: Dialog „Linux Kiosk-Modus (Cage)“ |
