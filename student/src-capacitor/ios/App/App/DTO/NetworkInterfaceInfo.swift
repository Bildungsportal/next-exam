struct NetworkInterfaceInfo: Equatable {
    let name: String
    let address: String

    var asDictionary: [String: String] {
        ["name": name, "address": address]
    }
}
