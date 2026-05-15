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

                guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    mc.beaconsLost += 1
                    return
                }

                let status = json["status"] as? String

                if status == "error" {
                    let message = json["message"] as? String ?? ""

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

                    if let serverstatus = json["serverstatus"] as? [String: Any] {
                        mc.serverstatus = serverstatus
                    }

                    // TODO: processUpdatedServerstatus(serverstatus, studentstatus)
                }

            } catch {
                mc.beaconsLost += 1
                self.log(.error, "communicationhandler @ requestUpdate: (\(mc.beaconsLost)) \(error.localizedDescription)")
            }
        }
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
        // TODO: endExam(serverstatus) — stop exam mode and clean up
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
