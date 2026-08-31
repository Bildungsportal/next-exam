# Prüfungsmodus Active Sheets

Mit **Active Sheets** werden PDF-Arbeitsblätter mit **interaktiven Formularfeldern** direkt am Schüler:innen-Gerät ausgefüllt – inklusive automatischer Sicherung, signierter PDF-Abgabe und Korrekturwerkzeugen für die Lehrkraft.

## Lehrkraft

### PDF auswählen und prüfen

1. Prüfungsmodus **Active Sheets** wählen.
2. Im Bereich **Formular-PDFs** über **PDF wählen** eine PDF-Datei auswählen, die interaktive Formularfelder enthält. Bei aktivierten Gruppen kann je Gruppe ein eigenes PDF hinterlegt werden.
3. In der Vorschau die **Darstellung und Positionierung der aktiven Formularfelder vor dem Prüfungsstart überprüfen**.

!!! warning "Gescannte PDFs"
    Werden auf einer Seite weniger als zwei interaktive Felder gefunden, warnt Next-Exam: Vermutlich handelt es sich um ein gescanntes PDF ohne aktive Formularfelder. Solche PDFs sind für Active Sheets ungeeignet.

Während der laufenden Prüfung kann das aktive PDF nicht gelöscht werden.

### Active Sheet erstellen

Next-Exam bringt kein eigenes Werkzeug zum Erstellen der Formular-PDFs mit – das Arbeitsblatt wird extern erstellt (z. B. in einem beliebigen PDF-Editor oder einer Textverarbeitung mit Formularfunktion) und anschließend in Next-Exam ausgewählt.

Erkannt werden zwei Arten von Feldern:

- **Echte PDF-Formularfelder (AcroForm):** Textfelder, mehrzeilige Textfelder und Checkboxen werden automatisch als ausfüllbare Felder erkannt.
- **Rein optische Hinweise ohne echte Formularfelder:** Next-Exam erkennt zusätzlich typische Platzhalter im Layout, auch ohne hinterlegte Formularfelder:
    - Linien aus Unterstrichen (`___`) oder Punkten (`....` / `…`)
    - Kästchen-Symbole (☐ ☑ ☒)
    - gezeichnete Rechtecke/Tabellenzellen sowie einzelne horizontale Linien
    - einzelne Großbuchstaben (A–Z), z. B. zum Ankreuzen bei Multiple-Choice-Antworten

<!-- SCREENSHOT: activesheets_source_pdf -->
<figure markdown="span">
    ![Beispiel eines Formular-PDFs](../img/activesheets_source_pdf.png){width="70%"}
    <figcaption>Beispiel eines extern erstellten Formular-PDFs mit Textfeldern und Checkboxen</figcaption>
</figure>

!!! warning "Nicht unterstützt: vektorisierte/geflachte PDFs"
    PDFs aus manchen Online-Konvertern (z. B. iLovePDF) enthalten oft keine erkennbaren Formularfelder mehr, da Text und Layout in Vektorgrafik umgewandelt wurden. Die automatische Felderkennung funktioniert in diesem Fall nicht – Formularfelder müssen dann manuell im PDF ergänzt werden.

### Korrekturvorlage und Autocorrect

- **Als Korrekturvorlage speichern:** Die Lehrkraft füllt das Formular mit den erwarteten Lösungen aus und speichert es als Korrekturvorlage.
- **Automatisch Korrigieren (Autocorrect):** Beim Öffnen einer Abgabe werden die Antworten mit der Korrekturvorlage verglichen und automatisch markiert.
- **Korrektur verwerfen:** Löscht die korrigierte PDF; beim erneuten Öffnen steht wieder die unkorrigierte Abgabe zur Verfügung.

### Korrektur durch die Lehrkraft

Abgaben (Ordner `ABGABE`) werden in der PDF-Vorschau geöffnet. Dort stehen Annotationswerkzeuge zur Verfügung:

- Textmarker (gelb, grün, blau), rote Unterstreichung, roter Stift (Freihand) und Textanmerkungen.
- Markierungen können einzeln gelöscht oder rückgängig gemacht werden.
- **Korrektur speichern** legt die korrigierte Fassung ab; Annotationen werden zusätzlich als Sidecar-Datei (`<name>.annotations.json`) neben der PDF gespeichert.

## Schüler:in

Nach dem Absichern öffnet sich das PDF-Formular im Vollbild:

- Die interaktiven Felder (Textfelder, mehrzeilige Felder, Checkboxen, Lückentexte) werden direkt ausgefüllt.
- Die **Spaltenansicht (Splitview)** zeigt Prüfungsmaterialien neben dem Formular an.
- Eigene Markierungen (Textmarker etc.) sind möglich, werden aber nicht im Abgabe-Dokument gespeichert.
- Der Arbeitsstand wird automatisch gesichert und kann nach einem Neustart wiederhergestellt werden (**Backup gefunden**); unter **Lokale Dateien** sind eigene Sicherungen abrufbar.

### Abgabe

- **Arbeit an Lehrperson senden:** Erzeugt aus dem ausgefüllten Formular ein signiertes PDF und überträgt es an den Teacher (finale Abgabe über **Finale Abgabe an Lehrperson senden**).
- **drucken:** Sendet eine Druckanfrage an die Lehrperson bzw. druckt direkt bei freigegebenem autonomem Druck.
