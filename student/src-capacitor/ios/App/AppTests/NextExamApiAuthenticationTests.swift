//
//  AppTests.swift
//  AppTests
//
//  Created by Lukas Rolle on 21.08.26.
//

import CryptoKit
import Foundation
import Testing
@testable import App

struct NextExamApiAuthenticationTests {

    /// Creates the expected proof for a fixed timestamp.
    @Test func headersContainTimestampAndHmac() {
        let timestamp = "1720000000000"
        let key = SymmetricKey(data: Data("NEXT-EXAM".utf8))
        let mac = HMAC<SHA256>.authenticationCode(for: Data(timestamp.utf8), using: key)

        #expect(NextExamApiAuthentication.headers(timestamp: timestamp) == [
            "x-next-exam-app-ts": timestamp,
            "x-next-exam-app-mac": Data(mac).base64EncodedString(),
        ])
    }
}
