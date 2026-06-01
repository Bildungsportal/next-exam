import AutomaticAssessmentConfiguration
import Foundation

let arg = CommandLine.arguments.dropFirst().first ?? ""
let session = AEAssessmentSession()

if arg == "start" {
    session.begin()
    RunLoop.main.run()
} 
else if arg == "stop" {
    session.end()
}
