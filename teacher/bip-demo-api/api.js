import express from 'express'; // Express importieren
import cors from 'cors';



const app = express(); // Express App erstellen
app.use(express.json()); // JSON-Middleware
app.use(cors());

// Route für Student
app.get('/student', (req, res) => {
    res.json(studentInfo); // JSON zurückgeben
});

// Route für Teacher (nur lesend)
app.get('/teacher', (req, res) => {
    res.json(teacherInfo); // JSON zurückgeben
});

// Route für Teacher (schreiben möglich)
app.post('/teacher', (req, res) => {
    let teacherIP = req.body.teacherIP
    let teacherID = req.body.teacherID
    let examPin = req.body.pin
    let examStatus = req.body.status
    let examID = req.body.examID

    console.log("teacher route called", req.body)
    //update exam status in corresponding student exam object
    studentInfo.exams.forEach(exam => {

        if (exam.id == examID){
            let teachers = exam.examTeachers

            teachers.forEach(teacher => {
                if (teacher.teacherID == teacherID) {
                    teacher.teacherIP = teacherIP; // update current local teacher ip
                }
            });

            exam.examStatus = examStatus  // set status to active
            exam.examPin = examPin        // set current exam pin for direct connection without pin
        }
    })


    teacherInfo.exams.forEach(exam =>{
        if (exam.id == examID){

            let teachers = exam.examTeachers

            teachers.forEach(teacher => {
                    if (teacher.teacherID == teacherID) {
                        teacher.teacherIP = teacherIP;   // update current local teacher ip
                    }
            });

            exam.pin = examPin   // update pin to allow direct connection
        }
    })


    



    res.json({ message: 'Data updated!', data: req.body });
});

// Server starten
app.listen(3000, () => {
    console.log("--------------------------------------")
    console.log('Demo API Server läuft auf Port 3000');
    console.log("--------------------------------------")
});






