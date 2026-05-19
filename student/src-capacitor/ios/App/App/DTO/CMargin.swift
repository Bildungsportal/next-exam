struct CMargin: Codable {
    var side: String = "right"
    var size: Int = 3

    var asDictionary: [String: Any] {
        return [
            "side": side,
            "size": size
        ]
    }
}
