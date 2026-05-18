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
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()

        dict["bip"]                  = bip
        dict["id"]                   = id                   ?? NSNull()
        dict["nextexamVersion"]      = nextexamVersion      ?? NSNull()
        dict["examName"]             = examName             ?? NSNull()
        dict["examPassword"]         = examPassword         ?? NSNull()
        dict["examDate"]             = examDate
        dict["examDurationMinutes"]  = examDurationMinutes
        dict["pin"]                  = pin
        dict["backupdirectory"]      = backupdirectory
        dict["requireBiP"]           = requireBiP
        dict["exammode"]             = exammode
        dict["delfolderonexit"]      = delfolderonexit
        dict["screenshotinterval"]   = screenshotinterval
        dict["backupintervalPause"]  = backupintervalPause
        dict["screenslocked"]        = screenslocked
        dict["screenshotocr"]        = screenshotocr
        dict["examTeachers"]         = examTeachers
        dict["examSecurityKey"]      = examSecurityKey
        dict["useExamSections"]      = useExamSections
        dict["allowSectionSwitch"]   = allowSectionSwitch
        dict["activeSection"]        = activeSection
        dict["lockedSection"]        = lockedSection
        dict["examSections"]         = examSections.reduce(into: [String: Any]()) { result, pair in
                                           result[String(pair.key)] = pair.value.asDictionary
                                       }
        dict["spellcheck"]           = spellcheck
        dict["spellchecklang"]       = spellchecklang
        dict["suggestions"]          = suggestions
        dict["moodleTestType"]       = moodleTestType
        dict["moodleDomain"]         = moodleDomain
        dict["msOfficeFile"]         = msOfficeFile
        dict["unlockonexit"]         = unlockonexit
        dict["fontfamily"]           = fontfamily
        dict["moodleTestId"]         = moodleTestId
        dict["languagetool"]         = languagetool
        dict["password"]             = password

        return dict
    }
}
