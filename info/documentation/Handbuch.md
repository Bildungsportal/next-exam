### Handbuch für die Prüfungssoftware *Next-Exam*



- **Gliederung:**
  - *Grundlegende Funktionen*
  - *Erweiterte Funktionen*
  - *Fehlerbehandlung*

---

### **Teil 1: Grundlegende Funktionen**


#### **1.1. Prüfungen anlegen**

- Prüfung benennen
- Arbeitsverzeichnis festlegen
- Prüfungsserver starten

  Der Prüfungsname kann frei gewählt werden<br>
  Der Arbeitsordner beinhaltet alle archivierten Arbeiten und Abgaben sowie die Prüfungsordner und Konfiguration
  Dieser Ordner kann individuell gewählt werden (z.B. Netzwerk-Ordner, USB Stick,...)


  <img src="./img/hb_start_exam.png" style="max-width:400px"><br>


<div class="page"/>

#### **1.2. Einführung in das Dashboard von Next-Exam**
    Das Teacher-Dashboard bietet eine Übersicht über alle verbundenen Schüler:innen, stellt alle prüfungsrelevanten Informationen übersichtlich dar und ermöglicht es auf einfache Weise die Prüfung einzustellen und einzelne Schüler:innen zu verwalten.

Benutzeroberfläche (wichtige Schaltflächen und Funktionen)<br>
Erklärung der Sektionen: Prüfungsmodi, Materialien, Schülerverwaltung, Prüfungsordner<br><br>
<img src="./img/hb_teacher_dashboard.png" style="max-width:800px">

<div class="page"/>

#### **1.2 Prüfungsmodi**
    Next-Exam ermöglicht viele verschiedene Prüfungsvarianten.
    Verfügbare Prüfungsmodi sind: Sprachen, Mathematik, Eduvidual, Webseite, Forms, Office365
    Der Prüfungsmodus kann durch ein "DropDown Menü" gesetzt und direkt konfiguriert werden.

<img src="./img/hb_teacher_config_exammode.png" style="max-width:400px"><br>

  - Prüfungsmodus auswählen und konfigurieren

    - Sprachen 

      <img src="./img/hb_config_editor.png" style="max-width:400px"><br>
      Die Einstellungen Korrekturrand, Schriftart, Zeilenabstand und Schrifgröße beziehen sich nicht nur auf die Darstellung
      im Editor sondern auch auf die Erstellung des Abgabe PDF.<br>
      Das Abspielen von Audiodateien (Die Anzahl der erlaubten Abspielversuche) auf Schüler:innenseite kann eingeschränkt werden.<br>
      Zusätzliche Hilfsmittel in Form einer Webseite können definiert werden. (z.B. Wörtherbuch)<br>
      Eine passive Rechtschreibhilfe durch das "LanguageTool" kann aktiviert und konfiguriert werden.
    
    - Mathematik<br>
    In diesem Prüfungsmodus arbeiten die Schüler:innen mit GeoGebra Classic/Suite

      <img src="./img/hb_config_math.png" style="max-width:400px"><br>
      Zusätzliche Hilfsmittel in Form einer Webseite (z.B. Formelsammlung) können definiert werden.
  
    - Eduvidual/Moodle <br>
    Next-Exam übernimmt die Absicherung des Moodle Tests. Es müssen in der Lernplattform keinerlei Einstellungen für das Zusammenspiel mit der Prüfungsumgebung vorgenommen werden.

      <img src="./img/hb_config_eduvidual.png" style="max-width:400px"><br>

    - Webseiten

      <img src="./img/hb_config_website.png" style="max-width:400px"><br>

    - Google Forms

      <img src="./img/hb_config_forms.png" style="max-width:400px"><br>

    - Microsoft365<br>
    Ein .docx bzw. .xlsx Template muss über Next-Exam bereitgestellt werden. Dieser Modus erstellt aus dem Template automatisch Kopien für jede:n Schüler:in auf dem Onedrive der Lehrperson und generiert "Share-Links" für die Bearbeitung der Dokumente für die verbundenen Schüler:innen.



<div class="page"/>

#### **1.3. Materialien definieren**

