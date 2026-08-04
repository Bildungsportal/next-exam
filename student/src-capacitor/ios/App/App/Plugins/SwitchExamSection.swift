import Foundation

private let log = LoggingHandler.shared

/// Switches the active exam section.
///
/// File ops (save/load section subdirectories) are handled in the renderer via
/// @capacitor/filesystem before this is called. This function only updates
/// clientinfo and notifies the renderer to reload the exam.
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
