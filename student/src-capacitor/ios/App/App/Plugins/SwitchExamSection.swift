import Foundation

private let log = LoggingHandler.shared

/// Single entry point for student- and teacher-initiated section switches.
/// Asks the renderer to run the whole switch pipeline (save + move files); the
/// renderer confirms via commit-exam-section, which calls switchExamSection.
func requestExamSectionSwitch(
    multicastClient: MulticastClient,
    serverstatus: ServerStatus,
    newSectionNumber: Int
) -> Bool {
    guard multicastClient.clientinfo.exammode else {
        log?.warn("requestExamSectionSwitch: not in exammode, skip")
        return false
    }
    guard serverstatus.examSections[newSectionNumber] != nil else {
        log?.warn("requestExamSectionSwitch: section \(newSectionNumber) not found in examSections")
        return false
    }
    guard newSectionNumber != multicastClient.clientinfo.lockedSection else {
        log?.warn("requestExamSectionSwitch: already on section \(newSectionNumber), skip")
        return false
    }

    log?.info("requestExamSectionSwitch: asking renderer to switch to section \(newSectionNumber)")
    IPCBridge.shared.send("switching-exam-section", newSectionNumber)
    return true
}

/// Commit step of a section switch: called via commit-exam-section after the
/// renderer moved the files (save/load section subdirectories). Only updates
/// clientinfo.
func switchExamSection(
    multicastClient: MulticastClient,
    serverstatus: ServerStatus,
    newSectionNumber: Int
) async {
    guard let newSection = serverstatus.examSections[newSectionNumber] else {
        log?.error("switchExamSection: section \(newSectionNumber) not found in examSections")
        return
    }

    log?.warn("switchExamSection: changing section to \(newSectionNumber) \(newSection.sectionname), Examtype: \(newSection.examtype)")

    multicastClient.clientinfo.examtype      = newSection.examtype
    multicastClient.clientinfo.lockedSection = newSectionNumber
}
