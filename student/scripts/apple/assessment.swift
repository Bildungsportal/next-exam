import AutomaticAssessmentConfiguration
import Foundation

let arg = CommandLine.arguments.dropFirst().first ?? ""
let configuration = AEAssessmentConfiguration()
let session = AEAssessmentSession(configuration: configuration)

if arg == "start" {
    session.begin()
    RunLoop.main.run()
} 
else if arg == "stop" {
    session.end()
}
