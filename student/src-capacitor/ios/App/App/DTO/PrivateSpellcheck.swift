struct PrivateSpellcheck: Codable {
    var activate: Bool = false
    var activated: Bool = false
    var suggestions: Bool = false

    var asDictionary: [String: Any] {
        return [
            "activate":    activate,
            "activated":   activated,
            "suggestions": suggestions,
        ]
    }
}
