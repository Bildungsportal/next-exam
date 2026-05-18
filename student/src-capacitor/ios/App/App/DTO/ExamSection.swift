struct ExamSection: Codable {
    var examtype: String = "math"
    var timelimit: Int = 60
    var locked: Bool = false
    var sectionname: String = "Abschnitt 1"
    var spellchecklang: String = "de-DE"
    var suggestions: Bool = false
    var cmargin: CMargin = CMargin()
    var formsUrl: String = "" // Remove?
    var msOfficeFile: Bool = false // Remove?
    var linespacing: Int = 2
    var languagetool: Bool = false
    var fontfamily: String = "sans-serif"
    var fontsize: String = "12pt"
    var audioRepeat: Int = 0
    var localVMConfig: LocalVMConfig = LocalVMConfig()

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
            "cmargin": cmargin.asDictionary,
            "formsUrl": formsUrl,
            "msOfficeFile": msOfficeFile,
            "linespacing": linespacing,
            "languagetool": languagetool,
            "fontfamily": fontfamily,
            "fontsize": fontsize,
            "audioRepeat": audioRepeat,
            "localVMConfig": localVMConfig.asDictionary,
            "groups": groups,
            "groupA": groupA.asDictionary,
            "groupB": groupB.asDictionary
        ]
    }
}

