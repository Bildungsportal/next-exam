struct CMargin {
    var side: String
    var size: Int

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "side": side,
            "size": size
        ]
    }
}
