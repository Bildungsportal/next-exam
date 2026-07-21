struct RegistrationResponse: Codable {
    let status: String?
    let token: String?
    let message: String?
    let version: String?
    let versioninfo: String?
    let screenshotinterval: Int?
}