- **Materialien bereitstellen:**
  - Auswahl der zugänglichen Materialien (Textdokumente, PDFs, Formelsammlungen, Wörterbücher, Audiodateien, Bilder)
  
    <img src="./img/hb_teacher_upload_materials.png" style="max-width:400px"><br>

  - Gruppen- und Einzelschüler-Zuweisung

    <img src="./img/hb_teacher_groupmaterials.png" style="max-width:400px"><br>
    Die für die Prüfung notwendigen Materialien werden den Clients in Base64 Form zur Verfügung gestellt und nicht auf den Clients gespeichert.

- **Dateien bereitstellen:**
  - Allen Schüler:innen oder einzelnen Schüler:innen Dateien auch während der Prüfung bereitstellen (Nachteilsausgleich, Zwischenstände, etc.)
  
    <img src="./img/hb_teacher_student_view.png" style="max-width:100px"> &nbsp;
    <img src="./img/hb_teacher_sidebar.png" style="max-height:264px"> &nbsp;
    
    <br>
    Das Next-Exam System sieht für diesen Zweck mehrere Möglichkeiten vor die dem Anlass entsprechend sinnvoll gewählt werden können.
    Die Sidebar im Dashboard ermöglicht es Dateien im Original an alle Schüler:innen zu senden.<br><br>
  

  
  - Sicherungen zurücksenden

    <img src="./img/hb_teacher_filebuttons.png" style="max-width:200px;"><br>
    <img src="./img/hb_send_bak.png" style="max-width:340px;">

    Der Dateimanager erlaubt es die spezifische Datei direkt auszuwählen und an einzelne Schüler:innen zu senden. Diese Funktion bietet sich an 
    um .bak Dateien (Sicherungsdateien des Editors) zur Weiterbearbeitung nach Unterbrechung den Schüler:innen zukommen zu lassen.
    
    <img src="./img/student_replace_content_bak.png" style="max-width:340px;">
    <br><br>



  - Studentview  
    Das "Studentview" erlaubt die individuelle Handhabung einzelner Schüler:innen und ebenso das Verteilen von Dateien.
    
    <img src="./img/hb_teacher_student_view.png" style="max-width:100px"> &nbsp;

#### **1.5 Sprache der Benutzeroberfläche wählen**
  <img src="./img/hb_lang_switch.png" style="max-width:100px"> &nbsp;


#### **1.6 Informationskanal vom Bildungsportal abrufen**
  <img src="./img/hb_bip_news.png" style="max-width:100px"> &nbsp;


#### **1.7 Lokal gesicherte Prüfungen löschen bzw. fortsetzen**
    Next-Exam sichert jede Prüfung im Arbeitsordner "EXAM-TEACHER" und speichert in diesem alle Arbeiten der Schüler:innen sowie die Exam-Konfiguration.
  <img src="./img/hb_local_exams.png" style="max-width:400px"> &nbsp;
  <br>
  Durch Klick auf das "x" Symbol kann die lokale Sicherung der Prüfung entfernt werden. Ein Klick auf den Namen aktiviert die gesicherte Prüfung und ermöglicht es diese fortzusetzen.

  <br>
  <br><br>


#### **1.4. Prüfung starten aus Sicht der Schüler:innen**
    In der Schülerversion von Next-Exam werden im Netzwerk gefundene Prüfungen automatisch angezeigt und können mit einem frei wählbaren Benutzernamen und dem notwendigen PIN-Code betreten werden.

- **Verbindung mit dem Prüfungsserver herstellen:**

    <img src="./img/hb_student_start.png" style="max-width:600px"><br>

  - Verbindung via Multicast automatisch oder manuell per IP-Adresse
  - PIN-Code für die Verbindung
- **Gruppen verwalten:**
  - Aktivieren, Gruppenzugehörigkeit ändern, Gruppenspezifische Materialien
- **Geräte absichern:**
  - Absicherung der Geräte und Prüfung starten
- **Bildschirm abdunkeln**
  - Bildschirm abdunkeln um Aufmerksamkeit zu lenken
- **Prüfung beenden:**
  - Abgaben kontrollieren, zusammenfassen
  - Abschluss der Prüfung und Ergebnisse einsehen
  - Geräte entsperren
  - Einzelne Schüler:innen freischalten oder entfernen

