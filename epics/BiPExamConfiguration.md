# Next-Exam Exam-Configurations for BiP
## Motivation
Jede:r Lehrer:in hat in BiP (Bildungsportal) die Möglichkeit seine Prüfungen zu konfigurieren. Dieses Dokument definiert die hierfür notwendigen Schnittstellen.
## Allgemeiner Ablauf aus Usersicht
## Rollen
* Lehrperson
* Teilnehmende
## Ablauf aus Sicht der Lehrperson
### Vorbereitungen
Die folgendne Schritte werden im BiP durchgeführt:
1. Login im BiP
2. Erstellen/Bearbeiten einer Prüfung
    * Modus->Regeln->Prüfungsdaten->Sicherheit
      + Modi: Kurs, Sprachen, Mathe, M365, Google, Link, SRDP, RDP (Azure und Co.) 
    * Name der Prüfung
    * Datum und Uhrzeit des Beginns
    * Dauer
    * Auswahl der Teilnehmenden (Klassen oder einzelne Teilnehmende)
    * Prüfungskonfiguration
    * Sitzplan kann erstellt werden
3. Speichern
### Prüfungsdurchführung
Die Durchführung der Prüfung erfolgt mit dem Next-Exam Teacher Programm.
1. Programm starten
2. Login mit BiP Credentials
3. Liste mit den im BiP vordefinierten Prüfungen wird angezeigt.
    * Die Liste zeigt chronologisch die in der Zukunft liegenden bzw. für die akteulle Zeit geplanten an.
    * In der Vergangenheit liegende Prüfungen können auf Wunsch dargestellt werden.
4. Die Lehrperson wählt die gewünscht Prüfung aus.
5. Prüfung starten
5. Kontrolle der Teilnehmenden
6. Durchführung der Prüfung
7. Lehrperson kann während der Prüfung ein Foto der Teilnehmenden machen (integrierte Kamera des Notebooks)
### Wechsel der Aufsicht während der Prüfung
* Im BIP können je Prüfung mehrere Lehrpersonen angegeben werden
* Die aktuelle Aufsicht übergibt die Prüfung beim Wechsel an die nächste Lehrperson (über einen Button)
## Ablauf aus Sicht der Teilnehmenden
### Vorbereitung
Für dies Rollen nicht notwendig. (solange kein Einschreib- bzw. Anmeldeprozess abgebildet werden soll. Solche Prozesse werden dann im BiP abgebildet.)
### Prüfungsdurchführung
Die Druchführung der Prüfung erfolgt mit dem Next-Exam Student Programm.
1. Programm starten
2. Login mit BiP Credentials
3. Auswahl der Prüfung startet automatisch, sobald die Lehrperson die Prüfung gestartet hat (per Trigger über BiP)
    * TODO: Was passiert wenn Teilnehmende irrtümlich bei unterschiedlichen Lehrpersonen in einer Prüfung sind, die aktuell gestartent ist? Kann der Teilnehmer die Prüfung selbst wählen?
4. Durchführung der Prüfung nachdem die Lehrperson
## Ideen
* Offline Konfig ?
* IP-Adresse des next-exam Teachers auf BiP beim Start der PRüfung hinterlegen (Multicastproblem, Pull-Signal an next-exam Student zum Autostart der Prüfung)
## Definition der Datenstruktur für Prüfungskonfigurationen
### Format
Das generelle Austauschformat ist JSON.
### Konfigurationsparameter
#### Aktuelle Konfigurationsparameter des Cients RC5
```javascript
{
  "exammode": true,   // abgesicherter modus für schüler:innen ja/nein
  "examtype": "editor",  // editor, math, eduvidual, gforms, website, microsoft365
  "delfolderonexit": false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
  "spellchecklang": "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
  "suggestions": false,   // soll language tool vorschläge für verbesserungen zeigen
  "moodleTestId": null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
  "moodleDomain": "eduvidual.at",  // domain der moodle instanz
  "moodleURL": null,  // vollständige moodle test url
  "cmargin": {    // angaben für den korrekturrand bei der pdf erstellung im editor
    "side": "right",
    "size": 3    // cm 
  },
  "gformsTestId": null,   // id des google forms formulares
  "screenshotinterval": 0,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
  "msOfficeFile": false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden
  "screenslocked": false, // sind die client screens abgesperrt (abgedunkelt)
  "pin": "1337", // exam pin
  "linespacing": "2",  // zeilenabstand im finalen pdf das aus dem editor generiert wird
  "unlockonexit": false, //  unused !!
  "requireBiP": false,  // müssen die clients am bip authentifizieren damit sie zur teacher instanz verbinden können?
  "groups": false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
  "groupA": [   // gruppeneinteilung A
    "Thomas"    // client name
  ],
  "groupB": [],  
  "languagetool": false,    // rechtschreibüberprüfung mit languagetool ja /nein
  "fontfamily": "sans-serif",  // serife schriftart im editor oder non-serif ?
  "audioRepeat": "0", // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
  "screenshotocr": false   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden
}
```
#### Konfigurationparameter mit BiP
* Die Definition von Prüfungen erfolgt durch eine Person mit der Rolle "Lehrender" im BiP.
* Das BiP stellt die Oberfläche zur Bearbeitung des im folgenden definierte Konfigurationsinterfaces zur Verfügung.
* Next-Exam Clients prüfen, sobald ein Login beim BiP erfolgt ist, ob der Person zugeteilte Prüfungen vorhanden sind.
  * Die Liste der verfügbaren Prüfungen wird auf dem Client solange aktualisiert bis eine Prüfung gestartet wird.
  * Teilnehmende werden automatisch zu einer Prüfung verbunden wenn die Lehrperson die Prüfung startet.
