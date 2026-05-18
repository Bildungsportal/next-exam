struct ExamSection: Codable {
    var examtype: String = "math"
    var timelimit: Int = 60
    var locked: Bool = false
    var sectionname: String = "Abschnitt 1"
    var spellchecklang: String = "de-DE"
    var suggestions: Bool = false

    var moodleTestId: String? = nil
    var moodleDomain: String = "eduvidual.at"
    var moodleURL: String? = nil
    var cmargin: CMargin = CMargin()

    var formsUrl: String? = nil
    var msOfficeFile: String? = nil
    var linespacing: Int = 2
    var languagetool: Bool = false
    var fontfamily: String = "sans-serif"
    var fontsize: String = "12pt"
    var audioRepeat: Int = 0
    var domainname: Bool = false
    var blockSubdomains: Bool = false
    var blockSubfolders: Bool = false
    var rdpConfig: String? = nil
    var localVMConfig: String? = nil

    var groups: Bool = false
    var groupA: ExamGroup = ExamGroup()
    var groupB: ExamGroup = ExamGroup()

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "examtype": examtype,
            "timelimit": timelimit,
            "locked": locked,
            "sectionname": sectionname,
            "spellchecklang": spellchecklang,
            "suggestions": suggestions,
            "moodleTestId": moodleTestId as Any,
            "moodleDomain": moodleDomain,
            "moodleURL": moodleURL as Any,
            "cmargin": cmargin.asDictionary,
            "formsUrl": formsUrl as Any,
            "msOfficeFile": msOfficeFile as Any,
            "linespacing": linespacing,
            "languagetool": languagetool,
            "fontfamily": fontfamily,
            "fontsize": fontsize,
            "audioRepeat": audioRepeat,
            "domainname": domainname,
            "blockSubdomains": blockSubdomains,
            "blockSubfolders": blockSubfolders,
            "rdpConfig": rdpConfig as Any,
            "localVMConfig": localVMConfig as Any,
            "groups": groups,
            "groupA": groupA.asDictionary,
            "groupB": groupB.asDictionary
        ]
    }
}

