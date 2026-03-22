import Testing
import Foundation
import CloudKit
@testable import Isometry

// ---------------------------------------------------------------------------
// SyncTypes Tests
// ---------------------------------------------------------------------------
// Tests for CodableValue encoding/decoding, PendingChange serialization,
// CKRecord field mapping, and SyncConstants.
//
// These tests verify the offline queue persistence layer that prevents
// data loss during sync failures. Encoding bugs here → corrupted sync records.

struct SyncTypesTests {

    // MARK: - SyncConstants

    @Test func zoneIDHasCorrectName() {
        #expect(SyncConstants.zoneID.zoneName == "IsometryZone")
    }

    @Test func cardRecordTypeIsCard() {
        #expect(SyncConstants.cardRecordType == "Card")
    }

    @Test func connectionRecordTypeIsConnection() {
        #expect(SyncConstants.connectionRecordType == "Connection")
    }

    // MARK: - CodableValue round-trip

    @Test func codableValueStringRoundTrip() throws {
        let original = CodableValue.string("hello")
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CodableValue.self, from: data)
        #expect(decoded == original)
    }

    @Test func codableValueIntRoundTrip() throws {
        let original = CodableValue.int(42)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CodableValue.self, from: data)
        #expect(decoded == original)
    }

    @Test func codableValueDoubleRoundTrip() throws {
        let original = CodableValue.double(3.14)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CodableValue.self, from: data)
        #expect(decoded == original)
    }

    @Test func codableValueBoolRoundTrip() throws {
        let original = CodableValue.bool(true)
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CodableValue.self, from: data)
        #expect(decoded == original)
    }

    @Test func codableValueNullRoundTrip() throws {
        let original = CodableValue.null
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(CodableValue.self, from: data)
        #expect(decoded == original)
    }

    // MARK: - CodableValue convenience accessors

    @Test func stringValueAccessor() {
        #expect(CodableValue.string("test").stringValue == "test")
        #expect(CodableValue.int(1).stringValue == nil)
        #expect(CodableValue.null.stringValue == nil)
    }

    @Test func intValueAccessor() {
        #expect(CodableValue.int(42).intValue == 42)
        #expect(CodableValue.string("x").intValue == nil)
        #expect(CodableValue.null.intValue == nil)
    }

    @Test func doubleValueAccessor() {
        #expect(CodableValue.double(1.5).doubleValue == 1.5)
        #expect(CodableValue.string("x").doubleValue == nil)
        #expect(CodableValue.null.doubleValue == nil)
    }

    @Test func boolValueAccessor() {
        #expect(CodableValue.bool(true).boolValue == true)
        #expect(CodableValue.bool(false).boolValue == false)
        #expect(CodableValue.string("x").boolValue == nil)
    }

    // MARK: - CodableValue.from factory

    @Test func fromStringCreatesString() {
        let v = CodableValue.from("hello" as Any)
        #expect(v == .string("hello"))
    }

    @Test func fromIntCreatesInt() {
        let v = CodableValue.from(42 as Any)
        #expect(v == .int(42))
    }

    @Test func fromDoubleCreatesDouble() {
        let v = CodableValue.from(3.14 as Any)
        #expect(v == .double(3.14))
    }

    @Test func fromBoolCreatesBool() {
        let v = CodableValue.from(true as Any)
        #expect(v == .bool(true))
    }

    @Test func fromNSNullCreatesNull() {
        let v = CodableValue.from(NSNull() as Any)
        #expect(v == .null)
    }

    @Test func fromUnknownTypeConvertsToString() {
        let v = CodableValue.from([1, 2, 3] as Any)
        // Should convert to string representation
        #expect(v.stringValue != nil)
    }

    // MARK: - PendingChange round-trip

    @Test func pendingChangeSaveRoundTrip() throws {
        let change = PendingChange(
            id: "uuid-1",
            recordType: "Card",
            recordId: "card-123",
            operation: "save",
            fields: [
                "name": .string("Test Card"),
                "priority": .int(3),
                "weight": .double(1.5),
                "is_collective": .bool(false),
                "deleted_at": .null
            ],
            timestamp: Date(timeIntervalSince1970: 1700000000)
        )

        let data = try JSONEncoder().encode(change)
        let decoded = try JSONDecoder().decode(PendingChange.self, from: data)

        #expect(decoded.id == "uuid-1")
        #expect(decoded.recordType == "Card")
        #expect(decoded.recordId == "card-123")
        #expect(decoded.operation == "save")
        #expect(decoded.fields?["name"] == .string("Test Card"))
        #expect(decoded.fields?["priority"] == .int(3))
        #expect(decoded.fields?["weight"] == .double(1.5))
        #expect(decoded.fields?["is_collective"] == .bool(false))
        #expect(decoded.fields?["deleted_at"] == .null)
    }

    @Test func pendingChangeDeleteRoundTrip() throws {
        let change = PendingChange(
            id: "uuid-2",
            recordType: "Connection",
            recordId: "conn-456",
            operation: "delete",
            fields: nil,
            timestamp: Date(timeIntervalSince1970: 1700000000)
        )

        let data = try JSONEncoder().encode(change)
        let decoded = try JSONDecoder().decode(PendingChange.self, from: data)

        #expect(decoded.operation == "delete")
        #expect(decoded.fields == nil)
    }

    @Test func pendingChangeArrayRoundTrip() throws {
        let changes = [
            PendingChange(id: "a", recordType: "Card", recordId: "c1", operation: "save", fields: ["name": .string("A")], timestamp: Date()),
            PendingChange(id: "b", recordType: "Card", recordId: "c2", operation: "delete", fields: nil, timestamp: Date()),
        ]

        let data = try JSONEncoder().encode(changes)
        let decoded = try JSONDecoder().decode([PendingChange].self, from: data)

        #expect(decoded.count == 2)
        #expect(decoded[0].recordId == "c1")
        #expect(decoded[1].operation == "delete")
    }

    // MARK: - CKRecord card field mapping

    @Test func setCardFieldsSetsStringFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record.setCardFields([
            "name": .string("Test Card"),
            "folder": .string("docs"),
            "status": .string("active"),
        ])

        #expect(record["name"] as? String == "Test Card")
        #expect(record["folder"] as? String == "docs")
        #expect(record["status"] as? String == "active")
    }

    @Test func setCardFieldsSetsIntFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record.setCardFields([
            "priority": .int(5),
            "sort_order": .int(10),
        ])

        #expect(record["priority"] as? Int == 5)
        #expect(record["sort_order"] as? Int == 10)
    }

    @Test func setCardFieldsSetsDoubleFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record.setCardFields([
            "latitude": .double(37.7749),
            "longitude": .double(-122.4194),
        ])

        #expect(record["latitude"] as? Double == 37.7749)
        #expect(record["longitude"] as? Double == -122.4194)
    }

    @Test func setCardFieldsSetsNullToNil() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        // Set a value first, then null it out
        record.setCardFields(["name": .string("Initial")])
        #expect(record["name"] as? String == "Initial")

        record.setCardFields(["name": .null])
        #expect(record["name"] == nil)
    }

    @Test func setCardFieldsIgnoresUnknownFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record.setCardFields(["unknown_field": .string("ignored")])
        #expect(record["unknown_field"] == nil)
    }

    @Test func cardFieldsDictionaryExtractsStringFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record["name"] = "Alpha" as CKRecordValue
        record["folder"] = "docs" as CKRecordValue

        let dict = record.cardFieldsDictionary()
        #expect(dict["name"] == .string("Alpha"))
        #expect(dict["folder"] == .string("docs"))
    }

    @Test func cardFieldsDictionaryExtractsIntFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        record["priority"] = 3 as CKRecordValue

        let dict = record.cardFieldsDictionary()
        #expect(dict["priority"] == .int(3))
    }

    @Test func cardFieldsDictionaryOmitsMissingFields() {
        let record = CKRecord(recordType: "Card", recordID: CKRecord.ID(recordName: "test", zoneID: SyncConstants.zoneID))
        // Don't set any fields
        let dict = record.cardFieldsDictionary()
        #expect(dict["name"] == nil)
        #expect(dict["priority"] == nil)
    }

    // MARK: - CKRecord connection field mapping

    @Test func setConnectionFieldsSetsReferences() {
        let record = CKRecord(recordType: "Connection", recordID: CKRecord.ID(recordName: "conn-1", zoneID: SyncConstants.zoneID))
        record.setConnectionFields([
            "source_id": .string("card-A"),
            "target_id": .string("card-B"),
            "label": .string("related"),
            "weight": .double(1.0),
            "via_card_id": .string("card-C"),
        ], zoneID: SyncConstants.zoneID)

        // source_id and target_id should be CKRecord.Reference
        let sourceRef = record["source_id"] as? CKRecord.Reference
        #expect(sourceRef != nil)
        #expect(sourceRef?.recordID.recordName == "card-A")

        let targetRef = record["target_id"] as? CKRecord.Reference
        #expect(targetRef != nil)
        #expect(targetRef?.recordID.recordName == "card-B")

        #expect(record["label"] as? String == "related")
        #expect(record["weight"] as? Double == 1.0)
        #expect(record["via_card_id"] as? String == "card-C")
    }

    @Test func setConnectionFieldsReferencesUseDeleteSelfAction() {
        let record = CKRecord(recordType: "Connection", recordID: CKRecord.ID(recordName: "conn-1", zoneID: SyncConstants.zoneID))
        record.setConnectionFields([
            "source_id": .string("card-A"),
        ], zoneID: SyncConstants.zoneID)

        let ref = record["source_id"] as? CKRecord.Reference
        #expect(ref?.action == .deleteSelf)
    }
}
