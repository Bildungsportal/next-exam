import Foundation
import Capacitor

/// Streams the exam directory to the teacher as per-file JSON uploads (no ZIP, no base64 bridge round-trip).
/// iOS counterpart of the Electron ZIP submission (communicationhandler.js zipDirectory) — the teacher
/// `/server/data/receive/:servername` endpoint accepts `files: [{path, file}]` with a client-chosen
/// `submission` archive folder. Each file is read and POSTed natively, so peak memory stays at a single
/// file instead of the whole exam (fixes native OOM abort on large submissions).
final class ExamSubmissionHandler {
    static let shared = ExamSubmissionHandler()
    private init() {}

    private lazy var urlSession: URLSession = {
        let delegate = LocalNetworkSessionDelegate()
        return URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
    }()

    private let log = LoggingHandler.shared

    func register() {
        IPCBridge.shared.handle("exam-submit") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("exam-submit: not initialized") }
            return try await self.submit(payload: payload)
        }
    }

    /// Uploads every file under the exam directory, one request at a time.
    private func submit(payload: Any?) async throws -> [String: Any] {
        var args: [String: Any]?
        if let array = payload as? [[String: Any]], !array.isEmpty {
            args = array[0]
        } else if let dict = payload as? [String: Any] {
            args = dict
        }
        guard
            let args,
            let examdir = args["examdirectory"] as? String, !examdir.isEmpty,
            let serverip = args["serverip"] as? String, !serverip.isEmpty,
            let servername = args["servername"] as? String, !servername.isEmpty,
            let token = args["token"] as? String, !token.isEmpty
        else {
            return ["status": "error", "message": "Missing required arguments"]
        }
        let port = (args["port"] as? NSNumber)?.intValue ?? Config.serverApiPort
        let reason = (args["lastExamWriteSaveReason"] as? String) ?? "n/a"
        // Same archive-folder convention as the teacher ZIP path (YYYYMMDD_HH_MM_SS local time).
        let submissionFolder = Self.submissionFolderName()

        let rootURL = URL(fileURLWithPath: examdir)
        guard FileManager.default.fileExists(atPath: rootURL.path),
              let enumerator = FileManager.default.enumerator(at: rootURL, includingPropertiesForKeys: [.isRegularFileKey], options: [])
        else {
            return ["status": "error", "message": "exam directory unreadable"]
        }

        var errors: [String] = []
        var uploaded = 0
        var fileURLs: [URL] = []
        while let object = enumerator.nextObject(), let fileURL = object as? URL {
            fileURLs.append(fileURL)
        }
        for fileURL in fileURLs {
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDirectory), !isDirectory.boolValue else { continue }
            guard let data = try? Data(contentsOf: fileURL) else {
                errors.append("unreadable: \(fileURL.lastPathComponent)")
                continue
            }
            let relPath = String(fileURL.path.dropFirst(rootURL.path.count + 1))
            let ok = await self.upload(file: data, relPath: relPath, serverip: serverip, servername: servername, port: port, token: token, reason: reason, submission: submissionFolder)
            if ok {
                uploaded += 1
            } else {
                errors.append(relPath)
            }
        }

        log?.info("examsubmission @ submit: uploaded \(uploaded)/\(uploaded + errors.count) files to \(servername)")
        if !errors.isEmpty {
            return ["status": "error", "message": "Failed to upload \(errors.count) file(s)", "files": uploaded, "errors": errors]
        }
        return ["status": "success", "files": uploaded, "errors": errors]
    }

    /// POSTs one file as base64 JSON to the teacher receive endpoint.
    private func upload(file: Data, relPath: String, serverip: String, servername: String, port: Int, token: String, reason: String, submission: String) async -> Bool {
        guard let url = URL(string: "https://\(serverip):\(port)/server/data/receive/\(servername)") else {
            log?.error("examsubmission @ upload: Invalid URL")
            return false
        }
        var request = URLRequest(url: url, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        NextExamApiAuthentication.apply(to: &request)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "path": relPath,
                "file": file.base64EncodedString(),
                "lastExamWriteSaveReason": reason,
                "submission": submission,
            ])
        } catch {
            log?.error("examsubmission @ upload: JSON serialization failed – \(error.localizedDescription)")
            return false
        }

        do {
            let (data, _) = try await urlSession.data(for: request)
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               (obj["status"] as? String) == "success" {
                return true
            }
            log?.error("examsubmission @ upload: teacher rejected \(relPath): \(String(data: data, encoding: .utf8) ?? "no body")")
            return false
        } catch {
            log?.error("examsubmission @ upload: \(relPath): \(error.localizedDescription)")
            return false
        }
    }

    /// Archive-folder name in the teacher's YYYYMMDD_HH_MM_SS convention (same for all files of one submission).
    private static func submissionFolderName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd_HH_mm_ss"
        formatter.locale = Locale(identifier: "de_DE")
        return formatter.string(from: Date())
    }
}
