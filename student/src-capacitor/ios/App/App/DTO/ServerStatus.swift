struct ServerStatus {
    var exammode: Bool
    var delfolderonexit: Bool
    var spellcheck: Bool
    var spellchecklang: String
    var suggestions: Bool
    var moodleTestType: String
    var moodleDomain: String
    var screenshotinterval: Int
    var msOfficeFile: Bool
    var screenslocked: Bool
    var pin: String
    var unlockonexit: Bool
    var fontfamily: String
    var moodleTestId: String
    var languagetool: Bool
    var password: String
    var useExamSections: Bool // if false exam section 1 is used and no tabs are displayed
    var activeSection: Int
    var lockedSection: Int
    var examSections: [Int: ExamSection]

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "exammode": exammode,
            "delfolderonexit": delfolderonexit,
            "spellcheck": spellcheck,
            "spellchecklang": spellchecklang,
            "suggestions": suggestions,
            "moodleTestType": moodleTestType,
            "moodleDomain": moodleDomain,
            "screenshotinterval": screenshotinterval,
            "msOfficeFile": msOfficeFile,
            "screenslocked": screenslocked,
            "pin": pin,
            "unlockonexit": unlockonexit,
            "fontfamily": fontfamily,
            "moodleTestId": moodleTestId,
            "languagetool": languagetool,
            "password": password,
            "useExamSections": useExamSections,
            "activeSection": activeSection,
            "lockedSection": lockedSection,
            "examSections": examSections.reduce(into: [String: Any]()) { result, pair in
                result[String(pair.key)] = pair.value.asDictionary
            }
        ]
    }
}
