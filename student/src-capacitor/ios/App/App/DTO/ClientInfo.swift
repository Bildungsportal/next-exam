import Foundation

struct ClientInfo: Codable {
    var name: String                          = "DemoUser"
    var token: String?                        = nil
    var lockedSection: Int                    = 1
    var ip: String?                           = nil
    var hostname: String?                     = nil
    var serverip: String?                     = nil
    var servername: String?                   = nil
    var focus: Bool                           = true
    var exammode: Bool                        = false
    var timestamp: Double?                    = nil
    var virtualized: Bool                     = false
    var examtype: String?                     = nil
    var pin: String?                          = nil
    var screenlock: Bool                      = false
    var msofficeshare: Bool                   = false
    var screenshotinterval: Int               = 4000
    var printrequest: Bool                    = false
    var privateSpellcheck: PrivateSpellcheck  = PrivateSpellcheck()
    var localLockdown: Bool                   = false
    var groups: Bool                          = false
    var group: String                         = "a"
    var submissionnumber: Int                 = 0
    var localVMHost: String?                  = nil
    var localVMState: String?                 = nil
    var version: String                       = AppConfig.version
    
    var asDictionary: [String: Any] {
        var dict: [String: Any] = [
            // ── Non-optional primitives ───────────────────────────────────────────
            "name":               name,
            "lockedSection":      lockedSection,
            "focus":              focus,
            "exammode":           exammode,
            "virtualized":        virtualized,
            "screenlock":         screenlock,
            "msofficeshare":      msofficeshare,
            "screenshotinterval": screenshotinterval,
            "printrequest":       printrequest,
            "localLockdown":      localLockdown,
            "groups":             groups,
            "group":              group,
            "submissionnumber":   submissionnumber,
            "version":            version,

            // ── Nested struct → must be fully unwrapped ───────────────────────────
            "privateSpellcheck":  privateSpellcheck.asDictionary
        ]

        // ── Optionals → NSNull() maps to JS null ──────────────────────────────────
        dict["token"]        = token       ?? NSNull()
        dict["ip"]           = ip          ?? NSNull()
        dict["hostname"]     = hostname    ?? NSNull()
        dict["serverip"]     = serverip    ?? NSNull()
        dict["servername"]   = servername  ?? NSNull()
        dict["timestamp"]    = timestamp   ?? NSNull()
        dict["examtype"]     = examtype    ?? NSNull()
        dict["pin"]          = pin         ?? NSNull()
        dict["localVMHost"]  = localVMHost ?? NSNull()
        dict["localVMState"] = localVMState ?? NSNull()

        return dict
    }
}
