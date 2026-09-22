struct PrivateSpellcheck: Codable {
    var activated: Bool = false
    
    var asDictionary: [String: Any] {
        return [
            "activated":          activated,
        ]
    }
}
