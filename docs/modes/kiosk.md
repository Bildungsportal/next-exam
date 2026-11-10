# Kiosk-Modus (Betriebssystem)

Der **Kiosk-Modus** sperrt das Schüler:innen-Gerät zusätzlich auf **Betriebssystemebene** ab – unabhängig davon, welcher [Prüfungsmodus](../teacher.md#prufungsmodus-wahlen) verwendet wird. Unter Linux in einer eigenen Kiosk-Sitzung (Compositor **cage**). Damit ist z. B. auch der Zugriff auf andere Programme, das Startmenü und externe Datenträger blockiert.

Die Einrichtung erfolgt **direkt am Schüler:innen-Gerät** in der Student-App und wird nicht über die Teacher-App gesteuert oder ausgerollt.

---

## Linux (Cage)

### Voraussetzungen

- **Root-Rechte** am Gerät (Authentifizierung über die PolicyKit-Abfrage des Systems bei der Einrichtung).

### Einrichten

Auf der Student-Startseite die Schaltfläche **Kiosk-Modus einrichten** zur Verfügung. Nach Bestätigung des Dialogs **Linux Kiosk-Modus (Cage)** installiert Next-Exam den Compositor **cage** (falls nicht vorhanden) und richtet im Login-Manager einen eigenen Sitzungstyp **„Next Exam Kiosk“** ein.

<!-- SCREENSHOT: kiosk_linux_setup -->
<!--figure markdown="span">
    ![Linux Kiosk-Modus einrichten](../img/kiosk_linux_setup.png){width="50%"}
    <figcaption>Dialog „Linux Kiosk-Modus (Cage)“</figcaption>
</figure-->

Zum Start der abgesicherten Umgebung wählt die Person am Login-Manager den Sitzungstyp **„Next Exam Kiosk“** und meldet sich mit dem eigenen Linux-Konto an; Next-Exam startet darin automatisch im abgesicherten Vollbild.

### Beenden

Ein Verlassen des Kiosk-Modus muss ebenfalls über **Next-Exam beenden** bestätigt werden und beendet die Kiosk-Sitzung (Abmeldung). Ein erneuter Start ist nur über den Login-Manager (Sitzungstyp „Next Exam Kiosk“) möglich.

---

## Sichtbarkeit im Teacher-Dashboard

Läuft ein Gerät im Kiosk-Modus, erscheint im entsprechenden Schüler:innen-Widget ein Schloss-Symbol mit dem Hinweis „Schüler:in läuft im Kiosk-Modus“. Eine Konfiguration oder ein Ausrollen des Kiosk-Modus über die Teacher-App ist nicht möglich – die Einrichtung erfolgt ausschließlich lokal am jeweiligen Schüler:innen-Gerät.