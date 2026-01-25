import Foundation
import Vapor
import IsometryAPI

// Configure the application
var env = try Environment.detect()
try LoggingSystem.bootstrap(from: &env)

let app = Application(env)
defer { app.shutdown() }

// Configure the IsometryAPI
try app.configure()

// Run the server
try app.run()