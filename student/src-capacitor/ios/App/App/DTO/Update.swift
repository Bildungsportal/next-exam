import Foundation

struct Update: Codable {
    var sender: String
    var message: String
    var status: String
    var serverstatus: ServerStatus
    var studentstatus: StudentStatus

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        return [
            "sender": sender,
            "message": message,
            "status": status,
            "serverstatus": serverstatus,
            "studentstatus": studentstatus,
        ]
    }
}
