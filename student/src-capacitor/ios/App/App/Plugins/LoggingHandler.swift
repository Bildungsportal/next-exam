import Foundation
import Capacitor

/// Capacitor plugin — writes to console + Documents/next-exam-student.log.
@objc(LoggingHandler)
public class LoggingHandler: CAPPlugin, CAPBridgedPlugin {

    public let identifier      = "LoggingHandler"
    public let jsName          = "LoggingHandler"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "debug", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "info",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "warn",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "error", returnType: CAPPluginReturnPromise),
    ]

    private let queue = DispatchQueue(label: "com.nextexam.logging", qos: .utility)
    private var fileHandle: FileHandle?
    private let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    enum Level: String {
        case debug = "debug"
        case info  = "info"
        case warn  = "warn"
        case error = "error"
    }

    public override func load() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let logFile = docs.appendingPathComponent("next-exam-student.log")

        if !FileManager.default.fileExists(atPath: logFile.path) {
            FileManager.default.createFile(atPath: logFile.path, contents: nil)
        }

        fileHandle = try? FileHandle(forWritingTo: logFile)
        fileHandle?.seekToEndOfFile()
    }

    // MARK: - JS-callable methods

    @objc func debug(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        log(.debug, message)
        call.resolve()
    }

    @objc func info(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        log(.info, message)
        call.resolve()
    }

    @objc func warn(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        log(.warn, message)
        call.resolve()
    }

    @objc func error(_ call: CAPPluginCall) {
        let message = call.getString("message") ?? ""
        log(.error, message)
        call.resolve()
    }

    // MARK: - Swift-callable instance API

    static weak var shared: LoggingHandler?

    func debug(_ message: String) { log(.debug, message) }
    func info(_ message: String)  { log(.info, message) }
    func warn(_ message: String)  { log(.warn, message) }
    func error(_ message: String) { log(.error, message) }

    // MARK: - Internal

    private func log(_ level: Level, _ message: String) {
        let timestamp = dateFormatter.string(from: Date())
        let line = "\(timestamp) [\(level.rawValue)] \(message)"

        print(line)

        queue.async { [weak self] in
            guard let data = (line + "\n").data(using: .utf8) else { return }
            self?.fileHandle?.write(data)
        }
    }
}
