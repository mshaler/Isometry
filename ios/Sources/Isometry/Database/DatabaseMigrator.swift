import Foundation
import GRDB

/// Manages database schema migrations
public struct DatabaseMigrator {
    /// Registers all migrations and runs them against the database
    public static func migrate(_ db: Database) throws {
        var migrator = GRDB.DatabaseMigrator()

        // Migration 1: Initial schema (handled by schema.sql)
        // This is a placeholder since we load schema.sql directly

        // Migration 2: Example future migration
        // migrator.registerMigration("002_add_some_column") { db in
        //     try db.alter(table: "nodes") { t in
        //         t.add(column: "some_column", .text)
        //     }
        // }

        // Apply migrations
        try migrator.migrate(db)
    }

    /// Returns the current schema version
    public static func currentVersion(_ db: Database) throws -> Int {
        let sql = "SELECT MAX(version) FROM schema_migrations"
        return try Int.fetchOne(db, sql: sql) ?? 0
    }

    /// Records a migration as applied
    public static func recordMigration(version: Int, description: String, in db: Database) throws {
        try db.execute(
            sql: """
                INSERT OR REPLACE INTO schema_migrations (version, description, applied_at)
                VALUES (?, ?, datetime('now'))
                """,
            arguments: [version, description]
        )
    }
}

// MARK: - Migration Definitions

/// Protocol for defining migrations
public protocol Migration: Sendable {
    static var version: Int { get }
    static var description: String { get }
    static func migrate(_ db: Database) throws
}

/// Example migration structure for future use
public enum Migrations {
    // Migration definitions will be added here as the schema evolves
    // Example:
    // public struct AddTagsIndex: Migration {
    //     public static let version = 2
    //     public static let description = "Add index on tags column"
    //
    //     public static func migrate(_ db: Database) throws {
    //         try db.execute(sql: "CREATE INDEX IF NOT EXISTS idx_nodes_tags ON nodes(tags)")
    //     }
    // }
}
