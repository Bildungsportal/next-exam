# Prüfungsmodus RDP

Im Modus **RDP** greifen die Schüler:innen über den **RD Web Client** (HTML5) auf einen Windows-Server oder virtuelle Maschinen zu. Die eigentliche Arbeitsumgebung läuft damit zentral am Server; Next-Exam sichert nur den Zugriff ab.

## Lehrkraft

1. Prüfungsmodus **RDP** wählen.
2. Unter **RDP URL** (**RDP URL wählen**) die Domain bzw. URL des RD-Web-Zugangs eintragen.
3. Mit **Geräte absichern** die Prüfung starten.

**Voraussetzungen serverseitig:**

- Ein Windows Remote Desktop Gateway mit installiertem **RD Web Client**.
- Domänen-Logins für die Schüler:innen.

## Schüler:in

Nach dem Absichern öffnet sich der RD Web Client im abgesicherten Fenster. Die Schüler:innen melden sich mit ihrem Domänen-Login an und arbeiten in der Remote-Sitzung. Das Verlassen der RDP-Oberfläche ist blockiert.

Abgaben erfolgen innerhalb der Remote-Umgebung (z. B. Netzlaufwerk) gemäß den Vorgaben der Lehrkraft.