* Die ```teacher-ip-adress``` wird automatisch mit der Privaten IP-Adresse des Lehrenden Rechners gesetzt sobald dieser eine Prüfung startet. Die Student-Clients wissen dadurch, dass der Lehrer Online ist und versuchen sich automatisch zu dieser Prüfung zu verbinden.
* Der Bereich ```exam-sections``` (Array) wurde eingeführt damit in Zukunft kombinierte Prüfungen möglich sind.
Im ersten Schritt wird hier, bis zur Implementierung im Client, immer nur Eintrag möglich sein. Hier im Beispiel sind exemplarisch 2 Prüfungssektionen angeführt. Prüfungssektionen werden für Prüfungen die aus mehrern Teilen bestehen. Ein Beispiel wäre eine Englisch Schularbeit bei der es einen Hörverständnis-Teil mit Multiple-Choice Fragen gibt und einen Teil in dem Textproduktion in einem Editor erfolgen soll.
* Im Array ```exam-instruction-files``` können mehrer Angabedateien im BiP hinterlegt werden, die an die Lernenden verteilt werden. In diesem Beispiel eine mp3-Datei für eine Hörverständnisüberprüfung.
* TODO: Klärungsbedarf: Nachdem in der neuesten Version des Clients Gruppen möglich sind, stellt sich die Frage ob auch unterschiedliche Angaben pro Gruppe definierbar sein sollen?
* TODO: Diskusion welche Features im ersten Schritt noch abgedeckt werden sollen.
* TODO: Prüfungsübermittlung im Falle der Matura zu einem spätern Zeitpunkt definieren.

```javascript
{
  "id": "d10cdfc7-ba91-4845-818e-eaae81595dfa", // eindeutige ID im BiP
  "exam-name": "5a 2. E-Schularbeit", // Name der Prüfung wie sie am Client dargstellt werden soll
  "exam-date": "2024-10-02T10:30:00", // geplanter Beginn der Prüfung
  "exam-duration-minutes": "100", // Dauer der Prüfung in Minuten
  "exammode": true,   // abgesicherter modus für schüler:innen ja/nein
  "exam-teacher": "rene.braunshier@bildung.gv.at", // BiP-ID der Lehrperson
  "teacher-ip-Adress": "", // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
  "exam-sections":
  [
    {  
      "examtype": "editor",  // editor, math, eduvidual, gforms, website, microsoft365
      "delfolderonexit": false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
      "spellchecklang": "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
      "suggestions": false,   // soll language tool vorschläge für verbesserungen zeigen
      "moodleTestId": null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
      "moodleDomain": "eduvidual.at",  // domain der moodle instanz
      "moodleURL": null,  // vollständige moodle test url
      "cmargin": {    // angaben für den korrekturrand bei der pdf erstellung im editor
        "side": "right",
        "size": 3    // cm 
      },
      "gformsTestId": null,   // id des google forms formulares
      "screenshotinterval": 0,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
      "msOfficeFile": false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden
      "languagetool": false,    // rechtschreibüberprüfung mit languagetool ja /nein
      "fontfamily": "sans-serif",  // serife schriftart im editor oder non-serif ?
      "audioRepeat": "0", // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
      "screenshotocr": false,   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden
      "screenslocked": false, // sind die client screens abgesperrt (abgedunkelt)
      "pin": "1337", // exam pin
      "linespacing": "2",  // zeilenabstand im finalen pdf das aus dem editor generiert wird
      "exam-instruction-files":
      [],
    },
    {  
      "examtype": "eduvidual",  // editor, math, eduvidual, gforms, website, microsoft365
      "delfolderonexit": false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
      "spellchecklang": "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
      "suggestions": false,   // soll language tool vorschläge für verbesserungen zeigen
      "moodleTestId": null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
      "moodleDomain": "eduvidual.at",  // domain der moodle instanz
      "moodleURL": null,  // vollständige moodle test url
      "cmargin": {    // angaben für den korrekturrand bei der pdf erstellung im editor
        "side": "right",
        "size": 3    // cm 
      },
      "gformsTestId": null,   // id des google forms formulares
      "screenshotinterval": 0,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
      "msOfficeFile": false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden
      "languagetool": false,    // rechtschreibüberprüfung mit languagetool ja /nein
      "fontfamily": "sans-serif",  // serife schriftart im editor oder non-serif ?
      "audioRepeat": "0", // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
      "screenshotocr": false,   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden
      "screenslocked": false, // sind die client screens abgesperrt (abgedunkelt)
      "pin": "1337", // exam pin
      "linespacing": "2",  // zeilenabstand im finalen pdf das aus dem editor generiert wird
      "exam-instruction-files":
      [
        {
          "file-name": "Listening",
          "file-url": "https://bildung.gv.at/listen.mp3"
        },
      ],
    }
  ],
  "unlockonexit": false, //  unused !!
  "requireBiP": true,  // müssen die clients am bip authentifizieren damit sie zur teacher instanz verbinden können?
  "groups": false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
  "groupA": [   // gruppeneinteilung A - Für die Clientnamen werden die Benutzernamen des BiP herangezogen.
    "thomas.weissel@bildung.gv.at",    // client name
    "gerald.landl@bildung.gv.at"
  ],
  "groupB": 
  []
}

```
