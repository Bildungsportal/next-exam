import Foundation

struct StudentStatus: Codable {
    var clientname: String
    var hostname: String
    var token: String
    var clientip: String
    var timestamp: Int
    var focus: Bool
    var exammode: Bool
    var imageurl: Bool
    var virtualized: Bool
    var version: String
    var bipuserID: String
    var status: String

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "clientname": clientname,
            "hostname": hostname,
            "token": token,
            "clientip": clientip,
            "timestamp": clientip,
            "focus": focus,
            "exammode": exammode,
            "imageurl": imageurl,
            "virtualized": virtualized,
            "version": version,
            "bipuserID": bipuserID,
            "status": status
        ]
    }
}
