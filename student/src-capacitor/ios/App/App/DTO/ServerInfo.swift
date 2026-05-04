struct ServerInfo: Codable {
    var servername: String
    var timestamp: Int64
    var id: String
    var ip: String
    var bip: Bool
    var version: String
    var serverip: String?
    var serverport: Int?
    var reachable: Bool?
    
    var asDictionary: [String: Any] {
        return [
            "servername": servername,
            "timestamp": Int(timestamp),
            "id": id,
            "ip": ip,
            "bip": bip,
            "version": version,
            "serverip": serverip!,
            "serverport": serverport!,
            "reachable": reachable!
        ]
    }
}
