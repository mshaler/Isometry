import Foundation
import IsometryAPI
import Isometry

/// Command-line entry point for IsometryAPIServer
///
/// Usage: IsometryAPIServer [--port PORT] [--database PATH] [--help]
@main
struct IsometryAPIServerMain {
    static func main() async {
        let arguments = CommandLine.arguments

        var port = 8080
        var databasePath = "isometry.db"
        var showHelp = false

        // Parse command line arguments
        var i = 1
        while i < arguments.count {
            let arg = arguments[i]

            switch arg {
            case "--port", "-p":
                if i + 1 < arguments.count {
                    port = Int(arguments[i + 1]) ?? 8080
                    i += 1
                } else {
                    print("Error: --port requires a value")
                    exit(1)
                }

            case "--database", "-d":
                if i + 1 < arguments.count {
                    databasePath = arguments[i + 1]
                    i += 1
                } else {
                    print("Error: --database requires a value")
                    exit(1)
                }

            case "--help", "-h":
                showHelp = true

            case "--api-server":
                // Ignore this flag, it's used by React launcher to identify server mode
                break

            default:
                print("Warning: Unknown argument '\(arg)'")
            }

            i += 1
        }

        if showHelp {
            printUsage()
            return
        }

        print("🚀 Starting IsometryAPIServer...")
        print("   Database: \(databasePath)")
        print("   Port: \(port)")

        do {
            // Initialize database
            let database = try IsometryDatabase(path: databasePath)
            try await database.initialize()

            // Create and start API server
            let server = IsometryAPIServer(database: database, port: port)
            let actualPort = try await server.start()

            print("✅ Server ready at http://127.0.0.1:\(actualPort)")
            print("   Health check: http://127.0.0.1:\(actualPort)/health")
            print("   API endpoints: http://127.0.0.1:\(actualPort)/api/*")
            print("\n📝 Logs:")

            // Handle graceful shutdown
            let signalSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
            signalSource.setEventHandler {
                print("\n🛑 Received shutdown signal...")
                Task {
                    try? await server.stop()
                    exit(0)
                }
            }
            signalSource.resume()

            // Keep the server running
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                // This will keep the main thread alive indefinitely
                // The signal handler above will terminate the process
            }

        } catch {
            print("❌ Failed to start server: \(error.localizedDescription)")
            exit(1)
        }
    }

    static func printUsage() {
        print("""
        IsometryAPIServer - HTTP API bridge for Isometry database

        USAGE:
            IsometryAPIServer [OPTIONS]

        OPTIONS:
            --port, -p PORT       Server port (default: 8080)
            --database, -d PATH   Database file path (default: isometry.db)
            --help, -h            Show this help message

        EXAMPLES:
            IsometryAPIServer
            IsometryAPIServer --port 3001
            IsometryAPIServer --database /path/to/my/isometry.db --port 9000

        The server provides REST endpoints that match sql.js interface:
            POST /api/execute      - Execute raw SQL (matches DatabaseContext.execute)
            GET  /api/nodes        - Get all nodes
            POST /api/nodes        - Create new node
            GET  /api/search?q=... - Full-text search

        For React prototype development, use environment variable:
            REACT_APP_USE_NATIVE_API=true npm run dev
        """)
    }
}