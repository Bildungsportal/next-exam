struct URLItem: Codable {
    let url: String
    let blockSubdomains: Bool?
    let blockSubfolders: Bool?

    enum CodingKeys: String, CodingKey {
        case url
        case blockSubdomains
        case blockSubfolders
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try container.decode(String.self, forKey: .url)
        blockSubdomains = try container.decodeIfPresent(Bool.self, forKey: .blockSubdomains)
        blockSubfolders = try container.decodeIfPresent(Bool.self, forKey: .blockSubfolders)
    }
}

struct ExamGroup: Codable {
    var users: [String] = []
    var examInstructionFiles: [String] = []
    var allowedUrls: [AnyCodable] = []
    var examConfig: ExamConfig = ExamConfig()

    var asDictionary: [String: Any] {
        let urlArray = allowedUrls.map { item -> Any in
            if let dict = item.value as? [String: Any] {
                return dict
            } else if let str = item.value as? String {
                return str
            }
            return ""
        }
        return [
            "users": users,
            "examInstructionFiles": examInstructionFiles,
            "allowedUrls": urlArray,
            "examConfig": examConfig.asDictionary
        ]
    }
}

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) {
            value = str
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let arr = try? container.decode([AnyCodable].self) {
            value = arr.map { $0.value }
        } else {
            value = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let str = value as? String {
            try container.encode(str)
        } else if let dict = value as? [String: Any] {
            let anyCodableDict = dict.mapValues { AnyCodable($0) }
            try container.encode(anyCodableDict)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else if let arr = value as? [Any] {
            let anyCodableArr = arr.map { AnyCodable($0) }
            try container.encode(anyCodableArr)
        } else {
            try container.encodeNil()
        }
    }
}
