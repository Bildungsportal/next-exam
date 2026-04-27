import Foundation
import Network

@available(iOS 12.0, *)
final class IPCSyncServer {
    private let port: NWEndpoint.Port
    private let handler: (String, Any?) -> Any?
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.ipc.sync", qos: .userInteractive)

    init(port: UInt16, handler: @escaping (String, Any?) -> Any?) {
        self.port    = NWEndpoint.Port(rawValue: port)!
        self.handler = handler
    }

    func start() {
        guard let listener = try? NWListener(using: .tcp, on: port) else { return }
        listener.newConnectionHandler = { [weak self] in self?.accept($0) }
        listener.start(queue: queue)
        self.listener = listener
    }

    func stop() { listener?.cancel(); listener = nil }

    // ── Connection handling ───────────────────────────────────────────────────

    private func accept(_ conn: NWConnection) {
        conn.start(queue: queue)
        collect(conn, buffer: Data())
    }

    private func collect(_ conn: NWConnection, buffer: Data) {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, done, error in
            guard let self, error == nil else { conn.cancel(); return }
            var buf = buffer
            if let data { buf.append(data) }

            // Full HTTP request ends after blank line
            if let s = String(data: buf, encoding: .utf8), s.contains("\r\n\r\n") {
                self.respond(conn, raw: buf)
            } else if done {
                self.respond(conn, raw: buf)
            } else {
                self.collect(conn, buffer: buf)
            }
        }
    }

    private func respond(_ conn: NWConnection, raw: Data) {
        guard
            let text = String(data: raw, encoding: .utf8),
            let sep  = text.range(of: "\r\n\r\n"),
            let bodyData = String(text[sep.upperBound...]).data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: bodyData) as? [String: Any],
            let channel = json["channel"] as? String
        else {
            send(conn, status: "400 Bad Request", body: Data()); return
        }

        let result   = handler(channel, json["payload"])
        let respDict = ["result": result as Any]
        let body     = (try? JSONSerialization.data(withJSONObject: respDict)) ?? Data()
        send(conn, status: "200 OK", body: body)
    }

    private func send(_ conn: NWConnection, status: String, body: Data) {
        let head = "HTTP/1.1 \(status)\r\nContent-Type: application/json\r\nContent-Length: \(body.count)\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST,OPTIONS\r\nConnection: close\r\n\r\n"
        var response = head.data(using: .utf8)!
        response.append(body)
        conn.send(content: response, completion: .contentProcessed { _ in conn.cancel() })
    }
}
