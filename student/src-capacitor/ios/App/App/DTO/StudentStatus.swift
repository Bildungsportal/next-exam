import Foundation

struct StudentStatus: Codable {
    var group: String? = nil
    var restorefocusstate: Bool? = nil
    var printdenied: Bool? = nil
    var delfolder: Bool? = nil
    var sendexam: Bool? = nil
    var sendlog: Bool? = nil
    var kicked: Bool? = nil
    var focus: Bool? = nil
    var getmaterials: Bool? = nil
    var msofficeshare: String? = nil
    var fetchfiles: Bool? = nil
    var activatePrivateSpellcheck: Bool? = nil
    var activatePrivateSuggestions: Bool? = nil

    init() {}

    // Tolerant decode: the teacher sends `msofficeshare` as a share URL string during a
    // microsoft365 exam but as `false` otherwise; a plain `String?` would fail the whole
    // Update decode on `false` (typeMismatch). Other fields keep the synthesized strictness.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        group             = try c.decodeIfPresent(String.self, forKey: .group)
        restorefocusstate = try c.decodeIfPresent(Bool.self, forKey: .restorefocusstate)
        printdenied       = try c.decodeIfPresent(Bool.self, forKey: .printdenied)
        delfolder         = try c.decodeIfPresent(Bool.self, forKey: .delfolder)
        sendexam          = try c.decodeIfPresent(Bool.self, forKey: .sendexam)
        sendlog           = try c.decodeIfPresent(Bool.self, forKey: .sendlog)
        kicked            = try c.decodeIfPresent(Bool.self, forKey: .kicked)
        focus             = try c.decodeIfPresent(Bool.self, forKey: .focus)
        getmaterials      = try c.decodeIfPresent(Bool.self, forKey: .getmaterials)
        fetchfiles        = try c.decodeIfPresent(Bool.self, forKey: .fetchfiles)
        activatePrivateSpellcheck  = try c.decodeIfPresent(Bool.self, forKey: .activatePrivateSpellcheck)
        activatePrivateSuggestions = try c.decodeIfPresent(Bool.self, forKey: .activatePrivateSuggestions)
        if let share = try? c.decodeIfPresent(String.self, forKey: .msofficeshare) {
            msofficeshare = share
        } else if c.contains(.msofficeshare) {
            msofficeshare = "" // teacher sent `false` → signal "no share link"
        }
    }

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
            var dict = [String: Any]()

            dict["kicked"]            = kicked
            dict["group"]             = group
            dict["restorefocusstate"] = restorefocusstate
            dict["printdenied"]       = printdenied
            dict["delfolder"]         = delfolder
            dict["sendexam"]          = sendexam
            dict["sendlog"]           = sendlog
            dict["focus"]             = focus
            dict["getmaterials"]      = getmaterials
            dict["msofficeshare"]     = msofficeshare
            dict["fetchfiles"]        = fetchfiles
            dict["activatePrivateSpellcheck"]  = activatePrivateSpellcheck
            dict["activatePrivateSuggestions"] = activatePrivateSuggestions
            return dict
        }
}
