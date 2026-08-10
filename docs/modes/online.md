# Online-Modi

In den **Online-Modi** zeigt Next-Exam eine Webanwendung (Moodle-Test, Formular, Office-Web-App, beliebige Website) im abgesicherten Vollbild an. Die Schüler:innen können die Prüfungsseite nicht verlassen: Navigation ist auf die erlaubten Adressen beschränkt, Tastenkombinationen und Browser-Navigation sind blockiert, und ein Verlassen des Fensters wird der Lehrkraft gemeldet.

Alle inhaltlichen Einstellungen (Fragen, Bewertung, Zeitlimits des Tests) erfolgen in der jeweiligen Plattform – Next-Exam übernimmt die Absicherung.

---

## Eduvidual / Moodle

### Lehrkraft

1. Prüfungsmodus **Eduvidual / Moodle** wählen.
2. Unter **Test URL** die vollständige URL des Moodle-Tests eintragen (**Test URL wählen**). Läuft die Moodle-Instanz unter einer anderen Domain als eduvidual.at, wird diese Domain aus der URL übernommen.
3. Bei aktivierten Gruppen kann für Gruppe A und B je eine eigene Test-URL hinterlegt werden.
4. Optional kann ein bereits für den **Safe Exam Browser (SEB)** konfiguriertes Moodle-Quiz genutzt werden – siehe [SEB-Kompatibilitätsmodus](#seb-kompatibilitatsmodus) unten.

### Schüler:in

Nach dem Absichern öffnet sich der Moodle-Test im abgesicherten Fenster. Die Schüler:innen melden sich mit ihrem Moodle-Konto an und absolvieren den Test. Navigation außerhalb der Testseite ist blockiert; Zoom-Funktionen stehen zur Verfügung.

### SEB-Kompatibilitätsmodus

Mit dem **Safe Exam Browser (SEB) Kompatibilitätsmodus** kann ein bereits für SEB konfiguriertes Moodle-Quiz mit Next-Exam durchgeführt werden:

- **SEB-Konfiguration:** Eine aus Moodle heruntergeladene oder mit dem SEB Configuration Tool erstellte Konfigurationsdatei auswählen.
- **Entschlüsselungspasswort:** Falls die Konfiguration verschlüsselt ist, das Passwort angeben.
- **Browser Exam Key (BEK):** Für höhere Sicherheit den im SEB Configuration Tool (Tab „Exam“) angezeigten Key hier und im Moodle-Quiz hinterlegen.

---

## Google Forms

### Lehrkraft

1. Prüfungsmodus **Forms** wählen.
2. Unter **Forms URL** den Schüler:innen-Link zum Formular eintragen: In Google Forms über **Teilen → „Link für Antwortende kopieren“** und diesen Link einfügen.

### Schüler:in

Das Formular öffnet sich im abgesicherten Fenster und wird direkt ausgefüllt und abgesendet.

!!! note "Google-Account"
    Je nach Formular-Einstellung („Anmeldung erforderlich“) benötigen die Schüler:innen einen Google-Account. Für anonyme Prüfungen das Formular ohne Anmeldepflicht konfigurieren.

---

## Microsoft Forms

### Lehrkraft

1. Prüfungsmodus **Forms** wählen (derselbe Modus wie Google Forms).
2. Unter **Forms URL** den Teilnahme-Link eintragen: In Microsoft Forms über **„Antworten sammeln“ → „Link kopieren“** und diesen Link einfügen.

### Schüler:in

Wie bei Google Forms öffnet sich das Formular im abgesicherten Fenster; das Neuladen des Formulars verwirft alle bisherigen Eingaben und wird daher mit einer Rückfrage abgesichert.

---

## Microsoft 365

### Lehrkraft

1. Prüfungsmodus **Microsoft365** wählen.
2. Mit dem Microsoft-Konto der Lehrkraft anmelden.
3. Über **Datei hochladen** eine `.docx`- oder `.xlsx`-Datei als Template auswählen. Für jede:n angemeldete:n Schüler:in wird automatisch eine Kopie im OneDrive der Lehrkraft angelegt und ein individueller Bearbeitungslink erzeugt.

!!! note "Consent im Tenant"
    Je nach Sicherheitsrichtlinie des verwendeten Microsoft-Tenants kann bei der Anmeldung eine Freigabe (Consent) durch eine:n Tenant-Administrator:in erforderlich sein, bevor die Lehrkraft sich anmelden kann.

!!! warning "Nach Unterbrechungen"
    Wird die Prüfung fortgesetzt bzw. der Server neu gestartet, muss sich die Lehrkraft erneut mit der Microsoft-Cloud verbinden und die Office-Datei erneut auswählen, bevor die Schüler:innen die Verbindung wieder aufnehmen können.

### Schüler:in

Jede:r Schüler:in arbeitet im abgesicherten Fenster an der eigenen Dokumentkopie in der Office-Web-App (Word/Excel online). Die Arbeit wird laufend in OneDrive gespeichert; die Lehrkraft hat über ihr OneDrive Zugriff auf alle Dokumente.

---

## Website

### Lehrkraft

1. Prüfungsmodus **Website** wählen.
2. Unter **Website-URL** die erlaubte Adresse eintragen (**URL wählen**), z. B. digi4school.at, lms.at oder scratch.mit.edu.
3. Optional die Navigation weiter einschränken:
    - **Subdomains blockieren (SD):** Nur die exakte Domain erlauben, alle Subdomains blockieren.
    - **Andere Pfade blockieren (SF):** Navigation nur innerhalb des angegebenen URL-Pfads erlauben.
4. Bei aktivierten Gruppen je URL für Gruppe A und B.

### Schüler:in

Die Website öffnet sich im abgesicherten Fenster. Navigation ist nur innerhalb der erlaubten URL (und je nach Einstellung ihrer Subdomains/Unterpfade) möglich. Downloads aus der Prüfungsumgebung landen im Arbeitsordner; bei Scratch-Projekten wird der Arbeitsstand automatisch gesichert.

---

## Offene Screenshots

| Dateiname | Beschreibung |
|---|---|
| `img/web_eduvidual_teacher.png` | Teacher: Test-URL-Konfiguration Eduvidual/Moodle |
| `img/web_forms_teacher.png` | Teacher: Forms-URL-Konfiguration |
| `img/web_website_teacher.png` | Teacher: Website-URL mit SD/SF-Optionen |
| `img/web_student.png` | Student: Abgesichertes Fenster mit geöffneter Prüfungsseite |
