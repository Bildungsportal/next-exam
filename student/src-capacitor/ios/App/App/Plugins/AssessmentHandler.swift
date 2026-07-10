import Foundation
import Capacitor
import AutomaticAssessmentConfiguration

@objc(AssessmentHandler)
public class AssessmentHandler: CAPPlugin, CAPBridgedPlugin {
    public let identifier      = "AssessmentPlugin"
    public let jsName          = "assessment"
    public let pluginMethods: [CAPPluginMethod] = []

    private var assessmentSession: AEAssessmentSession?
    private var pendingCall: CAPPluginCall?
    private var lockedState: Bool = false
    private var startContinuation: CheckedContinuation<Bool, Never>?
    private var endContinuation: CheckedContinuation<Void, Never>?

    public override func load() {
        CommunicationHandler.shared.initialize(assessmentHandler: self)

        /*IPCBridge.shared.handle("assessmentStart") { [weak self] _ throws in
            guard let self else { throw PluginError.notInitialized }
            return self.startSession()
        }

        IPCBridge.shared.handle("assessmentEnd") { [weak self] _ throws in
            guard let self else { throw PluginError.notInitialized }
            return self.endSession()
        }*/
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 13.4, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    /// Starts assessment lock. Returns true when locked, false if declined/failed.
    func startSession() async -> Bool {
        #if targetEnvironment(simulator)
        log(.info, "assessmenthandler @ start session skipped (simulator)")
        lockedState = true
        return true
        #else
        if assessmentSession != nil {
            log(.info, "assessmenthandler @ start session deferred (waiting for previous session to end)")
            await endSession()
        }

        return await withCheckedContinuation { continuation in
            self.startContinuation = continuation
            log(.info, "assessmenthandler @ start session")
            let config = AEAssessmentConfiguration()
            config.allowsSpellCheck = false
            config.allowsDictation = false
            config.allowsPredictiveKeyboard = false
            config.allowsAccessibilitySpeech = false

            self.assessmentSession = AEAssessmentSession(configuration: config)
            self.assessmentSession?.delegate = self
            self.assessmentSession?.begin()
        }
        #endif
    }

    /// Ends assessment lock. Returns when the session is fully torn down.
    func endSession() async {
        #if targetEnvironment(simulator)
        log(.info, "assessmenthandler @ end session skipped (simulator)")
        lockedState = false
        return
        #else
        guard assessmentSession != nil else { return }
        log(.info, "assessmenthandler @ end session")
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            self.endContinuation = continuation
            self.assessmentSession?.end()
        }
        #endif
    }
    
    @objc func isLocked() -> Bool {
        return self.lockedState
    }
}

// MARK: - AEAssessmentSessionDelegate
@available(iOS 13.4, *)
extension AssessmentHandler: AEAssessmentSessionDelegate {

    public func assessmentSessionDidBegin(_ session: AEAssessmentSession) {
        lockedState = true
        startContinuation?.resume(returning: true)
        startContinuation = nil
        pendingCall?.resolve()
        pendingCall = nil
        notifyListeners("sessionDidBegin", data: [:])
    }

    public func assessmentSession(
        _ session: AEAssessmentSession,
        failedToBeginWithError error: Error
    ) {
        log(.error, "assessmenthandler @ failed to begin: \(error.localizedDescription)")
        assessmentSession = nil
        lockedState = false
        startContinuation?.resume(returning: false)
        startContinuation = nil
        pendingCall?.reject(error.localizedDescription, nil, error as NSError)
        pendingCall = nil
    }

    public func assessmentSession(
        _ session: AEAssessmentSession,
        wasInterruptedWithError error: Error
    ) {
        // Session was interrupted (e.g. user switched apps — not possible in assessment)
        notifyListeners("sessionInterrupted", data: [
            "error": error.localizedDescription
        ])
    }

    public func assessmentSessionDidEnd(_ session: AEAssessmentSession) {
        assessmentSession = nil
        lockedState = false
        // If startSession was awaiting, it failed (session ended before begin completed)
        startContinuation?.resume(returning: false)
        startContinuation = nil
        endContinuation?.resume()
        endContinuation = nil
        notifyListeners("sessionDidEnd", data: [:])
    }
    
    private enum LogLevel { case debug, info, warn, error }

    private func log(_ level: LogLevel, _ message: String) {
        let tag: String
        switch level {
        case .debug:  tag = "[DEBUG] "
        case .info:  tag = "[INFO] "
        case .warn:  tag = "[WARN] "
        case .error: tag = "[ERROR]"
        }
        print("AssessmentHandler \(tag) \(message)")
    }
}
