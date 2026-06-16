import Foundation

struct StudentStatus: Codable {
    var group: String? = nil
    var restorefocusstate: Bool? = nil
    var printdenied: Bool? = nil
    var delfolder: Bool? = nil
    var sendexam: Bool? = nil
    var sendlog: Bool? = nil
    var focus: Bool? = nil
    var getmaterials: Bool? = nil

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
            return dict
        }
}
