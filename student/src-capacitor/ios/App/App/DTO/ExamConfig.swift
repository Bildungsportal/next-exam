struct ExamConfig: Codable {
    var activeSheets: [String: Any] = [:]
    var editor: [String: Any] = [:]
    var eduvidual: [String: Any] = [:]
    var gforms: [String: Any] = [:]
    var website: [String: Any] = [:]
    var math: [String: Any] = [:]
    var microsoft365: [String: Any] = [:]
    var rdp: [String: Any] = [:]
    var localvm: [String: Any] = [:]

    var asDictionary: [String: Any] {
        return [
            "activeSheets": activeSheets,
            "editor": editor,
            "eduvidual": eduvidual,
            "gforms": gforms,
            "website": website,
            "math": math,
            "microsoft365": microsoft365,
            "rdp": rdp,
            "localvm": localvm
        ]
    }
}
