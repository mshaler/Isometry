import XCTest
@testable import Isometry

// ---------------------------------------------------------------------------
// CoreDataTimestampConverterTests
// ---------------------------------------------------------------------------
// Verifies the epoch offset (978,307,200 seconds) produces correct ISO 8601
// strings. Ensures no 31-year offset bug is possible.
//
// Requirement: FNDX-03

final class CoreDataTimestampConverterTests: XCTestCase {

    /// CoreData 0 should return nil — indicates an unset timestamp.
    func testZeroTimestampReturnsNil() {
        XCTAssertNil(CoreDataTimestampConverter.toISO8601(0))
        XCTAssertNil(CoreDataTimestampConverter.toDate(0))
    }

    /// CoreData 1 is one second after 2001-01-01T00:00:00Z.
    func testOneSecondAfterEpoch() {
        let result = CoreDataTimestampConverter.toISO8601(1)
        XCTAssertEqual(result, "2001-01-01T00:00:01Z")
    }

    /// CoreData 725,760,000 is exactly 2024-01-01T00:00:00Z.
    /// This is the primary guard against the 31-year offset bug.
    func testKnownDate2024Jan01() {
        let result = CoreDataTimestampConverter.toISO8601(725_760_000)
        XCTAssertEqual(result, "2024-01-01T00:00:00Z")
    }

    /// Negative timestamps should return nil — invalid in CoreData context.
    func testNegativeTimestampReturnsNil() {
        XCTAssertNil(CoreDataTimestampConverter.toISO8601(-1))
        XCTAssertNil(CoreDataTimestampConverter.toDate(-1))
    }

    /// toDate should return a Date matching 2024-01-01T00:00:00Z for 725,760,000.
    func testToDateReturnsCorrectDate() {
        let date = CoreDataTimestampConverter.toDate(725_760_000)
        XCTAssertNotNil(date)

        // Verify by comparing against a known reference date
        let calendar = Calendar(identifier: .gregorian)
        let components = calendar.dateComponents(
            in: TimeZone(identifier: "UTC")!,
            from: date!
        )
        XCTAssertEqual(components.year, 2024)
        XCTAssertEqual(components.month, 1)
        XCTAssertEqual(components.day, 1)
        XCTAssertEqual(components.hour, 0)
        XCTAssertEqual(components.minute, 0)
        XCTAssertEqual(components.second, 0)
    }
}
