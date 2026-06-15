import Foundation

struct StudentStatus: Codable {
    var group: String
    var restorefocusstate: Bool
    var printdenied: Bool
    var delfolder: Bool
    var sendexam: Bool
    var sendlog: Bool
    var focus: Bool
    var getmaterials: Bool
    var kicked: Bool

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
            var dict = [String: Any]()

            dict["group"]             = group
            dict["restorefocusstate"] = restorefocusstate
            dict["printdenied"]       = printdenied
            dict["delfolder"]         = delfolder
            dict["sendexam"]          = sendexam
            dict["sendlog"]           = sendlog
            dict["focus"]             = focus
            dict["getmaterials"]      = getmaterials
            dict["kicked"]            = kicked

            return dict
        }
}