let studentInfo = {
    exams: [{
        id: "d10cdfc7-ba91-4845-818e-eaae81595dfa", // eindeutige ID im BiP
        examName: "5a_2_E-Schularbeit", // Name der Prüfung wie sie am Client dargstellt werden soll
        examdate: "2024-10-02T10:30:00", // geplanter Beginn der Prüfung
        examDurationMinutes: 100, // Dauer der Prüfung in Minuten
        examStatus: "idle",
        examPin: null,
        examTeachers: [
            { 
                teacherID: null, // BiP-ID der Lehrperson
                teacherIP: null // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
            }
        ]
    }] 
}
  


 let teacherInfo = {

    exams: [
        {
            bip: true,
            id: "d10cdfc7-ba91-4845-818e-eaae81595dfa", // eindeutige ID im BiP
            examName: "5a_2_E-Schularbeit", // Name der Prüfung wie sie am Client dargstellt werden soll
            examDate: "2024-10-02T10:30:00", // geplanter Beginn der Prüfung
            examDurationMinutes: 100, // Dauer der Prüfung in Minuten
            pin: null, // exam pin
            requireBiP: true,  // müssen die clients am bip authentifizieren damit sie zur teacher instanz verbinden können?
            exammode: true,       // clients werden sofort abgesichert true/false
            delfolderonexit: false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
            screenshotinterval: 4,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
            abgabeintervalPause: 6, // in welchem intervall sollen die abgaben von den clients gesichert werden
            screenslocked: false, // sind die client screens abgesperrt (abgedunkelt)
            screenshotocr: false,   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden

            examTeachers: [
                { 
                    teacherID: 92136, // BiP-ID der Lehrperson
                    teacherIP: "" // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
                }
            ],
            examSecurityKey: "oI9xGzHkUFe7Lg2iTXHkYp4pDab3Nvj4kFEOqA93cZE=",   // symmetrisch, für mathe matura falls dateien verschlüsselt übertragen werden - soll erst zu schülern übertragen werden wenn die prüfung startet
            activeSection: 1,
            examSections: {
                1: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    spellchecklang: "en-GB",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
                    suggestions: false,   // soll language tool vorschläge für verbesserungen zeigen
                    moodleTestId: null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
                    moodleDomain: null,  // domain der moodle instanz
                    moodleURL: null,  // vollständige moodle test url
                    cmargin: {    // angaben für den korrekturrand bei der pdf erstellung im editor
                        side: "right",
                        size: 3    // cm 
                    },
                    gformsTestId: null,   // id des google forms formulares
                    msOfficeFile: false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden
                    linespacing: 2,  // zeilenabstand im finalen pdf das aus dem editor generiert wird
                    languagetool: false,    // rechtschreibüberprüfung mit languagetool ja /nein
                    fontfamily: "sans-serif",  // serife schriftart im editor oder non-serif ?
                    audioRepeat: 0, // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
                    domainname: false,  //zieldomain für den exam mode "webseite"
                    groups: true,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
                    groupA: {
                        users : [   // gruppeneinteilung A - Für die Clientnamen werden die Benutzernamen des BiP herangezogen.
                            "thomas.weissel@bildung.gv.at",    // client name
                            "gerald.landl@bildung.gv.at"
                        ],
                        examInstructionFiles: [
                            {
                                filename: "angabe1.pdf",
                                filecontent: "data:text/plain;base64,SGVsbG8=",
                                checksum: "098f6bcd4621d373cade4e832627b4f6"
                            }
                        ]
                    },
                    groupB: { 
                        users: ["rene.braunshier@bildung.gv.at"],
                        examInstructionFiles: [
                            {
                                filename: "angabe2.pdf",
                                filecontent: "data:text/plain;base64,SGVsbG8=oeai",
                                checksum: "6f1ed002ab5595859014ebf0951522d9"
                            }
                        ]
                    },
                },    
                2: {  
                    examtype: "math",  // editor, math, eduvidual, gforms, website, microsoft365
                    spellchecklang: "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
                    suggestions: false,   // soll language tool vorschläge für verbesserungen zeigen
                    moodleTestId: null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
                    moodleDomain: null,  // domain der moodle instanz
                    moodleURL: null,  // vollständige moodle test url
                    cmargin: {    // angaben für den korrekturrand bei der pdf erstellung im editor
                        side: "right",
                        size: 3    // cm 
                    },
                    gformsTestId: null,   // id des google forms formulares
                    msOfficeFile: false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden                
                    linespacing: 2,  // zeilenabstand im finalen pdf das aus dem editor generiert wird                    
                    languagetool: false,    // rechtschreibüberprüfung mit languagetool ja /nein
                    fontfamily: "sans-serif",  // serife schriftart im editor oder non-serif ?
                    audioRepeat: 0, // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
                    domainname: false,
                    groups: false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
                    groupA: {
                        users : [],
                        examInstructionFiles: []
                    },
                    groupB: { 
                        users: [],
                        examInstructionFiles: []
                    },
                },  
            }
        },
        {
            bip: true,
            id: "uy5cdfc7-cu91-4845-818e-eaae8159uui", // eindeutige ID im BiP
            examName: "5b_D-Schularbeit", // Name der Prüfung wie sie am Client dargstellt werden soll
            examDate: "2025-02-02T10:30:00", // geplanter Beginn der Prüfung
            examDurationMinutes: 100, // Dauer der Prüfung in Minuten
            pin: null, // exam pin
            requireBiP: true,  // müssen die clients am bip authentifizieren damit sie zur teacher instanz verbinden können?
            exammode: true,       // clients werden sofort abgesichert true/false
            delfolderonexit: false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
            screenshotinterval: 4,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
            abgabeintervalPause: 6, // in welchem intervall sollen die abgaben von den clients gesichert werden
            screenslocked: false, // sind die client screens abgesperrt (abgedunkelt)
            screenshotocr: false,   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden
            examTeachers: [
                { 
                    teacherID: 92136, // BiP-ID der Lehrperson
                    teacherIP: "" // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
                }
            ],
            examSecurityKey: "oI9xGzHkUoe4eoiUEI34p4pDab3Nvj4kFEOqA93cZE=",   // symmetrisch, für mathe matura falls dateien verschlüsselt übertragen werden - soll erst zu schülern übertragen werden wenn die prüfung startet
            activeSection: 1,
            examSections: {
                1: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    spellchecklang: "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
                    suggestions: false,   // soll language tool vorschläge für verbesserungen zeigen
                    moodleTestId: null,   // aus der angegebenen moodle domain wird die test id automatisch herausgeschnitten
                    moodleDomain: null,  // domain der moodle instanz
                    moodleURL: null,  // vollständige moodle test url
                    cmargin: {    // angaben für den korrekturrand bei der pdf erstellung im editor
                        side: "right",
                        size: 3    // cm 
                    },
                    gformsTestId: null,   // id des google forms formulares
                    msOfficeFile: false,  // welche datei (am onedrive der lehrperson) soll den clients zum editieren zur verfügung gestellt werden
                    linespacing: 2,  // zeilenabstand im finalen pdf das aus dem editor generiert wird
                    languagetool: false,    // rechtschreibüberprüfung mit languagetool ja /nein
                    fontfamily: "sans-serif",  // serife schriftart im editor oder non-serif ?
                    audioRepeat: 0, // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
                    domainname: null,
                    groups: false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
                    groupA: {
                        users : [],
                        examInstructionFiles: []
                    },
                    groupB: { 
                        users: [],
                        examInstructionFiles: []
                    },
                }
            }
        }
    ]
}
  