struct ServerInfo: Codable {
    var servername: String
    var timestamp: Int64
    var id: String
    var ip: String
    var bip: Bool
    var version: String
    
    var asDictionary: [String: Any] {
        return [
            "servername": servername,
            "timestamp": Int(timestamp),
            "id": id,
            "ip": ip,
            "bip": bip,
            "version": version
        ]
    }
}
