# Bildungsportal (BiP)

Das österreichische **Bildungsportal** ist ein zweiter, alternativer Weg, eine Prüfung zu konfigurieren – zusätzlich zur lokalen Konfiguration direkt in der Teacher-App. Die Prüfung läuft dabei **nicht im Bildungsportal selbst**; das Portal liefert lediglich die Konfiguration (Prüfungsmodus, Materialien, Gruppen, Zuordnung der Schüler:innen), Next-Exam führt die Prüfung wie gewohnt lokal aus.

- Im Bildungsportal stehen dieselben Konfigurationsmöglichkeiten wie im Teacher-Dashboard zur Verfügung (z. B. Prüfungsmodus, Materialien, Gruppen).
- Prüfungen können im Vorfeld vollständig vorbereitet werden, inklusive **Zuordnung der teilnehmenden Schüler:innen**.
- Jeder Prüfungsmodus (Mathematik, Sprachen, Online-Modi, Active Sheets, RDP, Lokale VM) kann über das Bildungsportal konfiguriert werden – die BiP-Anmeldung ist also kein eigener Prüfungsmodus, sondern ein alternativer Konfigurationsweg.

---

## Als Lehrkraft anmelden

1. Auf der Teacher-Startseite im Tab **Bildungsportal** am österreichischen Bildungsportal anmelden.
2. Nach dem Login („Herzlich willkommen …“) werden die im Portal vorbereiteten **BiP-Prüfungen** aufgelistet.
3. Ein Klick auf eine Prüfung startet den Prüfungsserver mit der aus dem Portal übernommenen Konfiguration (Prüfungsmodus, Materialien, Gruppen, Schüler:innen-Zuordnung).

<!-- SCREENSHOT: bip_teacher -->
<figure markdown="span">
    ![Bildungsportal-Tab](img/bip_teacher.png){width="50%"}
    <figcaption>Teacher: Bildungsportal-Tab mit Prüfungsliste</figcaption>
</figure>

Weitere Einstellungen im Tab **Bildungsportal**:

- **Bildungsportal Login erzwingen:** Verpflichtet die Schüler:innen, sich vor der Prüfungsteilnahme ebenfalls am Bildungsportal zu authentifizieren (siehe unten). Abgaben werden dann mit der BiP-Identität signiert.
- **Prüfungszugang (Zugang offen / Zugang gesperrt):** Steuert, ob sich Schüler:innen nach der BiP-Anmeldung bereits mit der Prüfung verbinden dürfen.
- Existiert lokal bereits eine BiP-Prüfung mit demselben Namen, weist ein Hinweis darauf hin, dass sie im Tab „Bildungsportal“ fortgesetzt werden kann.
- Zusätzlich zeigt die Startseite den Informationskanal (News) des Bildungsportals an.

## Als Schüler:in anmelden

Statt Name und Pincode manuell einzugeben, können sich Schüler:innen auch direkt über das Bildungsportal anmelden. Next-Exam übernimmt dabei automatisch den Namen aus dem Portal-Konto und verbindet die Person mit der passenden, von ihrer Lehrkraft vorbereiteten Prüfung.

<!-- SCREENSHOT: bip_student -->
<figure markdown="span">
    ![Bildungsportal-Anmeldung Student](img/bip_student.png){width="50%"}
    <figcaption>Student: Anmeldung über das Bildungsportal</figcaption>
</figure>

Ist **Bildungsportal Login erzwingen** aktiv, ist diese Anmeldeart verpflichtend.

## Offene Screenshots

| Dateiname | Beschreibung |
|---|---|
| `img/bip_teacher.png` | Teacher: Bildungsportal-Tab mit Prüfungsliste |
| `img/bip_student.png` | Student: Anmeldung über das Bildungsportal |
