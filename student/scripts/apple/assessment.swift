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
        let configuration = AEAssessmentConfiguration()
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
        let msg = error.localizedDescription
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        emit("{\"event\":\"failed\",\"error\":\"\(msg)\"}")
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
