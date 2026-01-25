import Foundation
import GRDB

/// Manages database schema migrations
public struct DatabaseMigrator {
    /// Creates a configured GRDB migrator with all registered migrations
    public static func createMigrator() -> GRDB.DatabaseMigrator {
        var migrator = GRDB.DatabaseMigrator()

        // Migration 1: Initial schema is loaded from schema.sql
        // Registered migrations ensure indexes exist for databases created before schema update

        // Migration 002: Ensure performance indexes exist
        // These indexes optimize LATCH filtering and graph traversal for 10k+ datasets
        migrator.registerMigration("002_add_performance_indexes") { db in
            // Nodes indexes for temporal sorting (60fps rendering optimization)
            try db.execute(sql: """
                CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at DESC);
            """)

            // Edge indexes for graph traversal (<100ms query target)
            try db.execute(sql: """
                CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
                CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);
            """)

            // Record migration in custom table if it exists
            try? db.execute(
                sql: """
                    INSERT OR IGNORE INTO schema_migrations (version, description, applied_at)
                    VALUES (2, 'Add performance indexes for 10k+ datasets', datetime('now'))
                """
            )
        }

        return migrator
    }

    /// Runs migrations against a database writer (DatabasePool or DatabaseQueue)
    public static func migrate(_ writer: some DatabaseWriter) throws {
        let migrator = createMigrator()
        try migrator.migrate(writer)
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
