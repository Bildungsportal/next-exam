struct GetInfoAsync {
    let serverlist: [ServerInfo]
    let clientinfo: ClientInfo
    let serverstatus: ServerStatus

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        [
            "serverlist":           serverlist.map { $0.asDictionary },
            "clientinfo":           clientinfo.asDictionary,
            "serverstatus":         serverstatus.asDictionary,
        ]
    }
}
