# Übergabe der iOS Entwicklung

## iOS Building

Um den Build durchzuführen werden ein paar dependencies gebraucht, Xcode muss installiert sein und für die iOS spezifischen dependencies wird Homebrew und CocoaPods benötigt, siehe: https://capacitorjs.com/docs/getting-started/environment-setup

Die iOS variante von next-exam kann einfach über npm gebaut werden, dafür den Befehl 'npm run build:ios' ausführen. Der build wird durch mehrere Schritte gehen, zuerst wird die Capacitor anwendung gebaut, dann wird die Anwendung in das Xcode Projekt kopiert und danach versucht capacitor die ios app über die Kommandozeile zu bauen, das führt zu einem error, da das bauen über die Kommandozeile nicht funktioniert, über Xcode ist das Projekt trotzdem baubar.

## Xcode und Simulator

Xcode muss über das Company Portal installiert werden der App Store ist deaktiviert.

Sobald xcode installiert ist und das Projekt ein erstes mal gebaut wurde kann in dem Folder 'student/src-capacitor/ios/App' die Datei 'App.xcworkspace' geöffnet werden, damit sollte sich Xcode öffnen.

Aufpassen nicht 'App.xcodeproj', mit der öffnet sich auch das Projekt aber alle dependencies Fehlen.

Am oberen Rand von Xcode kann der Simulator eingestellt werden, hier einfach ein Ipad auswählen.

Dann kann das Projekt in Xcode gebaut werden, und der Simulator öffnet sich.

Um die Devtools wie bei Electron zu bekommen muss man Safari öffnen, in der Menüleiste auf Develop das Ipad auswählen und auf die Capacitor applikation drücken.

## Derzeitiger Stand

Das Ticket an dem ich gearbeitet habe ist: "Modifikation des Windowmanagement für Capacitor Implementierung" #386

Der Router ist jetzt richtig importiert und wird aufgerufen, die Fehlermeldung im Moment ist, dass ein Token benötigt ist um zu navigaten. Welcher token hier gemeint ist ist mir leider nicht klar, es könnte der biptoken sein, doch dass der gebraucht wird um auf eine andere Seite zu redirecten wäre komisch und das Feld dafür sollte biptoken nicht nur 'token' heißen.
