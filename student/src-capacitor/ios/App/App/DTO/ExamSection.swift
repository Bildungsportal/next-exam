import Foundation

struct ExamSection: Codable {
    var examtype: String = "math"
    var timelimit: Int = 60
    var locked: Bool = false
    var sectionname: String = "Abschnitt 1"
    var spellchecklang: String? = nil
    var suggestions: Bool? = nil
    var moodleTestId: Int? = nil
    var moodleDomain: String? = nil
    var moodleURL: String? = nil
    var cmargin: CMargin? = nil
    var formsUrl: String? = nil
    var msOfficeFile: Bool? = nil
    var linespacing: Int? = nil
    var languagetool: Bool? = nil
    var fontfamily: String? = nil
    var fontsize: String? = nil
    var audioRepeat: Int? = nil
    var domainname: Bool? = nil
    var blockSubdomains: Bool? = nil
    var blockSubfolders: Bool? = nil
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
        dict["spellchecklang"]   = spellchecklang       ?? NSNull()
        dict["suggestions"]      = suggestions          ?? NSNull()
        dict["moodleTestId"]     = moodleTestId          ?? NSNull()
        dict["moodleDomain"]     = moodleDomain          ?? NSNull()
        dict["moodleURL"]        = moodleURL             ?? NSNull()
        dict["cmargin"]          = cmargin?.asDictionary    ?? NSNull()
        dict["formsUrl"]         = formsUrl              ?? NSNull()
        dict["msOfficeFile"]     = msOfficeFile          ?? NSNull()
        dict["linespacing"]      = linespacing          ?? NSNull()
        dict["languagetool"]     = languagetool         ?? NSNull()
        dict["fontfamily"]       = fontfamily           ?? NSNull()
        dict["fontsize"]         = fontsize             ?? NSNull()
        dict["audioRepeat"]      = audioRepeat          ?? NSNull()
        dict["domainname"]       = domainname           ?? NSNull()
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

