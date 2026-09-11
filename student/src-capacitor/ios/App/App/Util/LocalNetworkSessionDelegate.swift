import Foundation
import CryptoKit
import Security

final class TeacherCertificateTrust: @unchecked Sendable {
    static let shared = TeacherCertificateTrust()
    private let lock = NSLock()
    private var hosts = Set(["localhost", "127.0.0.1", "::1"])
    private var fingerprints: [String: String] = [:]
    private var pendingFingerprints: [String: String] = [:]

    private init() {}

    /// Allow the self-signed certificate presented by a selected or discovered Teacher host.
    func allow(_ hostname: String, fingerprint: String? = nil) {
        guard !hostname.isEmpty else { return }
        let normalizedHost = hostname.lowercased()
        lock.lock()
        hosts.insert(normalizedHost)
        if let normalizedFingerprint = normalize(fingerprint) {
            let expected = fingerprints[normalizedHost]
            if expected == nil || expected == normalizedFingerprint {
                fingerprints[normalizedHost] = normalizedFingerprint
            }
        }
        lock.unlock()
    }

    /// Check whether the certificate belongs to a known Teacher host and matches its advertised fingerprint.
    func allows(_ hostname: String, serverTrust: SecTrust) -> Bool {
        let normalizedHost = hostname.lowercased()
        guard let actual = certificateFingerprint(serverTrust) else { return false }
        lock.lock()
        defer { lock.unlock() }
        guard hosts.contains(normalizedHost) else { return false }
        guard let expected = fingerprints[normalizedHost] else {
            fingerprints[normalizedHost] = actual
            return true
        }
        guard actual == expected else {
            pendingFingerprints[normalizedHost] = actual
            return false
        }
        return true
    }

    /// Accept only a certificate change previously observed during TLS validation.
    func acceptPending(_ hostname: String) -> Bool {
        let normalizedHost = hostname.lowercased()
        lock.lock()
        defer { lock.unlock() }
        guard let pending = pendingFingerprints.removeValue(forKey: normalizedHost) else { return false }
        fingerprints[normalizedHost] = pending
        return true
    }

    /// Return whether TLS validation observed a changed certificate for this Teacher.
    func hasPending(_ hostname: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return pendingFingerprints[hostname.lowercased()] != nil
    }

    /// Normalize a SHA-256 fingerprint represented as plain or colon-separated hexadecimal.
    private func normalize(_ fingerprint: String?) -> String? {
        guard let fingerprint else { return nil }
        let normalized = fingerprint.filter { $0.isHexDigit }.lowercased()
        return normalized.count == 64 ? normalized : nil
    }

    /// Calculate the SHA-256 fingerprint of the leaf certificate from a server trust challenge.
    private func certificateFingerprint(_ serverTrust: SecTrust) -> String? {
        guard let chain = SecTrustCopyCertificateChain(serverTrust) as? [SecCertificate],
              let certificate = chain.first else { return nil }
        let data = SecCertificateCopyData(certificate) as Data
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

class LocalNetworkSessionDelegate: NSObject, URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let serverTrust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        guard TeacherCertificateTrust.shared.allows(challenge.protectionSpace.host, serverTrust: serverTrust) else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let credential = URLCredential(trust: serverTrust)
        completionHandler(.useCredential, credential)
    }
}
