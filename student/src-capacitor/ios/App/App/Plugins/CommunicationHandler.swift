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

    private weak var multicastClient: MulticastClient?
    private weak var assessmentHandler: AssessmentHandler?

    // MARK: - State

    private var updateScheduler: SchedulerService?
    private var timer: Int = 0
    private var _startExamRunning: Bool = false
    private var localVmStartState: String = "idle"

    private lazy var urlSession: URLSession = {
        let delegate = LocalNetworkSessionDelegate()
        return URLSession(
            configuration: .default,
            delegate: delegate,
            delegateQueue: nil
        )
    }()

    // MARK: - Public API

    func initialize(multicastClient: MulticastClient) {
        self.multicastClient = multicastClient
        updateScheduler?.stop()
        updateScheduler = SchedulerService(
            action: { [weak self] in await self?.requestUpdate() },
            intervalMs: 5_000
        )
        updateScheduler?.start()
    }
    
    func initialize(assessmentHandler: AssessmentHandler) {
        self.assessmentHandler = assessmentHandler
    }

    deinit {
        updateScheduler?.stop()
    }

    // MARK: - Heartbeat Loop

    func requestUpdate() async {
        //log(.info, "communicationhandler @ requestUpdate: Starting to request update")

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

                let status = updateDto.status
                //log(.info, "communicationhandler @ update recieved")
                
                if status == "error" {
                    let message = updateDto.message

                    if message == "notavailable" {
                        self.log(.warn, "communicationhandler @ requestUpdate: Exam Instance not found!")
                        mc.beaconsLost = 5
                    } else if message == "removed" {
                        self.log(.warn, "communicationhandler @ requestUpdate: Student registration not found!")
                        await self.kickStudent()
                    } else {
                        self.log(.warn, "communicationhandler @ requestUpdate: \(mc.beaconsLost) Heartbeat lost..")
                        mc.beaconsLost += 1
                    }

                } else if status == "success" {
                    mc.beaconsLost = 0
                    mc.clientinfo.printrequest = false
                    await self.processUpdatedServerstatus(serverstatus: updateDto.serverstatus!, studentstatus: updateDto.studentstatus!)
                } else {
                    log(.error, "communicationhandler @ unknown status \(status)")
                }

            } catch {
                mc.beaconsLost += 1
                self.log(.error, "communicationhandler @ requestUpdate: (\(mc.beaconsLost)) \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Server Status Processing

    private func processUpdatedServerstatus(serverstatus: ServerStatus, studentstatus: StudentStatus) async {
        //log(.info, "communicationhandler @ processUpdatedServerstatus")
        guard let mc = multicastClient else { return }
        mc.serverstatus = serverstatus

        let kicked = await handleStudentStatusUpdates(studentstatus: studentstatus, mc: mc)
        if kicked { return }

        await handleExamSections(serverstatus: serverstatus)
        await handleGlobalServerStatus(serverstatus: serverstatus)
    }

    /// Processes per-student commands from the teacher (kick).
    /// Returns true when the student was kicked (caller must stop processing).
    private func handleStudentStatusUpdates(studentstatus: StudentStatus, mc: MulticastClient) async -> Bool {
        if studentstatus.kicked == true {
            await kickStudent()
            return true
        }
        return false
    }
    
    private func handleExamSections(serverstatus: ServerStatus) async {
        guard let mc = multicastClient else { return }

        // Server-forced section switch (only when student may not switch freely)
        if serverstatus.exammode && mc.clientinfo.exammode {
            if serverstatus.useExamSections && !serverstatus.allowSectionSwitch {
                if serverstatus.lockedSection != mc.clientinfo.lockedSection {
                    await switchExamSection(multicastClient: mc, serverstatus: serverstatus, newSectionNumber: serverstatus.lockedSection)
                    await startExam(serverstatus)
                }
            }
        }

        // Group assignment
        let sectionForSync = serverstatus.allowSectionSwitch ? mc.clientinfo.lockedSection : serverstatus.lockedSection
        if let section = serverstatus.examSections[sectionForSync] {
            if section.groups {
                mc.clientinfo.groups = true
                let clientname = mc.clientinfo.name
                let prevGroup = mc.clientinfo.group
                if section.groupB.users.contains(clientname) {
                    mc.clientinfo.group = "b"
                } else {
                    mc.clientinfo.group = "a"
                }
                if mc.clientinfo.group != prevGroup {
                    IPCBridge.shared.send("getmaterials")
                }
            } else {
                mc.clientinfo.groups = false
            }
        }
    }

    /// Handles screenshot interval changes, and exam start/end transitions.
    private func handleGlobalServerStatus(serverstatus: ServerStatus) async {
        //log(.info, "communicationhandler @ handleGlobalServerStatus")
        guard let mc = multicastClient else { return }
        
        // MARK: - Screenlock
        /*if serverstatus.screenslocked && !mc.clientinfo.screenlock {
            activateScreenlock()
        } else if !serverstatus.screenslocked {
            killScreenlock()
        }*/

        // MARK: - Screenshot Interval
        // JS: `|| === 0` pattern ensures 0 is treated as a valid value, hence Optional in Swift
        let screenshotinterval = serverstatus.screenshotinterval
        let intervalMs = Int(screenshotinterval)! * 1000
        if mc.clientinfo.screenshotinterval != intervalMs {
            log(.info, "communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to \(intervalMs)")
            mc.clientinfo.screenshotinterval = intervalMs

            if intervalMs == 0 {
                log(.info, "communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!")
            }

            ScreenshotHandler.shared.applyConfig(intervalMs: intervalMs)
        }

        // MARK: - Exam Mode
        if serverstatus.exammode && !mc.clientinfo.exammode {
            let lockedSection = serverstatus.lockedSection
            let examtype = serverstatus.examSections[lockedSection]?.examtype

            if _startExamRunning {
                log(.info, "communicationhandler @ processUpdatedServerstatus: startExam already running, skip duplicate")
                return
            }
            if examtype == "localvm" && localVmStartState != "idle" {
                log(.info, "communicationhandler @ processUpdatedServerstatus: localvm start suppressed (state=\(localVmStartState))")
                return
            }

            log(.info, "communicationhandler @ processUpdatedServerstatus: exammode activated")
            //killScreenlock()
            await startExam(serverstatus)

        } else if !serverstatus.exammode && mc.clientinfo.exammode {
            log(.info, "communicationhandler @ processUpdatedServerstatus: exammode deactivated")
            //killScreenlock()
            await endExam()
        }

        // MARK: - Local VM State Cleanup
        if !serverstatus.exammode && mc.clientinfo.examtype == "localvm" {
            let st = mc.clientinfo.localVMState
            let keepFixUi = st == "missing" || st == "hash_mismatch" || st == "error"

            if !keepFixUi, let currentState = st {
                log(.info, "communicationhandler @ processUpdatedServerstatus: localvm exammode off -> clearing transient vm state (\(currentState))")
                mc.clientinfo.localVMState = nil
                mc.clientinfo.localVMHost = nil
            }

            if localVmStartState != "idle" {
                localVmStartState = "idle"
            }
        }
    }


    /// Starts exam mode: determines section/type, begins assessment lockdown, notifies renderer.
    private func startExam(_ serverstatus: ServerStatus) async {
        log(.info, "communicationhandler @ startExam: starting exam")
        if _startExamRunning {
            log(.info, "communicationhandler @ startExam: already running, skip duplicate")
            return
        }
        _startExamRunning = true
        defer { _startExamRunning = false }

        guard let mc = multicastClient else { return }

        // When allowSectionSwitch: client chooses section; do not overwrite with server value
        if !serverstatus.allowSectionSwitch || mc.clientinfo.lockedSection == 0 {
            mc.clientinfo.lockedSection = serverstatus.lockedSection
        }
        let effectiveSection = mc.clientinfo.lockedSection

        guard let section = serverstatus.examSections[effectiveSection] else {
            log(.error, "communicationhandler @ startExam: no exam section for index \(effectiveSection)")
            return
        }
        let examtype = section.examtype

        // LocalVM not supported on iOS
        if examtype == "localvm" {
            log(.warn, "communicationhandler @ startExam: localvm examtype not supported on iOS")
            return
        }

        if !mc.clientinfo.exammode {
            // First start — begin assessment lockdown
            if assessmentHandler?.isLocked() == false {
                let locked = await assessmentHandler?.startSession() ?? false
                if !locked {
                    log(.warn, "communicationhandler @ startExam: assessment mode declined or failed")
                    return
                }
            }
            mc.clientinfo.exammode = true
            mc.clientinfo.examtype = examtype
            log(.info, "communicationhandler @ startExam: creating exam view (type=\(examtype))")
        } else {
            // Reconnect / section switch — exam view already active
            log(.info, "communicationhandler @ startExam: reconnecting into active exam session")
        }

        IPCBridge.shared.send("startExam", serverstatus.asDictionary)
    }

    /// Tears down exam mode and notifies the renderer.
    private func endExam() async {
        guard let mc = multicastClient else { return }
        mc.clientinfo.exammode      = false
        mc.clientinfo.localLockdown = false
        log(.info, "communicationhandler @ endExam: ending exam")
        IPCBridge.shared.send("endExam")
        await assessmentHandler?.endSession()
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

    private func kickStudent() async {
        guard let mc = multicastClient else { return }
        log(.warn, "communicationhandler @ kickStudent: Student got kicked by Teacher")
        mc.kicked = false
        mc.beaconsLost = 0
        await endExam()
        resetConnection()
    }

    // MARK: - Logging

    private enum LogLevel { case debug, info, warn, error }

    private func log(_ level: LogLevel, _ message: String) {
        let tag: String
        switch level {
        case .debug:  tag = "[DEBUG] "
        case .info:  tag = "[INFO] "
        case .warn:  tag = "[WARN] "
        case .error: tag = "[ERROR]"
        }
        print("CommunicationHandler \(tag) \(message)")
    }
}
