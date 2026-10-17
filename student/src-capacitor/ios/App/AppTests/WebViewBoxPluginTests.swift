import Foundation
import Testing
@testable import App

struct WebViewBoxPluginTests {

    @Test(arguments: [
        ("google.de", "www.google.de", true, true),
        ("www.google.de", "google.de", true, true),
        ("maps.google.de", "www.google.de", false, true),
        ("maps.google.de", "www.google.de", true, false),
        ("www.google.de.evil.example", "google.de", false, false),
        ("evilgoogle.de", "google.de", false, false),
    ])
    func websiteHostAllowList(host: String, allowedHost: String, blockSubdomains: Bool, expected: Bool) {
        #expect(WebViewBoxPlugin.isWebsiteHostAllowed(host, allowedHost: allowedHost, blockSubdomains: blockSubdomains) == expected)
    }

    // Query parameters must never influence the host decision: only URL.host counts.
    @Test(arguments: [
        ("https://www.google.de/search?q=evil.example", true),
        ("https://www.google.de/?redirect=https://evil.example", true),
        ("https://evil.example/?redirect=https://www.google.de", false),
        ("https://evil.example/search?q=google.de", false),
        ("https://evil.example/?host=www.google.de&url=https%3A%2F%2Fgoogle.de", false),
        ("https://google.de@evil.example/", false),
        ("https://evil.example/%2F..%2F?fake=google.de", false),
    ])
    func websiteHostIgnoresMaliciousQueryParameters(urlString: String, expected: Bool) throws {
        let host = try #require(URL(string: urlString)?.host?.lowercased())
        #expect(WebViewBoxPlugin.isWebsiteHostAllowed(host, allowedHost: "www.google.de", blockSubdomains: false) == expected)
    }
}
