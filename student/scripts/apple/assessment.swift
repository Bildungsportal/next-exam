import AutomaticAssessmentConfiguration
import Foundation

// Long-lived single-process AAC helper. `start` begins an AEAssessmentSession and keeps it
// alive in the run loop; SIGTERM (or EOF on stdin) ends the SAME session and exits. Begin/fail/end
// are reported as line-delimited JSON on stdout so the Electron side knows the real outcome
// (AEAssessmentSession reports asynchronously via its delegate - without one, success/failure is lost).

// Emit one JSON event line on stdout and flush immediately.
func emit(_ json: String) {
    print(json)
    fflush(stdout)
}

final class AssessmentRunner: NSObject, AEAssessmentSessionDelegate {
    private let session: AEAssessmentSession

    override init() {
        // The helper itself is the assessment's "main" app (it calls begin()) but has no window ->
        // a bare config would lock down to a blank grey screen. Permit Next-Exam-Student as an
        // additional app so the user can use the exam window during the locked session.
        // setConfiguration(_:for:) is macOS 12+. AEAssessmentApplication requires a valid signature
        // and that the app is notarized/App-Store (so Next-Exam must be notarized); pass teamIdentifier
        // for an unambiguous identity match. requiresSignatureValidation stays true (default).
        let configuration = AEAssessmentConfiguration()
        let examApp = AEAssessmentApplication(bundleIdentifier: "com.nextexam.student", teamIdentifier: "__APPLE_TEAM_ID__")
        let examAppConfig = AEAssessmentParticipantConfiguration()
        // Next-Exam needs network during the exam (teacher comms, materials); default is false.
        // Media/audio playback is NOT restricted by AAC, so no extra config for that.
        examAppConfig.allowsNetworkAccess = true
        configuration.setConfiguration(examAppConfig, for: examApp)
        session = AEAssessmentSession(configuration: configuration)
        super.init()
        session.delegate = self
    }

    func begin() {
        session.begin()
    }

    // End the active session; didEnd handler exits the process.
    func end() {
        session.end()
    }

    func assessmentSessionDidBegin(_ session: AEAssessmentSession) {
        emit("{\"event\":\"begin\"}")
    }

    func assessmentSession(_ session: AEAssessmentSession, failedToBeginWithError error: Error) {
        // generic localizedDescription ("operation couldn't be completed") is useless;
        // the real signal is the NSError domain + code (+ underlying error / failureReason).
        let ns = error as NSError
        func esc(_ s: String) -> String {
            s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
        }
        let underlying = (ns.userInfo[NSUnderlyingErrorKey] as? NSError)
            .map { "\($0.domain) code=\($0.code) \($0.localizedDescription)" } ?? ""
        let reason = ns.localizedFailureReason ?? ""
        emit("{\"event\":\"failed\",\"domain\":\"\(esc(ns.domain))\",\"code\":\(ns.code),\"error\":\"\(esc(ns.localizedDescription))\",\"reason\":\"\(esc(reason))\",\"underlying\":\"\(esc(underlying))\"}")
        // full dump to stderr for the electron-log warn channel
        FileHandle.standardError.write("assessment failedToBegin: \(ns)\n".data(using: .utf8)!)
        exit(1)
    }

    func assessmentSessionDidEnd(_ session: AEAssessmentSession) {
        emit("{\"event\":\"end\"}")
        exit(0)
    }

    func assessmentSessionWasInterrupted(_ session: AEAssessmentSession) {
        emit("{\"event\":\"interrupted\"}")
        exit(2)
    }
}

let arg = CommandLine.arguments.dropFirst().first ?? ""
guard arg == "start" else {
    // legacy `stop`/unknown: nothing to do in this process model (stop = SIGTERM to the running start process)
    exit(0)
}

let runner = AssessmentRunner()

// SIGTERM -> end the live session (graceful). Default signal handler must be ignored so the
// DispatchSource receives it instead of terminating the process.
signal(SIGTERM, SIG_IGN)
let sigterm = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
sigterm.setEventHandler { runner.end() }
sigterm.resume()

// Fallback stop trigger: parent closes stdin (EOF) -> end the session.
let stdinReader = FileHandle.standardInput
stdinReader.readabilityHandler = { handle in
    if handle.availableData.isEmpty { DispatchQueue.main.async { runner.end() } }
}

runner.begin()
RunLoop.main.run()
