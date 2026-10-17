import Foundation

/// Handles periodic heartbeat communication with the teacher server.
///
/// Mirrors `src-electron/main/scripts/communicationhandler.js`.
/// Periodically POSTs `clientinfo` to the server's `/server/control/update`
/// endpoint and reacts to the response (connection loss, kick, status updates).
final class CommunicationHandler {

    static let shared = CommunicationHandler()
    private let log = LoggingHandler.shared
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
        guard let mc = multicastClient else { return }

        mc.clientinfo.isAssessmentMode = assessmentHandler?.isLocked() ?? false

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
                log?.warn("communicationhandler @ requestUpdate: Connection to Teacher lost! Removing registration.")
                let wasExam = mc.clientinfo.exammode
                let examServername = mc.clientinfo.servername
                mc.beaconsLost = 0
                resetConnection()
                if wasExam { mc.clientinfo.servername = examServername }
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
            log?.error("communicationhandler @ requestUpdate: Invalid URL")
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        NextExamApiAuthentication.apply(to: &request)
        request.setValue("Bearer "+(self.multicastClient?.clientinfo.token ?? ""), forHTTPHeaderField: "Authorization")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            log?.error("communicationhandler @ requestUpdate: JSON serialization failed – \(error.localizedDescription)")
            return
        }

        Task { [weak self, weak mc] in
            guard let self, let mc else { return }

            do {
                let (data, _) = try await self.urlSession.data(for: request)

                let updateDto: Update
                do {
                    updateDto = try JSONDecoder().decode(Update.self, from: data)
                } catch let DecodingError.keyNotFound(key, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log?.error("multicastclient @ messageReceived: missing key '\(key.stringValue)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.typeMismatch(type, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log?.error("multicastclient @ messageReceived: type mismatch for type '\(type)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.valueNotFound(type, context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log?.error("multicastclient @ messageReceived: value not found for type '\(type)' at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch let DecodingError.dataCorrupted(context) {
                    let path = context.codingPath.map { $0.stringValue }.joined(separator: " → ")
                    log?.error("multicastclient @ messageReceived: data corrupted at path '\(path)' – \(context.debugDescription)")
                    mc.beaconsLost += 1
                    return
                } catch {
                    log?.error("multicastclient @ messageReceived: JSON decode failed – \(error)")
                    mc.beaconsLost += 1
                    return
                }

                let status = updateDto.status

                if status == "error" {
                    let message = updateDto.message

                    if message == "notavailable" {
                        log?.warn("communicationhandler @ requestUpdate: Exam Instance not found!")
                        mc.beaconsLost = 5
                    } else if message == "removed" {
                        log?.warn("communicationhandler @ requestUpdate: Student registration not found!")
                        await self.kickStudent()
                    } else {
                        log?.warn("communicationhandler @ requestUpdate: \(mc.beaconsLost) Heartbeat lost..")
                        mc.beaconsLost += 1
                    }

                } else if status == "success" {
                    mc.beaconsLost = 0
                    mc.clientinfo.printrequest = false
                    await self.processUpdatedServerstatus(serverstatus: updateDto.serverstatus!, studentstatus: updateDto.studentstatus!)
                } else {
                    log?.error("communicationhandler @ unknown status \(status)")
                }

            } catch {
                mc.beaconsLost += 1
                log?.error("communicationhandler @ requestUpdate: (\(mc.beaconsLost)) \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Server Status Processing

    private func processUpdatedServerstatus(serverstatus: ServerStatus, studentstatus: StudentStatus) async {
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
            // mirror Electron communicationhandler.js kickStudent: folder is only deleted when the teacher checked the delete-folder option
            await kickStudent(deleteFolderOnExit: studentstatus.delfolder == true)
            return true
        }
        // Mirror Electron communicationhandler.js: teacher denied the student's print request.
        if studentstatus.printdenied == true && mc.clientinfo.exammode {
            IPCBridge.shared.send("denied")
        }
        if studentstatus.getmaterials == true {
            IPCBridge.shared.send("getmaterials")
        }
        if studentstatus.sendexam == true {
            IPCBridge.shared.send("sendexam")
        }
        if studentstatus.sendlog == true {
            await sendStudentLogToTeacher()
        }
        // Teacher sent files to this student (mirrors Electron communicationhandler.js requestFileFromServer).
        if studentstatus.fetchfiles == true {
            IPCBridge.shared.send("fetchfiles")
        }
        // Teacher empties the student's exam workfolder (mirrors Electron communicationhandler.js delfolder).
        if studentstatus.delfolder == true {
            log?.info("communicationhandler @ handleStudentStatusUpdates: cleaning exam workfolder")
            let dir = Config.examdirectory
            if !dir.isEmpty {
                do {
                    if FileManager.default.fileExists(atPath: dir) {
                        try FileManager.default.removeItem(atPath: dir)
                    }
                    try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                } catch {
                    log?.error("communicationhandler @ handleStudentStatusUpdates: can not clean exam workfolder - \(error.localizedDescription)")
                    if mc.clientinfo.exammode {
                        IPCBridge.shared.send("fileerror", ["message": error.localizedDescription])
                    }
                }
            }
            if mc.clientinfo.exammode {
                IPCBridge.shared.send("loadfilelist")
            }
        }
        // Mirror Electron communicationhandler.js: teacher restores focus after a security lockdown (e.g. typingRhythm)
        if studentstatus.restorefocusstate == true {
            log?.info("communicationhandler @ handleStudentStatusUpdates: restoring focus state for student")
            mc.clientinfo.focusLockReason = nil
            mc.clientinfo.focusLockMessage = nil
            mc.clientinfo.focus = true
        }
        // Mirror Electron communicationhandler.js: per-student LanguageTool spellcheck override (legasthenie).
        if studentstatus.activatePrivateSpellcheck == true && !mc.clientinfo.privateSpellcheck.activated {
            log?.info("communicationhandler @ handleStudentStatusUpdates: activating spellcheck for student")
            mc.clientinfo.privateSpellcheck.activate = true
            mc.clientinfo.privateSpellcheck.activated = true
        } else if studentstatus.activatePrivateSpellcheck == false && mc.clientinfo.privateSpellcheck.activated {
            log?.info("communicationhandler @ handleStudentStatusUpdates: de-activating spellcheck for student")
            mc.clientinfo.privateSpellcheck.activate = false
            mc.clientinfo.privateSpellcheck.activated = false
        }
        mc.clientinfo.privateSpellcheck.suggestions = studentstatus.activatePrivateSuggestions ?? false
        // mirror Electron: teacher-set OneDrive share link for microsoft365 exams (URL or false→nil)
        let nextShare = (studentstatus.msofficeshare?.isEmpty == false) ? studentstatus.msofficeshare : nil
        if nextShare != mc.clientinfo.msofficeshare {
            log?.info("communicationhandler @ handleStudentStatusUpdates: msofficeshare = \(nextShare ?? "nil")")
        }
        mc.clientinfo.msofficeshare = nextShare
        return false
    }

    /// Uploads Documents/next-exam-student.log to the teacher when it requests a log snapshot
    /// (mirrors src-electron/main/scripts/communicationhandler.js sendStudentLogToTeacher).
    private func sendStudentLogToTeacher() async {
        guard let mc = multicastClient,
              let serverip = mc.clientinfo.serverip, !serverip.isEmpty,
              let servername = mc.clientinfo.servername, !servername.isEmpty else { return }

        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let logPath = docs.appendingPathComponent("next-exam-student.log")
        guard FileManager.default.fileExists(atPath: logPath.path),
              let fileData = try? Data(contentsOf: logPath) else {
            log?.warn("communicationhandler @ sendStudentLogToTeacher: missing or unreadable \(logPath.path)")
            return
        }

        guard let url = URL(string: "https://\(serverip):\(Config.serverApiPort)/server/data/studentlog/\(servername)") else {
            log?.error("communicationhandler @ sendStudentLogToTeacher: Invalid URL")
            return
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        NextExamApiAuthentication.apply(to: &request)
        request.setValue("Bearer " + (mc.clientinfo.token ?? ""), forHTTPHeaderField: "Authorization")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "file": fileData.base64EncodedString(),
                "clientname": mc.clientinfo.name,
            ])
        } catch {
            log?.error("communicationhandler @ sendStudentLogToTeacher: JSON serialization failed – \(error.localizedDescription)")
            return
        }

        do {
            let (data, _) = try await urlSession.data(for: request)
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let message = obj["message"] as? String ?? obj["status"] as? String {
                log?.info("communicationhandler @ sendStudentLogToTeacher: \(message)")
            }
        } catch {
            log?.error("communicationhandler @ sendStudentLogToTeacher: \(error.localizedDescription)")
        }
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
        guard let mc = multicastClient else { return }

        // MARK: - Screenlock (temporary lock by the teacher, mirrors Electron communicationhandler.js)
        if serverstatus.screenslocked && !mc.clientinfo.screenlock {
            activateScreenlock()
        } else if !serverstatus.screenslocked && mc.clientinfo.screenlock {
            killScreenlock()
        }

        // MARK: - Screenshot Interval
        // JS: `|| === 0` pattern ensures 0 is treated as a valid value, hence Optional in Swift
        let screenshotinterval = serverstatus.screenshotinterval
        let intervalMs = screenshotinterval * 1000
        if mc.clientinfo.screenshotinterval != intervalMs {
            log?.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval changed to \(intervalMs)")
            mc.clientinfo.screenshotinterval = intervalMs

            if intervalMs == 0 {
                log?.info("communicationhandler @ processUpdatedServerstatus: ScreenshotInterval disabled!")
            }

            ScreenshotHandler.shared.applyConfig(intervalMs: intervalMs)
        }

        // MARK: - Exam Mode
        if serverstatus.exammode && !mc.clientinfo.exammode {
            let lockedSection = serverstatus.lockedSection
            let examtype = serverstatus.examSections[lockedSection]?.examtype

            if _startExamRunning {
                log?.info("communicationhandler @ processUpdatedServerstatus: startExam already running, skip duplicate")
                return
            }
            if examtype == "localvm" && localVmStartState != "idle" {
                log?.info("communicationhandler @ processUpdatedServerstatus: localvm start suppressed (state=\(localVmStartState))")
                return
            }

            log?.info("communicationhandler @ processUpdatedServerstatus: exammode activated")
            //killScreenlock()
            await startExam(serverstatus)

        } else if !serverstatus.exammode && mc.clientinfo.exammode {
            log?.info("communicationhandler @ processUpdatedServerstatus: exammode deactivated")
            //killScreenlock()
            await endExam()
        }

        // MARK: - Local VM State Cleanup
        if !serverstatus.exammode && mc.clientinfo.examtype == "localvm" {
            let st = mc.clientinfo.localVMState
            let keepFixUi = st == "missing" || st == "hash_mismatch" || st == "error"

            if !keepFixUi, let currentState = st {
                log?.info("communicationhandler @ processUpdatedServerstatus: localvm exammode off -> clearing transient vm state (\(currentState))")
                mc.clientinfo.localVMState = nil
                mc.clientinfo.localVMHost = nil
            }

            if localVmStartState != "idle" {
                localVmStartState = "idle"
            }
        }
    }


    /// Shows the teacher-triggered screenlock via the renderer's focus warning overlay.
    private func activateScreenlock() {
        guard let mc = multicastClient else { return }
        mc.clientinfo.screenlock = true
        let message = NSLocalizedString("screenlockMessage", comment: "Shown while the teacher temporarily locks all student screens")
        mc.clientinfo.focus = false
        mc.clientinfo.focusLockMessage = message
        IPCBridge.shared.send("focusLock", ["reason": "", "message": message])
    }

    /// Removes the teacher-triggered screenlock and restores focus.
    private func killScreenlock() {
        guard let mc = multicastClient else { return }
        mc.clientinfo.screenlock = false
        mc.clientinfo.focusLockMessage = nil
        mc.clientinfo.focusLockReason = nil
        mc.clientinfo.focus = true
    }

    /// Public entry point for direct exam start (used by local lockdown).
    func startExamDirect(_ serverstatus: ServerStatus) async {
        await startExam(serverstatus)
    }

    /// Starts exam mode: determines section/type, begins assessment lockdown, notifies renderer.
    private func startExam(_ serverstatus: ServerStatus) async {
        log?.info("communicationhandler @ startExam: starting exam")
        if _startExamRunning {
            log?.info("communicationhandler @ startExam: already running, skip duplicate")
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
            log?.error("communicationhandler @ startExam: no exam section for index \(effectiveSection)")
            return
        }
        let examtype = section.examtype

        // LocalVM not supported on iOS
        if examtype == "localvm" {
            log?.warn("communicationhandler @ startExam: localvm examtype not supported on iOS")
            return
        }

        if !mc.clientinfo.exammode {
            // First start — begin assessment lockdown
            if !mc.clientinfo.localLockdown {
                // Normal (teacher-connected) exam: require assessment lock
                if assessmentHandler?.isLocked() == false {
                    let locked = await assessmentHandler?.startSession() ?? false
                    if !locked {
                        log?.warn("communicationhandler @ startExam: assessment mode declined or failed")
                        return
                    }
                }
            } else {
                // Local lockdown: attempt assessment but don't fail if unavailable
                let locked = await assessmentHandler?.startSession() ?? false
                if !locked {
                    log?.warn("communicationhandler @ startExam: assessment mode unavailable in local lockdown (proceeding anyway)")
                }
            }
            mc.clientinfo.exammode = true
            mc.clientinfo.examtype = examtype
            log?.info("communicationhandler @ startExam: creating exam view (type=\(examtype))")
        } else {
            // Reconnect / section switch — exam view already active
            log?.info("communicationhandler @ startExam: reconnecting into active exam session")
        }

        var payload = serverstatus.asDictionary
        // Renderer stores exam files relative to the same folder the native side uses
        // (Documents/<servername>-<pin>, or local-exam) so backups live next to the exam directory.
        payload["examdirectory"] = URL(fileURLWithPath: Config.examdirectory).lastPathComponent
        IPCBridge.shared.send("startExam", payload)
    }

    public func gracefullyEndExam() {
        Task { await endExam() }
    }

    /// Tears down exam mode and notifies the renderer.
    private func endExam(deleteFolderOnExit: Bool? = nil) async {
        guard let mc = multicastClient else { return }
        mc.clientinfo.exammode      = false
        mc.clientinfo.localLockdown = false
        log?.info("communicationhandler @ endExam: ending exam")
        // delete students work on exit when the teacher enabled delfolderonexit (mirrors Electron communicationhandler.js endExam)
        if (deleteFolderOnExit ?? mc.serverstatus.delfolderonexit) == true {
            log?.info("communicationhandler @ endExam: cleaning exam workfolder on exit")
            let dir = Config.examdirectory
            if !dir.isEmpty {
                do {
                    if FileManager.default.fileExists(atPath: dir) {
                        try FileManager.default.removeItem(atPath: dir)
                    }
                    try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                } catch {
                    log?.error("communicationhandler @ endExam: can not clean exam workfolder - \(error.localizedDescription)")
                }
            }
        }
        IPCBridge.shared.send("endExam")
        await assessmentHandler?.endSession()
    }

    // MARK: - Connection Management

    public func resetConnection() {
        guard let mc = multicastClient else { return }
        if let token = mc.clientinfo.token {
            mc.reconnectToken = token
        }
        mc.clientinfo.token         = nil
        mc.clientinfo.ip            = nil
        mc.clientinfo.serverip      = nil
        mc.clientinfo.servername    = nil
        mc.clientinfo.focus         = true
        mc.clientinfo.timestamp     = nil
        mc.clientinfo.localLockdown = false
    }

    private func kickStudent(deleteFolderOnExit: Bool = false) async {
        guard let mc = multicastClient else { return }
        log?.warn("communicationhandler @ kickStudent: Student got kicked by Teacher")
        mc.kicked = false
        mc.beaconsLost = 0
        await endExam(deleteFolderOnExit: deleteFolderOnExit)
        resetConnection()
    }
}
