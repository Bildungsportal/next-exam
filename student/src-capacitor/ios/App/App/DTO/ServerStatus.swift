import Foundation

struct ServerStatus: Codable {

    var bip: Bool = false
    var id: String? = nil
    var nextexamVersion: String? = nil
    var examName: String? = nil
    var examPassword: String? = nil
    var examDate: String = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter.string(from: Date())
    }()
    var examDurationMinutes: Int = 100
    var pin: String = ""
    var backupdirectory: Bool = false
    var requireBiP: Bool = false
    var exammode: Bool = false
    var delfolderonexit: Bool = true
    var screenshotinterval: Int = 4
    var backupintervalPause: Int = 6
    var screenslocked: Bool = false
    var screenshotocr: Bool = false
    var examTeachers: [String] = []
    var examSecurityKey: String = "oI9xGzHkUFe7Lg2iTXHkYp4pDab3Nvj4kFEOqA93cZE="
    var useExamSections: Bool = false       // if false, section 1 is used and no tabs are displayed
    var allowSectionSwitch: Bool = false    // allow students to switch between exam sections
    var activeSection: Int = 1
    var lockedSection: Int = 1
    var examSections: [Int: ExamSection] = [
        1: ExamSection(),
        2: ExamSection(),
        3: ExamSection(),
        4: ExamSection()
    ]

    var spellcheck: Bool = false
    var spellchecklang: String = "de-DE"
    var suggestions: Bool = false
    var moodleTestType: String = ""
    var moodleDomain: String = "eduvidual.at"
    var msOfficeFile: Bool = false
    var unlockonexit: Bool = false
    var fontfamily: String = "sans-serif"
    var moodleTestId: String = ""
    var languagetool: Bool = false
    var password: String = ""

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "bip": bip,
            "id": id as Any,
            "nextexamVersion": nextexamVersion as Any,
            "examName": examName as Any,
            "examPassword": examPassword as Any,
            "examDate": examDate,
            "examDurationMinutes": examDurationMinutes,
            "pin": pin,
            "backupdirectory": backupdirectory,
            "requireBiP": requireBiP,
            "exammode": exammode,
            "delfolderonexit": delfolderonexit,
            "screenshotinterval": screenshotinterval,
            "backupintervalPause": backupintervalPause,
            "screenslocked": screenslocked,
            "screenshotocr": screenshotocr,
            "examTeachers": examTeachers,
            "examSecurityKey": examSecurityKey,
            "useExamSections": useExamSections,
            "allowSectionSwitch": allowSectionSwitch,
            "activeSection": activeSection,
            "lockedSection": lockedSection,
            "examSections": examSections.reduce(into: [String: Any]()) { result, pair in
                result[String(pair.key)] = pair.value.asDictionary
            },
            "spellcheck": spellcheck,
            "spellchecklang": spellchecklang,
            "suggestions": suggestions,
            "moodleTestType": moodleTestType,
            "moodleDomain": moodleDomain,
            "msOfficeFile": msOfficeFile,
            "unlockonexit": unlockonexit,
            "fontfamily": fontfamily,
            "moodleTestId": moodleTestId,
            "languagetool": languagetool,
            "password": password
        ]
    }
}
