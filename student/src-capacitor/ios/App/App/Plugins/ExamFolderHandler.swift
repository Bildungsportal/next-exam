import Foundation
import Capacitor

/// Lists and deletes stored exam folders under Documents (the per-exam "servername-pin" directories).
/// Deletion removes the whole folder natively, so both Capacitor-created and natively written files go away.
///
/// Before exams stored their files inside the pin folder, renderer-written exam files (backups, PDFs, …)
/// landed flat in Documents. Such legacy leftovers are attributed to the most recently created old-exam
/// folder so the dialog shows real sizes/dates and deletion reclaims them too.
final class ExamFolderHandler {
    static let shared = ExamFolderHandler()
    private init() {}

    private let log = LoggingHandler.shared

    /// File types the iOS exam editor/listener writes (same set as IosExamFileService.getFilesAsync).
    private static let legacyFlatExtensions: Set<String> = [
        ".htm", ".pdf", ".ggb", ".docx", ".odt",
        ".sb2", ".sb3", ".mp3", ".ogg", ".wav",
        ".jpg", ".png", ".gif",
    ]

    private static var weekAgoEpoch: Int { Int(Date().addingTimeInterval(-7 * 24 * 60 * 60).timeIntervalSince1970) }

    func register() {
        IPCBridge.shared.handle("list-exam-folders") { [weak self] _ async throws -> Any? in
            guard let self else { throw IPCError.noHandler("list-exam-folders: not initialized") }
            return self.listFolders()
        }
        IPCBridge.shared.handle("delete-exam-folders") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("delete-exam-folders: not initialized") }
            return self.deleteFolders(payload: payload)
        }
    }

    // MARK: - Listing

    /// Documents/<servername>-<pin> folders (excluding the current exam dir and anything touched within the
    /// last week), with size and last-interaction date. Legacy flat leftovers are counted towards the newest
    /// old-exam folder; folders without any data are omitted so the dialog never shows a bare 0B / 1970 row.
    private func listFolders() -> [Any] {
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return [] }
        let currentName = URL(fileURLWithPath: Config.examdirectory).lastPathComponent
        let contents = (try? FileManager.default.contentsOfDirectory(at: docs, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])) ?? []
        var folders: [(name: String, url: URL)] = []
        for url in contents {
            guard url.hasDirectoryPath else { continue }
            let name = url.lastPathComponent
            guard Self.isExamFolder(name), name != currentName else { continue }
            folders.append((name, url))
        }

        let flat = Self.legacyFlatFiles(in: docs)
        var entries: [[String: Any]] = folders.map { name, url in
            let modified = Int(Self.newestModificationDate(url)?.timeIntervalSince1970 ?? 0)
            return ["name": name, "size": Self.folderSize(url), "modified": modified, "deletable": false]
        }

        // Legacy leftovers belong to the most recently created old-exam folder.
        if !flat.isEmpty,
           let newest = folders.max(by: { Self.creationDate($0.url) ?? Date.distantPast < Self.creationDate($1.url) ?? Date.distantPast }),
           let idx = entries.firstIndex(where: { ($0["name"] as? String) == newest.name }) {
            var entry = entries[idx]
            entry["size"] = (entry["size"] as? Int64 ?? 0) + flat.reduce(0) { $0 + $1.size }
            let flatModified = flat.map(\.modified).max() ?? 0
            if flatModified > (entry["modified"] as? Int ?? 0) { entry["modified"] = flatModified }
            entries[idx] = entry
        }

        return entries
            .filter { ($0["size"] as? Int64 ?? 0) > 0 || ($0["modified"] as? Int ?? 0) > 0 }
            .sorted { (($0["modified"] as? Int) ?? 0) > (($1["modified"] as? Int) ?? 0) }
            .map { entry -> [String: Any] in
                var e = entry
                let modified = e["modified"] as? Int ?? 0
                e["deletable"] = modified > 0 && modified < Self.weekAgoEpoch
                return e
            }
    }

    // MARK: - Deletion

    /// Deletes the named exam folders; each name is re-validated against traversal, the current exam dir and
    /// the one-week age guard. Legacy flat leftovers owned by the deleted folder are removed as well.
    private func deleteFolders(payload: Any?) -> [String: Any] {
        var names: [String] = []
        if let array = payload as? [[String: Any]], !array.isEmpty, let n = array[0]["names"] as? [String] {
            names = n
        } else if let dict = payload as? [String: Any], let n = dict["names"] as? [String] {
            names = n
        }
        guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            return ["status": "error", "message": "Documents unreadable"]
        }
        let currentName = URL(fileURLWithPath: Config.examdirectory).lastPathComponent
        let contents = (try? FileManager.default.contentsOfDirectory(at: docs, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])) ?? []
        var folderURLs: [String: URL] = [:]
        for url in contents where url.hasDirectoryPath {
            let name = url.lastPathComponent
            if Self.isExamFolder(name), name != currentName { folderURLs[name] = url }
        }
        let flat = Self.legacyFlatFiles(in: docs)
        let attributionName: String? = !flat.isEmpty
            ? folderURLs.max(by: { Self.creationDate($0.value) ?? Date.distantPast < Self.creationDate($1.value) ?? Date.distantPast })?.key
            : nil

        var deleted: [String] = []
        var errors: [String] = []
        for name in names {
            guard Self.isExamFolder(name), !name.contains("/"), name != currentName else {
                errors.append(name)
                continue
            }
            guard let target = folderURLs[name] else {
                errors.append(name)
                continue
            }
            var modified = Int(Self.newestModificationDate(target)?.timeIntervalSince1970 ?? 0)
            if name == attributionName {
                if let flatModified = flat.map(\.modified).max(), flatModified > modified { modified = flatModified }
            }
            guard modified > 0, modified < Self.weekAgoEpoch else {
                log?.warn("examfolderhandler @ delete: \(name) is too recent to delete")
                errors.append(name)
                continue
            }
            do {
                try FileManager.default.removeItem(at: target)
                deleted.append(name)
            } catch {
                log?.error("examfolderhandler @ delete: can not remove \(name) - \(error.localizedDescription)")
                errors.append(name)
                continue
            }
            if name == attributionName {
                for file in flat where file.modified > 0 && file.modified < Self.weekAgoEpoch {
                    try? FileManager.default.removeItem(at: file.url)
                }
            }
        }
        return errors.isEmpty ? ["status": "success", "deleted": deleted, "errors": []] : ["status": "error", "deleted": deleted, "errors": errors]
    }

    // MARK: - Helpers

    /// Exam folders use the "servername-pin" convention (e.g. 192.168.1.10-1234); local-exam has no trailing pin.
    private static func isExamFolder(_ name: String) -> Bool {
        guard !name.isEmpty, name != "local-exam" else { return false }
        return name.range(of: #"^.+-\d+$"#, options: .regularExpression) != nil
    }

    private static func creationDate(_ url: URL) -> Date? {
        (try? url.resourceValues(forKeys: [.creationDateKey]))?.creationDate
    }

    private static func folderSize(_ url: URL) -> Int64 {
        guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey], options: []) else { return 0 }
        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            guard let values = try? fileURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                  values.isRegularFile == true else { continue }
            total += Int64(values.fileSize ?? 0)
        }
        return total
    }

    /// Newest content modification date under the folder (approximates when the exam was last touched).
    private static func newestModificationDate(_ url: URL) -> Date? {
        guard let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: [.contentModificationDateKey], options: []) else { return nil }
        var newest: Date?
        for case let fileURL as URL in enumerator {
            guard let date = (try? fileURL.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate else { continue }
            if newest == nil || date > newest! { newest = date }
        }
        return newest
    }

    /// Exam files left flat in Documents by exams that ran before the per-exam folder layout existed.
    private static func legacyFlatFiles(in docs: URL) -> [(url: URL, size: Int64, modified: Int)] {
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: docs,
            includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        var result: [(URL, Int64, Int)] = []
        for url in contents {
            guard !url.hasDirectoryPath else { continue }
            guard legacyFlatExtensions.contains("." + url.pathExtension.lowercased()) else { continue }
            guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]),
                  values.isRegularFile == true else { continue }
            result.append((url, Int64(values.fileSize ?? 0), Int(values.contentModificationDate?.timeIntervalSince1970 ?? 0)))
        }
        return result
    }
}