#### **1.5. Abgaben einsehen und sichern**
    Der Dateimanager von Next-Exam ermöglicht es den Lehrpersonen alle Abgaben und archivierte Zwischenstände einzusehen und zu verwalten.

  <img src="./img/hb_teacher_archived_folder.png" style="max-width:400px"><br>


- **Prüfungsabgaben verwalten:**
  - Fortschritt der Schüler verfolgen
  - Abgaben einsehen, sichern und herunterladen
  - Automatische Archivierung mit Timestamp
  - Automatische Zusammenfassung aller neuesten Abgaben als PDF mit Index (Name, Abgabezeitpunkt, Zeichenanzahl)
- **Abgabe**
  - Finale Abgabe mit Nummerierung
  - Dokumente direkt an den Teacher senden
  - Automatische Archivierung im Ordner "ABGABE"
- **Direktdruck:**
  - Schüler:innen können ihre Arbeit direkt drucken
  - Standarddrucker wählen

---
<div class="page"/>


### **Teil 2: Erweiterte Funktionen**

#### **2.1. Schüler individuell fokussieren**
<img src="./img/hb_student_widget.png" style="max-width:300px;">

- **Einzelne Schüler überwachen:**
  - Schüler:innen freischalten oder entfernen
  - Prüfung für einzelne Schüler pausieren
  - Daten an einzelne Schüler:innen senden
  - Abgaben einzelner Schüler:innen verwalten
    
    <img src="./img/hb_teacher_student_view.png" style="max-width:140px;">




#### **2.3. Prüfungsabschnitte**
    Für Sprachschularbeiten oder Tests mit mehreren, von einander getrennt zu behandelnden 
    Bereichen können Prüfungsabschnitte aktiviert und unabhängig voneinander Eingestellt werden.

  <img src="./img/hb_teacher_examsections.png" style="max-width:700px;">

- Prüfungen in Abschnitte unterteilen
- Unterschiedliche Bedingungen für Abschnitte festlegen

#### **2.4. Erweiterte Sicherheitsfunktionen**
  <img src="./img/hb_teacher_configure.png" style="max-width:140px;"><br>
  &nbsp;<img src="./img/hb_config_main.png" style="max-width:340px;">


- **Automatisches Abgabeintervall einstellen** Zusätzlich zur manuellen Abgabe die automatische Archivierung der Arbeiten einstellen
- **Screenshot-Intervall einstellen** Zeitintervall für Screenshot Aktualisierung
- **OCR Sicherheit:** Erweiterte Erkennung von Versuchen, die Prüfungsumgebung zu umgehen
- **Prüfungsabschnitte aktivieren:** Unterteilung in mehrere unabhängige Prüfungsabschnitte aktivieren
- **Gruppen:** Die Gruppen A/B sichtbar machen und Zuweisung unterschiedlicher Materialien ermöglichen
- **Audio stummschalten:** Systemsounds (Warnungen, etc.) deaktivieren
- **Autonomer Druck** Schüler:innen Zugriff auf installierten Drucker am Prüfungsserver gewähren



- **Automatische Bereinigung alter Arbeitsdateien in Schülerordnern** Beim Beenden der Prüfung die Arbeitsordner auf Schüler:innenseite löschen




#### **2.5. Integration ins Bildungsportal**
    Über das kommende Bildungsportal Plugin können Prüfungen im Vorfeld konfiguriert, Materialien festgelegt und Listen aller Teilnehmer:innen definiert werden.

- Anbindung an das zentrale Bildungsportal

  <img src="./img/hb_bip_connect.png" style="max-width:240px;">
    <img src="./img/hb_bip_connected.png" style="max-width:240px;"><br>
  
- Vorkonfigurierte BiP Prüfungen

  <img src="./img/hb_bip_exams.png" style="max-width:240px;">



---

<div class="page"/>

## **Teil 3: Fehlerbehandlung**

#### **3.1. Fehlerbehandlung**

- Fehlermeldungen beim Verbindungsaufbau und deren Ursachen
- Problembehandlungsschritte
- Fortsetzen der Prüfung bei Fehler auf Schülerseite
- Fortsetzen der Prüfung bei Fehler auf Teacherseite