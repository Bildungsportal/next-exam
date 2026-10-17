struct CheckHostIP {
    let hostIP: String               // IP of the preferred interface
    let interface: String            // Name of the preferred interface
    let availableInterfaces: [NetworkInterfaceInfo]
    let preferredInterface: String   // NWPath-determined best interface

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        [
            "hostip":               hostIP,
            "interface":            interface,
            "availableInterfaces":  availableInterfaces.map { $0.asDictionary },
            "preferredInterface":   preferredInterface
        ]
    }
}
