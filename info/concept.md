# webfrontend
* Bootstrap CSS Framework
* JQuery
* Vue.js
* Swal2



---

# teacher
## server api (serverroutes)
meldet sich ein client mit PIN an muss dieser überprüft werden und bei korrektem pin in eine lokale ClientList gelegt werden..

teacherinstanz erstellt ein crfs token für den client und sendet dieses bei korrektem PIN dem client zurück. das token ist vorraussetzung für den zugriff auf die api routen

## multicastserver (broadcasting)
broadcastet exam object {name, timestamp} an alle (
multicast ist nicht in jedem netz verfügbar daher zeigt das teacher dashboard die IP an und das studend UI erlaubt die eingabe von IP oder domain und holt automatisch verfügbare prüfungen)


## teacher frontend

formular um exam name zu wählen... startet über #teacher api den #multicastserver (beliebig viele multicast server)


- File Upload [File Upload ](https://github.com/richardgirges/express-fileupload)
  achtung: electron erwartet beim file upload formdata einen BLOB




---


# student

der client macht alle 4 sek ein update an die /server/control/update route und holt sich aktuelle tasks und informationen


pull von files:
teacher uploaded files (dateien werden im prüfungsordner/UPLOADS abgelegt und für die students ein vermerk zum abholen hinterlegt (filepath))
student erhält beim nachsten update diesen vermerk und macht einen api call an /server/data/download und übergibt die erhaltenen dateipfade.
student erhält die dateien und der server streicht den vermerk


## multicastclient (listening)
startet automatisch... jede exam instanz ist automatsch auch "listening" für andere broadcasts...
hört auf die broadcasts der multicastserver und trägt empfangene infos von exam instanzen in seine    examServerList[]   ein..

## student frontend
fragt über RPC ab ob der #multicastclient schon eine exam instanz gefunden hat und zeigt sie als button an

auf klick wird ein PIN abgefragt und dieser pin mit client name und client ID an die gewählte exam instanz #teacherapi gesandt


über die #teacherapi kann dann beim teacher der pin geprüft und der client bei korrektem pin in eine clientList aufgenommen werden... (ip, id, port)
es wird ein einzigartiges token für den client generiert und dieses an den client zurück gesandt (auth für die teacher api)

dadurch können dann die anderen teacher api routes vom client genutzt werden.


für den exam mode werden am client externe programme, skripte getriggert werden um das system noch weiter abzusperren 
der teacher wird immer verständigt wenn ein schüler es schafft den exam mode irgendwie zu verlassen und screenshots werden aufgezeichnet

[child_process_execfile documentation](https://nodejs.org/api/child_process.html#child_process_child_process_execfile_file_args_options_callback)
