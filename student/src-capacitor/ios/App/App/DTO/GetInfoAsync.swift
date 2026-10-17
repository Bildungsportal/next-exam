struct GetInfoAsync {
    let serverlist: [ServerInfo]
    let clientinfo: ClientInfo
    let serverstatus: ServerStatus
    let battery: Float

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        [
            "serverlist":           serverlist.map { $0.asDictionary },
            "clientinfo":           clientinfo.asDictionary,
            "serverstatus":         serverstatus.asDictionary,
            "battery":              battery,
        ]
    }
}
