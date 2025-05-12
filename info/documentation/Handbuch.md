


Handbuch - Next-Exam



### Handbuch für die Prüfungssoftware *Next-Exam*



## Inhaltsverzeichnis


* [Teil 1: Grundlegende Funktionen (Teacher)](#teil-1-grundlegende-funktionen)
	+ [1.1. Prüfungen anlegen](#pruefungen-anlegen)
	+ [1.2. Dashboard](#dashboard-next-exam)
	+ [1.3 Prüfungsmodi](#pruefungsmodi)
	+ [1.4 Prüfungsunterlagen definieren](#materialien-definieren)
	+ [1.5 Schüler verwalten](#schueler-fokussieren)
	+ [1.6 Abgaben einsehen und sichern](#abgaben-einsehen)
	+ [1.7 Prüfung beenden](#pruefung-beenden)
* [Teil 2: Grundlegende Funktionen (Student)](#teil-2-grundlegende-funktionen)
	+ [2.1 Prüfung starten aus Sicht der Schüler:innen](#pruefung-starten-schueler)
* [Teil 3: Erweiterte Funktionen](#teil-3-erweiterte-funktionen)
	+ [3.1 Gruppen verwalten](#gruppen-verwalten)
	+ [3.2 Bildschirm abdunkeln](#bildschirm-abdunkeln)
	+ [3.3 Sprache der Benutzeroberfläche wählen](#sprachoberflaeche-waehlen)
	+ [3.4 Informationskanal vom Bildungsportal abrufen](#informationskanal-bildungsportal)
	+ [3.5 Lokal gesicherte Prüfungen löschen bzw. fortsetzen](#lokal-gesicherte-pruefungen)
	+ [3.6 Prüfungsabschnitte](#pruefungsabschnitte)
	+ [3.7 Erweiterte Sicherheitsfunktionen](#sicherheitsfunktionen)
	+ [3.8 Integration ins Bildungsportal](#bildungsportal-integration)
* [Teil 4: Fehlerbehandlung - FAQ](#teil-4-fehlerbehandlung)
	+ [4.1. Fehlerbehandlung](#fehlerbehandlung)





### **Teil 1: Grundlegende Funktionen (Teacher)**



#### **1.1. Prüfungen anlegen**


* Prüfung benennen
* Prüfungsserver starten




 Der Prüfungsname kann frei gewählt werden  

 Der Arbeitsordner am Desktop beinhaltet alle archivierten Arbeiten und Abgaben sowie die Prüfungsordner und Konfiguration  





![](./img/hb_startexam.png)  

 
 Optional:
 
 ![](./img/hb_erweitert.png)  
* **Passwort festlegen**  

 Ein Passwort kann festgelegt werden um zu verhindern, dass die Prüfung bei Verbindungsverlust verlassen werden kann
* **Backup-Ordner festlegen**  

 Ein zusätzlicher Backup-Ordner kann individuell gewählt werden (z.B. Netzwerk-Ordner, USB Stick, ...)

![](./img/hb_start_exam.png)  




#### **1.2. Dashboard**




 Das Teacher-Dashboard bietet eine Übersicht über alle verbundenen Schüler:innen, stellt alle prüfungsrelevanten Informationen übersichtlich dar und ermöglicht es auf einfache Weise, die Prüfung einzustellen und einzelne Schüler:innen zu verwalten.
 




 Der automatisch generierte Pin-Code wird benötigt um der Prüfung beizutreten.  

 Sollte im (w)LAN Multicast unterbunden sein, kann die Prüfung über die IP-Adresse der Lehrperson gefunden werden.
 


![](./img/hb_teacher_dashboard.png)


#### **1.3 Prüfungsmodi**




 Next-Exam ermöglicht viele verschiedene Prüfungsvarianten.  

 Verfügbare Prüfungsmodi sind: Sprachen, Mathematik, Eduvidual, Webseite, Forms, Office365  

 Der Prüfungsmodus kann durch ein "DropDown Menü" gesetzt und direkt konfiguriert werden.
 



- **Prüfungsmodus auswählen und konfigurieren:**

![](./img/hb_teacher_config_exammode.png)* **Sprachen**  

 Einstellungen wie Korrekturrand, Schriftart, Zeilenabstand und Schriftgröße betreffen sowohl die Darstellung im Editor als auch die Erstellung des Ablage-PDF.  

 Audiodateien (Anzahl erlaubter Abspielversuche) können eingeschränkt werden.  

 Zusätzliche Hilfsmittel in Form von Webseiten (z.B. Wörtherbuch) lassen sich definieren.  

 Eine passive Rechtschreibhilfe über "LanguageTool" kann aktiviert und konfiguriert werden.  

![](./img/hb_config_editor.png)  

* **Mathematik**  

 In diesem Modus arbeiten die Schüler:innen mit GeoGebra Classic/Suite.  

 Zusätzliche Hilfsmittel, wie eine Formelsammlung über eine Webseite, können gesetzt werden.  

![](./img/hb_config_math.png)  

* **Eduvidual/Moodle**  

 Next-Exam übernimmt die Absicherung des Moodle-Tests. Alle nötigen Einstellungen für die Prüfungsumgebung erfolgen über Moodle selbst.  

![](./img/hb_config_eduvidual.png)  

* **Webseiten**  

 Eine beliebige Webseite kann in diesem Modus angezeigt und abgesichert werden. Z.B. digi4school.at, lms.at, scratch.mit.edu, ...  

![](./img/hb_config_website.png)  

* **Google Forms**  

![](./img/hb_config_forms.png)  

* **Microsoft365**  

![](./img/hb_mslogin.png)![](./img/hb_msselect.png)![](./img/hb_msfile.png)  

 Nach dem Login mit Microsoft365 wird ein .docx bzw. .xlsx-Template bereitgestellt.   
 Aus diesem Template werden für jede:n Schüler:in automatisch Kopien im OneDrive der Lehrperson generiert, inklusive individueller "Share-Links" zur Bearbeitung.  
  

* **RDP**  

 Über das Remote Desktop Protocol (RDP) kann auf einen Windows-Server (oder Virtuelle Maschine) zugegriffen werden.   

 Gibt man als Lehrperson den Benutzernamen und das Passwort des Schülers:in ein (zb. Gast), wird dieser automatisch angemeldet und die aktuelle Sitzung in Next-Exam-Student angezeigt.   

![](./img/hb_rdpconfig.png)  





#### **1.4. Prüfungsunterlagen definieren**


* **Materialien bereitstellen**
	+ 
	 Auswahl der zugänglichen Materialien (Textdokumente, PDFs, Formelsammlungen, Wörterbücher, Audiodateien, Bilder)  
	
	![](./img/hb_teacher_upload_materials.png)  
	
	+ 
	 Gruppen- und Einzelschüler-Zuweisung  
	
	![](./img/hb_teacher_groupmaterials.png)  
	
	 Die benötigten Materialien werden den Clients in Base64-Codierung bereitgestellt und nicht lokal gespeichert.   
	
	 Samtliche Materialien können auch während der laufenden Prüfung geändert, betrachtet, ggf. abgespielt (audio) oder entfernt werden.
  

* **Dateien bereitstellen**


 Das Next-Exam System bietet mehrere Optionen, um Dateien dem Anlass entsprechend zu versenden.  

 Über die Sidebar im Dashboard können Dateien im Original an alle Schüler:innen gleichzeitig gesendet werden.
 Über die Schaltflächen im Dateimanager können Backups an einzelne Schüler:innen gesendet werden.   

 Diese Dateien liegen dann im Arbeitsordner der Schüler:innen und können auch im abgesicherten Modus genutzt werden.
 



+ **Bereitstellung von Dateien**   

  An alle bzw. an einzelne Schüler:innen während der Prüfung (z.B. für Zwischenstände, Nachteilsausgleich)  

![](./img/hb_teacher_student_view.png)  
  ![](./img/hb_teacher_sidebar.png)    

+ **Sicherungen zurücksenden**  

  Der Dateimanager ermöglicht es, eine Datei direkt auszuwählen und an einzelne Schüler:innen zu senden. Diese Funktion wird u.a. bei .bak Dateien (Sicherungsdateien des Editors) genutzt.  

![](./img/hb_teacher_filemanager.png)  

![](./img/hb_teacher_filebuttons.png)  

![](./img/hb_send_bak.png)  

![](./img/student_replace_content_bak.png)




#### **1.5. Schüler verwalten**


* **Sitzplan**  


 Der Sitzplan zeigt die aktuelle Verteilung der Schüler:innen auf die Prüfungsstationen an.
 Dieser kann durch Drag&Drop verändert werden.  

![](./img/hb_sitzplan.png)

* **Student-Widget**  


 Über das "Student-Widget" können einzelne Schüler:innen individuell bearbeitet werden.  
  
* Die Schaltfläche "Info" öffnet die Detailansicht der Schüler:innen.
* Über die Schaltfläche "A" / "B" können die Schüler:innen den Gruppen zugewiesen werden.
* "X" entfernt die Schüler:innen vom Prüfungsserver und beendet die Prüfung für diese Person.
* Der Papierkübel bereinigt den Arbeitsordner am PC der gewählten Schüler:innen.
* Der "Zauberstab" erlaubt es einzelnen Schüler:innen die Rechtschreibhilfe zu aktivieren.
* Die roten Dokumenten-Icons geben auskunft darüber wieviele Dateien die Schüler:innen in ihrem Arbeitsordner erstellt haben.

![](./img/hb_student_widget.png) ![](./img/hb_student_widget_badges.png)

* Weitere temporäre Badges und Schaltflächengeben Auskunft darüber ob die Schüler:innen eine Abgabe senden, eine virtualisierte Arbeitsumgebung nutzen oder versucht haben die Prüfung zu verlassen



* **Einzelne Schüler verwalten*** Schüler:innen freischalten oder entfernen
* Möglichkeit, die Prüfung für einzelne Schüler:innen zu pausieren
* Versand von Dateien an einzelne Schüler:innen
* Verwaltung einzelner Abgaben

![](./img/hb_teacher_student_view.png)



#### **1.6 Abgaben einsehen und sichern**


Der Dateimanager von Next-Exam erlaubt es Lehrpersonen, alle Abgaben sowie archivierte Zwischenstände einzusehen und zu verwalten.


![](./img/hb_teacher_archived_folder.png)  

* **Verwaltung der Prüfungsabgaben:**
	+ Überwachung des Schülerfortschritts
	+ Einsicht, Archivierung und Download von Abgaben
	+ Automatische Archivierung mit Timestamp
	+ Zusammenfassung der neuesten Abgaben als PDF (mit Index: Name, Abgabezeitpunkt, Zeichenanzahl)
* **Abgabe:**
	+ Finale Abgabe mit Nummerierung
	+ Direkter Versand der Dokumente an den Teacher
	+ Automatische Ablage im Ordner "ABGABE"
* **Direktdruck:**
	+ Möglichkeit für Schüler:innen, ihre Arbeit direkt zu drucken
	+ Auswahl eines Standarddruckers




#### **1.7 Prüfung beenden**


- **Prüfung beenden:**  

![](./img/hb_teacher_maintoolbar_red.png)  

	* Kontrolle, Zusammenfassung und Archivierung der Abgaben
	* Einsicht der Prüfungsergebnisse
	* Entsperren der Geräte
	* Freischalten oder Entfernen einzelner Schüler:innen

  
  


### **Teil 2: Grundlegende Funktionen (Student)**



#### **2.1 Prüfung starten aus Sicht der Schüler:innen**



 In der Schüler-Version von Next-Exam werden im Netzwerk gefundene Prüfungen automatisch angezeigt. Diese können mit einem frei wählbaren Benutzernamen und dem entsprechenden PIN-Code betreten werden.
 


* **Verbindung mit dem Prüfungsserver herstellen:**  

![](./img/hb_student_start.png)  

	+ Automatische Verbindung via Multicast oder manuelle Eingabe per IP-Adresse
	+ PIN-Code zur Authentifizierung




### **Teil 3: Erweiterte Funktionen**



#### **3.1 Gruppen verwalten**


* Aktivierung, Änderung der Gruppenzugehörigkeit oder Zuweisung gruppenspezifischer Materialien



#### **3.2 Bildschirm abdunkeln**


* Abdunkeln des Bildschirms, um die Aufmerksamkeit zu lenken



#### **3.3 Sprache der Benutzeroberfläche wählen**


![](./img/hb_lang_switch.png)  

 
#### **3.4 Informationskanal vom Bildungsportal abrufen**


![](./img/hb_bip_news.png)  

 
#### **3.5 Lokal gesicherte Prüfungen löschen bzw. fortsetzen**




 Next-Exam sichert jede Prüfung im Arbeitsordner "EXAM-TEACHER" und speichert darin alle Schülerarbeiten sowie die Exam-Konfiguration.  


* 
 Ein Klick auf das "x" Symbol löscht die lokale Sicherung der Prüfung. Mit einem Klick auf den Prüfungsnamen wird die Sicherung aktiviert und kann fortgesetzt werden.

![](./img/hb_local_exams.png)    







#### **3.6. Prüfungsabschnitte**




 Für Sprachschularbeiten oder Tests, die in getrennte Bereiche unterteilt werden, können Prüfungsabschnitte aktiviert werden.
 



![](./img/hb_teacher_examsections.png)
* Unterteilung der Prüfung in Abschnitte
* Festlegung unterschiedlicher Bedingungen pro Abschnitt



#### **3.7. Erweiterte Sicherheitsfunktionen**


![](./img/hb_teacher_configure.png)  

  ![](./img/hb_config_main.png)
* **OCR-Funktion aktivieren:** Erkennung von Versuchen, die Prüfungsumgebung zu umgehen
* **Automatisches Abgabeintervall einstellen:** Neben manueller Abgabe erfolgt die automatische Archivierung der Arbeiten
* **Screenshot-Intervall einstellen**
* **Automatische Bereinigung alter Arbeitsdateien:** Bereinigung der Schülerordner beim Beenden der Prüfung
* **Autonomer Druck:** Gewährung des Zugriffs auf den am Prüfungsserver installierten Drucker




#### **3.8. Integration ins Bildungsportal**




 Mit dem kommenden Bildungsportal-Plugin können Prüfungen vorab konfiguriert, Materialien festgelegt und Teilnehmerlisten erstellt werden.
 



* 
 Anbindung an das zentrale Bildungsportal  

![](./img/hb_bip_connect.png)
![](./img/hb_bip_connected.png)  

* 
 Vorkonfigurierte BiP-Prüfungen  

![](./img/hb_bip_exams.png)




### **Teil 4: Fehlerbehandlung - FAQ**



#### **4.1. Fehlerbehandlung**


**Fehlermeldungen beim Verbindungsaufbau und deren Ursachen**

 Alle Teilnehmer:innen müssen sich im selben Netzwerk befinden und miteinander kompatible Versionen von Next-Exam-Student und Next-Exam-Teacher nutzen.
 Sollte die Prüfung nicht automatisch im Netzwerk gefunden werden kann die IP-Adresse von den Schüler:innen manuell eingegeben werden um die Teacher Instanz (API) zu erreichen.
 
  
**Fortsetzen der Prüfung bei Fehlern auf Schülerseite**

 Bei einem Fehler mit Next-Exam-Student sollte das Programm geschlossen und neu gestartet werden.   

 Der Editor wird bereits vorhandene Backupdateien automatisch wiederherstellen.
 Die Lehrperson hat zusätzlich die Möglichkeit bereits gesicherte Backups an den/die betroffene Schüler:in zu senden um die Prüfung nahtlos fortsetzen zu können.
 
  
**Fortsetzen der Prüfung bei Fehlern auf Teacherseite**

 Sollte die Teacher Instanz beendet werden müssen während einer laufenden Prüfung so ist zu beachten, dass die Schüler:innen die Verbindung zum Prüfungsserver erst wieder herstellen dürfen, wenn der Teacher wieder online ist und alle Einstellungen wieder hergestellt wurden.
 Insbesondere muss die ABSICHERUNG der Geräte wieder aktiviert werden da die Prüflinge sonst beim Verbindungsaufbau zu einer nicht gesicherten Umgebung verbinden und die Prüfung dadurch für sie sofort beendet wird.
 
  
**Language Tool funktioniert nicht**

 Avast Antivirus, Norton Antivirus oder ähnliche Programme können die Language Tool Funktion von Next-Exam blockieren.   

 In diesem Fall muss das Programm "Avast Security" gestartet und die Next-Exam-Student.exe Datei von der Liste der blockierten Programme entfernt werden bzw. auf die Ausnahmeliste gesetzt werden.
 
  
**Screenhots auf MacOS funktionieren nicht**

 MacOS benötigt die Berechtigung um Screenshots zu erstellen.   

 Sollte diese Berechtigung nicht erteilt werden, wird Next-Exam als "Fallback" Variante auf Page-Capture zurückgreifen und nur das Programmfenster übertragen.
 
  
**Screenhots auf Linux funktionieren nicht**

 Linux benötigt ImageMagick um Screenshots zu erstellen.   

 Sollte dieses Programm nicht installiert sein, wird Next-Exam als "Fallback" Variante auf Page-Capture zurückgreifen und nur das Programmfenster übertragen.
 Auf Gnome/Wayland Systemen werden Screenshots derzeit nicht unterstützt.
 
  
**Die Prüfung wird nicht automatisch gefunden**

 Es handelt sich bei Next-Exam um eine Netzwerkapplikation.
 Um volle Funktionsfähigkeit zu gewährleisten muss die Firewall die App durchlassen.
 Sollte die Ausnahme für die Schüler:innen nicht gesetzt werden können, so muss für den Verbindungsaufbau
 die IP Adresse der Lehrperson genutzt werden.
 
  
**Welche Ports werden von Next-Exam verwendet?**

 Die Teacher-API (Schnittstelle) nutzt den Port 22422 (tcp).
 Um "autodiscovery" von Prüfungen zu ermöglichen sollte im lokalen Netzwerk zudem Multicast erlaubt sein.
 Die Multicastports (udp) in Verwendung sind 6024 und 6025.
 
  
**Ubuntu 22.04 kann *.AppImage Pakete nicht starten**

 libfuse2 muss auf Ubuntu nachinstalliert werden.  

`sudo apt install libfuse2` 

  
**Neuere Linux Ubuntu basierte Varianten können Next-Exam nicht starten**

`echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-electron.conf   

 sudo sysctl --system`   
  


 deaktiviert die Einschränkung von User Namespaces durch AppArmor. Electron benötigt dies oft für AppImages, da es sonst keine ausreichenden Rechte bekommt, um richtig zu starten.
 


