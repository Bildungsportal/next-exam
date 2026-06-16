import Foundation

/// Handles periodic heartbeat communication with the teacher server.
///
/// Mirrors `src-electron/main/scripts/communicationhandler.js`.
/// Periodically POSTs `clientinfo` to the server's `/server/control/update`
/// endpoint and reacts to the response (connection loss, kick, status updates).
final class CommunicationHandler {

    static let shared = CommunicationHandler()
    private init() {}

    // MARK: - Dependencies

    private weak var multicastClient: MulticastClientPlugin?

    // MARK: - State

    private var updateScheduler: SchedulerService?
    private var timer: Int = 0

    private lazy var urlSession: URLSession = {
        let delegate = LocalNetworkSessionDelegate()
        return URLSession(
            configuration: .default,
            delegate: delegate,
            delegateQueue: nil
        )
    }()

    // MARK: - Public API

    func initialize(multicastClient: MulticastClientPlugin) {
        self.multicastClient = multicastClient
        updateScheduler?.stop()
        updateScheduler = SchedulerService(
            action: { [weak self] in self?.requestUpdate() },
            intervalMs: 5_000
        )
        updateScheduler?.start()
    }
    
    deinit {
        updateScheduler?.stop()
    }

    // MARK: - Heartbeat Loop

    func requestUpdate() {
        guard let mc = multicastClient else { return }

        timer += 1

        // Every 20 × 5 s = 100 s — placeholder for platform-specific periodic checks.
        // JS checks for remote-assistance and block-windows here; not applicable on iOS.
        if timer % 20 == 0 {
            // TODO: iOS-specific periodic checks (if any)
        }

        if mc.clientinfo.localLockdown { return }

        // Connection lost — no server signal for 5 consecutive cycles (25 s)
        if mc.beaconsLost >= 5 {
            if !mc.kicked {
                log(.warn, "communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.")
                mc.beaconsLost = 0
                resetConnection()
            }
        }

        guard let serverip = mc.clientinfo.serverip, !serverip.isEmpty else {
            // Not connected — prevent focus-warning deadlock
            mc.clientinfo.focus = true
            return
        }

        // Build POST payload
        let payload: [String: Any] = ["clientinfo": mc.clientinfo.asDictionary]

        guard let url = URL(string: "https://\(serverip):\(Config.serverApiPort)/server/control/update") else {
            log(.error, "communicationhandler @ requestUpdate: Invalid URL")
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("NEXT_EXAM_API_SECRET", forHTTPHeaderField: "x-next-exam-app-secret")
        request.setValue("Bearer "+(self.multicastClient?.clientinfo.token ?? ""), forHTTPHeaderField: "Authorization")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            log(.error, "communicationhandler @ requestUpdate: JSON serialization failed – \(error.localizedDescription)")
            return
        }

        Task { [weak self, weak mc] in
            guard let self, let mc else { return }

            do {
                let (data, _) = try await self.urlSession.data(for: request)
                
                //print("multicastclient @ messageReceived: ", String(data: data, encoding: .utf8) ?? "Unable to decode data as UTF-8")

                /*guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    mc.beaconsLost += 1
                    return
                }*/
                
                let updateDto: Update
                do {
                    updateDto = try JSONDecoder().decode(Update.self, from: data)
                } catch let DecodingError.keyNotFound(key, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log(.error, "multicastclient @ messageReceived: missing key '\(key.stringValue)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.typeMismatch(type, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log(.error, "multicastclient @ messageReceived: type mismatch for type '\(type)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.valueNotFound(type, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log(.error, "multicastclient @ messageReceived: value not found for type '\(type)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.dataCorrupted(context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log(.error, "multicastclient @ messageReceived: data corrupted at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch {
                    log(.error, "multicastclient @ messageReceived: JSON decode failed – \(error)")
                    mc.beaconsLost += 1
                    return
                }
                
                IPCBridge.shared.send("updateReceived", updateDto.asDictionary)

                let status = updateDto.status

                if status == "error" {
                    let message = updateDto.message

                    if message == "notavailable" {
                        self.log(.warn, "communicationhandler @ requestUpdate: Exam Instance not found!")
                        mc.beaconsLost = 5
                    } else if message == "removed" {
                        self.log(.warn, "communicationhandler @ requestUpdate: Student registration not found!")
                        self.kickStudent()
                    } else {
                        self.log(.warn, "communicationhandler @ requestUpdate: \(mc.beaconsLost) Heartbeat lost..")
                        mc.beaconsLost += 1
                    }

                } else if status == "success" {
                    mc.beaconsLost = 0
                    mc.clientinfo.printrequest = false
                    self.processUpdatedServerstatus(serverstatus: updateDto.serverstatus!)
                }

            } catch {
                mc.beaconsLost += 1
                self.log(.error, "communicationhandler @ requestUpdate: (\(mc.beaconsLost)) \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Server Status Processing

    private func processUpdatedServerstatus(serverstatus: ServerStatus) {
        guard let mc = multicastClient else { return }
        mc.serverstatus = serverstatus

        let kicked = handleStudentStatusUpdates(serverstatus: serverstatus, mc: mc)
        if kicked { return }

        handleGlobalServerStatus(serverstatus: serverstatus, mc: mc)
    }

    /// Processes per-student commands from the teacher (kick).
    /// Returns true when the student was kicked (caller must stop processing).
    private func handleStudentStatusUpdates(serverstatus: ServerStatus, mc: MulticastClientPlugin) -> Bool {
        // TODO: add other studentstatus updates other than kicked
        if mc.kicked {
            kickStudent()
            return true
        }
        return false
    }

    /// Handles screenshot interval changes, and exam start/end transitions.
    private func handleGlobalServerStatus(serverstatus: ServerStatus, mc: MulticastClientPlugin) {

        // Exam end
        if !serverstatus.exammode && mc.clientinfo.exammode {
            log(.info, "communicationhandler @ handleGlobalServerStatus: exammode deactivated")
            endExam(mc: mc)
        }
    }


    /// Tears down exam mode and notifies the renderer.
    private func endExam(mc: MulticastClientPlugin) {
        mc.clientinfo.exammode      = false
        mc.clientinfo.localLockdown = false
        log(.info, "communicationhandler @ endExam: ending exam")
        IPCBridge.shared.send("endExam")
    }

    // MARK: - Connection Management

    private func resetConnection() {
        guard let mc = multicastClient else { return }
        mc.clientinfo.token         = nil
        mc.clientinfo.ip            = nil
        mc.clientinfo.serverip      = nil
        mc.clientinfo.servername    = nil
        mc.clientinfo.focus         = true
        mc.clientinfo.timestamp     = nil
        mc.clientinfo.localLockdown = false
    }

    private func kickStudent() {
        guard let mc = multicastClient else { return }
        log(.warn, "communicationhandler @ kickStudent: Student got kicked by Teacher")
        mc.kicked = false
        mc.beaconsLost = 0
        endExam(mc: mc)
        resetConnection()
    }

    // MARK: - Logging

    private enum LogLevel { case info, warn, error }

    private func log(_ level: LogLevel, _ message: String) {
        let tag: String
        switch level {
        case .info:  tag = "[INFO] "
        case .warn:  tag = "[WARN] "
        case .error: tag = "[ERROR]"
        }
        print("CommunicationHandler \(tag) \(message)")
    }
}
