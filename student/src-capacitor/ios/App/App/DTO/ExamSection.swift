import Foundation

struct ExamSection: Codable {
    var examtype: String = "math"
    var timelimit: Int = 60
    var locked: Bool = false
    var sectionname: String = "Abschnitt 1"
    var spellchecklang: String = "de-DE"
    var suggestions: Bool = false
    var moodleTestId: Int? = nil
    var moodleDomain: String? = nil
    var moodleURL: String? = nil
    var cmargin: CMargin = CMargin()
    var formsUrl: String? = nil
    var msOfficeFile: Bool? = false
    var linespacing: Int = 2
    var languagetool: Bool = false
    var fontfamily: String = "sans-serif"
    var fontsize: String = "12pt"
    var audioRepeat: Int = 0
    var domainname: Bool = false
    var blockSubdomains: Bool? = false
    var blockSubfolders: Bool? = false
    var rdpConfig: RdpConfig? = nil
    var localVMConfig: LocalVMConfig? = nil

    var groups: Bool = false
    var groupA: ExamGroup = ExamGroup()
    var groupB: ExamGroup = ExamGroup()
    var startTs: Int? = nil // Optional??

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        var dict = [String: Any]()

        dict["examtype"]         = examtype
        dict["timelimit"]        = timelimit
        dict["locked"]           = locked
        dict["sectionname"]      = sectionname
        dict["spellchecklang"]   = spellchecklang
        dict["suggestions"]      = suggestions
        dict["moodleTestId"]     = moodleTestId          ?? NSNull()
        dict["moodleDomain"]     = moodleDomain          ?? NSNull()
        dict["moodleURL"]        = moodleURL             ?? NSNull()
        dict["cmargin"]          = cmargin.asDictionary
        dict["formsUrl"]         = formsUrl              ?? NSNull()
        dict["msOfficeFile"]     = msOfficeFile          ?? NSNull()
        dict["linespacing"]      = linespacing
        dict["languagetool"]     = languagetool
        dict["fontfamily"]       = fontfamily
        dict["fontsize"]         = fontsize
        dict["audioRepeat"]      = audioRepeat
        dict["domainname"]       = domainname
        dict["blockSubdomains"]  = blockSubdomains  ?? NSNull()
        dict["blockSubfolders"]  = blockSubfolders  ?? NSNull()
        dict["rdpConfig"]        = rdpConfig?.asDictionary  ?? NSNull()
        dict["localVMConfig"]    = localVMConfig?.asDictionary ?? NSNull()
        dict["groups"]           = groups
        dict["groupA"]           = groupA.asDictionary
        dict["groupB"]           = groupB.asDictionary
        dict["startTs"]          = startTs               ?? NSNull()

        return dict
    }
}

