struct ExamSection {
    var examtype: String
    var cmargin: CMargin
    var linespacing: String
    var audioRepeat: Int
    var languagetool: Bool
    var spellchecklang: String
    var suggestions: Bool

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "examtype": examtype,
            "cmargin": cmargin.asDictionary,
            "linespacing": linespacing,
            "audioRepeat": audioRepeat,
            "languagetool": languagetool,
            "spellchecklang": spellchecklang,
            "suggestions": suggestions
        ]
    }
}
