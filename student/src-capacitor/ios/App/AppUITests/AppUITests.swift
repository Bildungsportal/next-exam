import XCTest

private struct StudentPage {
    let app: XCUIApplication

    /// Returns an element with the given accessibility label after waiting for it.
    func element(label: String, timeout: TimeInterval = 60) -> XCUIElement {
        let element = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: timeout))
        return element
    }

    /// Closes the first-run bilingual keyboard prompt when it appears.
    func dismissKeyboardOnboarding() {
        let continueButton = app.buttons.matching(NSPredicate(
            format: "label MATCHES[c] %@",
            ".*(continue|fortfahren).*"
        )).firstMatch
        if continueButton.waitForExistence(timeout: 2) {
            continueButton.tap()
        }
    }

    /// Replaces any prefilled field value with deterministic test text.
    func replaceText(in field: XCUIElement, with value: String) {
        field.tap()
        dismissKeyboardOnboarding()
        field.tap()
        let focusExpectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "hasKeyboardFocus == true"),
            object: field
        )
        XCTAssertEqual(XCTWaiter.wait(for: [focusExpectation], timeout: 5), .completed)
        let currentValue = field.value as? String ?? ""
        if !currentValue.isEmpty {
            field.press(forDuration: 1)
            let selectAll = app.descendants(matching: .any).matching(NSPredicate(
                format: "label MATCHES[c] %@",
                ".*(select all|alles auswählen).*"
            )).firstMatch
            if selectAll.waitForExistence(timeout: 5) {
                selectAll.tap()
            } else {
                field.tap()
                field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: currentValue.count))
            }
        }
        field.typeText(value)
        XCTAssertEqual(field.value as? String, value)
    }

    /// Registers the configured student for the named exam.
    func register(name: String, pinCode: String, examName: String) {
        let nameField = element(label: "e2e-user")
        replaceText(in: nameField, with: name)

        let pinField = element(label: "e2e-pin")
        replaceText(in: pinField, with: pinCode)

        let manualSearchCheckbox = element(label: "e2e-manual-search")
        manualSearchCheckbox.tap()

        let serverIpField = element(label: "e2e-server-ip")
        serverIpField.tap()
        serverIpField.typeText("127.0.0.1")

        let exam = element(label: "e2e-register-\(examName)", timeout: 300)
        exam.tap()
    }

    /// Writes and submits an answer after the teacher starts the exam.
    func submitSprachenAnswer(_ answer: String) {
        let editor = element(label: "e2e-editor", timeout: 300)
        editor.tap()
        editor.typeText(answer)

        let finish = element(label: "e2e-finish-exam")
        finish.tap()

        let send = element(label: "e2e-send-exam", timeout: 300)
        send.tap()

        let saved = app.staticTexts.matching(NSPredicate(
            format: "label MATCHES[c] %@",
            ".*(saved|gespeichert|gesichert).*"
        )).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 300))
    }
}

final class AppUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 900
    }

    /// Completes the student side of the existing Sprachen end-to-end flow.
    func testStudentCompletesSprachenExam() {
        let app = XCUIApplication()
        addUIInterruptionMonitor(withDescription: "Local Network permission") { alert in
            let allow = alert.buttons.matching(NSPredicate(
                format: "label MATCHES[c] %@",
                ".*(allow|erlauben).*"
            )).firstMatch
            guard allow.exists else { return false }
            allow.tap()
            return true
        }
        app.launch()

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 60))
        app.tap()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 60))
        let student = StudentPage(app: app)
        student.register(name: "iosstudent", pinCode: "1111", examName: "e2e-ios")
        student.submitSprachenAnswer("This answer was written by the iOS end-to-end test.")
    }
}
