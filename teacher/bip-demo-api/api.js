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

    //update exam status in corresponding student exam object
    studentInfo.exams.forEach(exam => {

        if (exam.id == examID){
            console.log("API: update exam status in corresponding student exam object")
            
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
            exam.lastUpdate = new Date().getTime()  //update timestamp of last update

            let teachers = exam.examTeachers
            teachers.forEach(teacher => {
                    if (teacher.teacherID == teacherID) {
                        teacher.teacherIP = teacherIP;   // update current local teacher ip
                    }
                    else {
                        teacher.teacherIP = null;  // reset teacher ip if not the current teacher
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



// Start interval check when API initializes
const startExamStatusCheck = () => {
    setInterval(() => {
        const currentTime = new Date().getTime() // current timestamp
        if (teacherInfo?.exams) {
          Object.keys(teacherInfo.exams).forEach(examId => {
            const exam = teacherInfo.exams[examId];

            if (currentTime - exam.lastUpdate > 10*1000 && studentInfo?.exams?.[examId].examStatus !== "offline") {
              console.log("API @ examstatuscheck: updating stale exam"); // remove from teacherInfo
             
              if (studentInfo?.exams?.[examId]) {
                studentInfo.exams[examId].examStatus = 'offline';
              }
            }
          });
        }
      }, 10000);
};

// Call this when your API initializes
startExamStatusCheck();


let studentInfo = {
    exams: [{
        id: "d10cdfc7-ba91-4845-818e-eaae81595dfa", // eindeutige ID im BiP
        examName: "5A-English", // Name der Prüfung wie sie am Client dargstellt werden soll
        examdate: "2025-10-02T10:30:00", // geplanter Beginn der Prüfung
        examDurationMinutes: 100, // Dauer der Prüfung in Minuten
        examStatus: "offline",
        examPin: null,
        examTeachers: [
            { 
                teacherID: 92136, // BiP-ID der Lehrperson
                teacherIP: null // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
            }
        ]
    },
    {
        id: "udhdhdfc7-bau91-4u5-214u-uuuiu8159iuhh", // eindeutige ID im BiP
        examName: "5A-Deutsch", // Name der Prüfung wie sie am Client dargstellt werden soll
        examdate: "2025-12-02T10:30:00", // geplanter Beginn der Prüfung
        examDurationMinutes: 100, // Dauer der Prüfung in Minuten
        examStatus: "offline",
        examPin: null,
        examTeachers: [
            { 
                teacherID: 22136, // BiP-ID der Lehrperson
                teacherIP: null // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
            }
        ]
    },


    ] 
}
  


 let teacherInfo = {

    exams: [
        {
            lastUpdate: new Date().getTime(),
            bip: true,
            id: "d10cdfc7-ba91-4845-818e-eaae81595dfa", // eindeutige ID im BiP
            examName: "5A-English", // Name der Prüfung wie sie am Client dargstellt werden soll
            examDate: "2024-10-02T10:30:00", // geplanter Beginn der Prüfung
            examDurationMinutes: 100, // Dauer der Prüfung in Minuten
            pin: 2222, // exam pin
            requireBiP: true,  // müssen die clients am bip authentifizieren damit sie zur teacher instanz verbinden können?
            exammode: true,       // clients werden sofort abgesichert true/false
            delfolderonexit: false,  // ordner der clients beim beenden des abgesicherten modus löschen (am client)
            screenshotinterval: 4,  // in welchem intervall sollen die screenshots der clients aktualisiert werden (overhead beachten)
            abgabeintervalPause: 6, // in welchem intervall sollen die abgaben von den clients gesichert werden
            screenslocked: false, // sind die client screens abgesperrt (abgedunkelt)
            screenshotocr: false,   // soll als zusätzliche sicherheit im screenshot der clients nach dem exam pin gesucht werden

            examStudents: [
                {
                    studentID: 123456,
                    studentName: "Max Mustermann",
                    studentSeat: "1"  //für optionalen sitzplatzplan
                },
                {
                    studentID: 123457,
                    studentName: "Eva Musterfrau",
                    studentSeat: "2"
                }
            ],

            examTeachers: [
                { 
                    teacherID: 92136, // BiP-ID der Lehrperson
                    teacherIP: "" // automatisch gesetzt sobald der Lehrer eine Prüfung im BiP startet. 
                }
            ],
            examSecurityKey: "oI9xGzHkUFe7Lg2iTXHkYp4pDab3Nvj4kFEOqA93cZE=",   // symmetrisch, für mathe matura falls dateien verschlüsselt übertragen werden - soll erst zu schülern übertragen werden wenn die prüfung startet
            useExamSections: true, //if false exam section 1 is used and no tabs are displayed
            activeSection: 1,
            examSections: {
                1: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    timelimit: 20, // in minutes
                    locked: true,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                    sectionname: "Reading",
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
                            "Weissel Thomas",    // clientname
                            "Robert Schrenk"
                        ],
                        examInstructionFiles: [
                            {
                                filename: "angabe1.pdf",
                                filetype: "pdf",
                                filecontent: "data:application/pdf;base64,JVBERi0xLjIgCjkgMCBvYmoKPDwKPj4Kc3RyZWFtCkJULyA5IFRmKFRlc3QpJyBFVAplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgovQ29udGVudHMgOSAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0tpZHMgWzQgMCBSIF0KL0NvdW50IDEKL1R5cGUgL1BhZ2VzCi9NZWRpYUJveCBbIDAgMCA5OSA5IF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1BhZ2VzIDUgMCBSCi9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDMgMCBSCj4+CiUlRU9G",
                                checksum: "098f6bcd4621d373cade4e832627b4f6"
                            }
                        ]
                    },
                    groupB: { 
                        users: [
                            "Rene Braunshier", 
                            "Gerald Landl"
                        ],
                        examInstructionFiles: [
                            {
                                filename: "angabe2.pdf",
                                filetype: "pdf",
                                filecontent: "data:application/pdf;base64,JVBERi0xLjIgCjkgMCBvYmoKPDwKPj4Kc3RyZWFtCkJULyA5IFRmKFRlc3QpJyBFVAplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCA1IDAgUgovQ29udGVudHMgOSAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0tpZHMgWzQgMCBSIF0KL0NvdW50IDEKL1R5cGUgL1BhZ2VzCi9NZWRpYUJveCBbIDAgMCA5OSA5IF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1BhZ2VzIDUgMCBSCi9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iagp0cmFpbGVyCjw8Ci9Sb290IDMgMCBSCj4+CiUlRU9G",
                                checksum: "6f1ed002ab5595859014ebf0951522d9"
                            }
                        ]
                    },
                },    
                2: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    timelimit: 20, // in minutes
                    locked: false,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                    sectionname: "Listening",
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
                    domainname: false,
                    groups: false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
                    groupA: {
                        users : [],
                        examInstructionFiles: [{
                            filename: "a story of a man.mp3",
                            filetype: "audio",
                            filecontent: "data:audio/mp3;base64,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",
                            checksum: "6f1ed002oeii595859014ebf0951522d9"
                        }]
                    },
                    groupB: { 
                        users: [],
                        examInstructionFiles: []
                    },
                },
                3: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    timelimit: 40, // in minutes
                    locked: false,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                    sectionname: "Writing",
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
                    languagetool: true,    // rechtschreibüberprüfung mit languagetool ja /nein
                    fontfamily: "sans-serif",  // serife schriftart im editor oder non-serif ?
                    audioRepeat: 0, // wie oft dürfen die teilnehmenden eine audio datei abspielen 0 - unlimited
                    domainname: false,
                    groups: false,   // sollen die clients in 2 gruppen A / B aufgeteilt werden
                    groupA: {
                        users : [],
                        examInstructionFiles: [{
                            filename: "toystory.jpg",
                            filetype: "image",
                            filecontent: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAUADIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=",
                            checksum: "6f1ed002oeii59585aoeiaoei0951522d9"
                        }]
                    },
                    groupB: { 
                        users: [],
                        examInstructionFiles: []
                    },
                },
                4: {  
                    examtype: "editor",  // editor, math, eduvidual, gforms, website, microsoft365
                    timelimit: 40, // in minutes
                    locked: false,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                    sectionname: "Language in Use",
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
                    languagetool: true,    // rechtschreibüberprüfung mit languagetool ja /nein
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
                }
            }
        },
        {
            lastUpdate: new Date().getTime(),
            bip: true,
            id: "uy5cdfc7-cu91-4845-818e-eaae8159uui", // eindeutige ID im BiP
            examName: "5B-Mathematik", // Name der Prüfung wie sie am Client dargstellt werden soll
            examDate: "2025-02-02T10:30:00", // geplanter Beginn der Prüfung
            examDurationMinutes: 100, // Dauer der Prüfung in Minuten
            pin: 3434, // exam pin
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
            useExamSections: false, //if false exam section 1 is used and no tabs are displayed
            activeSection: 1,
            examSections: {
                1: {  
                    examtype: "math",  // editor, math, eduvidual, gforms, website, microsoft365
                    timelimit: 50, // in minutes
                    locked: false,  // if true, the current section is locked and no changes can be made - this means its currently active for students
                    spellchecklang: "de-DE",  // en-GB, de-DE, fr-FR, es-ES, it-IT, none
                    sectionname: "Abschnitt 1",
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
  