struct ExamGroup: Codable {
    var users: [String] = []
    var examInstructionFiles: [String] = []
    var allowedUrls: [String] = []
    var examConfig: ExamConfig = ExamConfig()

    var asDictionary: [String: Any] {
        return [
            "users": users,
            "examInstructionFiles": examInstructionFiles,
            "allowedUrls": allowedUrls,
            "examConfig": examConfig.asDictionary
        ]
    }
}
