// NoteStoreProto.pb.swift
// Hand-written SwiftProtobuf conformance for Apple Notes notestore.proto
//
// Schema source: apple_cloud_notes_parser/proto/notestore.proto
// Corroborated by: apple-notes-liberator, Ciofeca Forensics
//
// This file is a one-time artifact checked into the repo. It defines the
// protobuf message types needed to deserialize gzip-compressed ZDATA blobs
// from NoteStore.sqlite's ZICNOTEDATA table.

import Foundation
import SwiftProtobuf

// MARK: - NoteStoreProto (top-level message)

/// Top-level protobuf wrapper for Apple Notes ZDATA blobs.
/// After gzip decompression, the raw bytes deserialize into this type.
nonisolated struct NoteStoreProto: Sendable {
    /// The document container (field 2).
    var document: NoteDocument {
        get { _document ?? NoteDocument() }
        set { _document = newValue }
    }
    var hasDocument: Bool { _document != nil }
    mutating func clearDocument() { _document = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _document: NoteDocument?
}

// MARK: - NoteDocument

nonisolated struct NoteDocument: Sendable {
    /// Schema version (field 2).
    var version: Int32 {
        get { _version ?? 0 }
        set { _version = newValue }
    }
    var hasVersion: Bool { _version != nil }
    mutating func clearVersion() { _version = nil }

    /// The note content (field 3).
    var note: NoteContent {
        get { _note ?? NoteContent() }
        set { _note = newValue }
    }
    var hasNote: Bool { _note != nil }
    mutating func clearNote() { _note = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _version: Int32?
    fileprivate var _note: NoteContent?
}

// MARK: - NoteContent

nonisolated struct NoteContent: Sendable {
    /// The full note text content (field 2).
    var noteText: String {
        get { _noteText ?? "" }
        set { _noteText = newValue }
    }
    var hasNoteText: Bool { _noteText != nil }
    mutating func clearNoteText() { _noteText = nil }

    /// Formatting runs describing styles for ranges of noteText (field 5).
    var attributeRun: [NoteAttributeRun] = []

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _noteText: String?
}

// MARK: - NoteAttributeRun

nonisolated struct NoteAttributeRun: Sendable {
    /// Number of Unicode scalars this run covers (field 1).
    var length: Int32 {
        get { _length ?? 0 }
        set { _length = newValue }
    }
    var hasLength: Bool { _length != nil }
    mutating func clearLength() { _length = nil }

    /// Paragraph-level formatting (field 2).
    var paragraphStyle: NoteParagraphStyle {
        get { _paragraphStyle ?? NoteParagraphStyle() }
        set { _paragraphStyle = newValue }
    }
    var hasParagraphStyle: Bool { _paragraphStyle != nil }
    mutating func clearParagraphStyle() { _paragraphStyle = nil }

    /// Font information (field 3).
    var font: NoteFont {
        get { _font ?? NoteFont() }
        set { _font = newValue }
    }
    var hasFont: Bool { _font != nil }
    mutating func clearFont() { _font = nil }

    /// Font weight: 1=bold, 2=italic, 3=bold+italic (field 5).
    var fontWeight: Int32 {
        get { _fontWeight ?? 0 }
        set { _fontWeight = newValue }
    }
    var hasFontWeight: Bool { _fontWeight != nil }
    mutating func clearFontWeight() { _fontWeight = nil }

    /// Underline flag (field 6).
    var underlined: Int32 {
        get { _underlined ?? 0 }
        set { _underlined = newValue }
    }
    var hasUnderlined: Bool { _underlined != nil }
    mutating func clearUnderlined() { _underlined = nil }

    /// Strikethrough flag (field 7).
    var strikethrough: Int32 {
        get { _strikethrough ?? 0 }
        set { _strikethrough = newValue }
    }
    var hasStrikethrough: Bool { _strikethrough != nil }
    mutating func clearStrikethrough() { _strikethrough = nil }

    /// Superscript flag (field 8).
    var superscriptStyle: Int32 {
        get { _superscriptStyle ?? 0 }
        set { _superscriptStyle = newValue }
    }
    var hasSuperscriptStyle: Bool { _superscriptStyle != nil }
    mutating func clearSuperscriptStyle() { _superscriptStyle = nil }

    /// Link URL string (field 9). Internal note links use applenotes:/notes:// schemes.
    var link: String {
        get { _link ?? "" }
        set { _link = newValue }
    }
    var hasLink: Bool { _link != nil }
    mutating func clearLink() { _link = nil }

    /// Text color (field 10).
    var color: NoteColor {
        get { _color ?? NoteColor() }
        set { _color = newValue }
    }
    var hasColor: Bool { _color != nil }
    mutating func clearColor() { _color = nil }

    /// Attachment metadata at U+FFFC positions (field 12).
    var attachmentInfo: NoteAttachmentInfo {
        get { _attachmentInfo ?? NoteAttachmentInfo() }
        set { _attachmentInfo = newValue }
    }
    var hasAttachmentInfo: Bool { _attachmentInfo != nil }
    mutating func clearAttachmentInfo() { _attachmentInfo = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _length: Int32?
    fileprivate var _paragraphStyle: NoteParagraphStyle?
    fileprivate var _font: NoteFont?
    fileprivate var _fontWeight: Int32?
    fileprivate var _underlined: Int32?
    fileprivate var _strikethrough: Int32?
    fileprivate var _superscriptStyle: Int32?
    fileprivate var _link: String?
    fileprivate var _color: NoteColor?
    fileprivate var _attachmentInfo: NoteAttachmentInfo?
}

// MARK: - NoteParagraphStyle

nonisolated struct NoteParagraphStyle: Sendable {
    /// Style type (field 1, default -1):
    /// -1=body, 0=title, 1=heading, 2=subheading, 4=monospaced
    /// 100=dotted, 101=dashed, 102=numbered, 103=checkbox
    var styleType: Int32 {
        get { _styleType ?? -1 }
        set { _styleType = newValue }
    }
    var hasStyleType: Bool { _styleType != nil }
    mutating func clearStyleType() { _styleType = nil }

    /// Text alignment: 0=left, 1=center, 2=right, 3=justified (field 2).
    var alignment: Int32 {
        get { _alignment ?? 0 }
        set { _alignment = newValue }
    }
    var hasAlignment: Bool { _alignment != nil }
    mutating func clearAlignment() { _alignment = nil }

    /// Indent level for nested lists (field 4).
    var indentAmount: Int32 {
        get { _indentAmount ?? 0 }
        set { _indentAmount = newValue }
    }
    var hasIndentAmount: Bool { _indentAmount != nil }
    mutating func clearIndentAmount() { _indentAmount = nil }

    /// Checklist state (field 5).
    var checklist: NoteChecklist {
        get { _checklist ?? NoteChecklist() }
        set { _checklist = newValue }
    }
    var hasChecklist: Bool { _checklist != nil }
    mutating func clearChecklist() { _checklist = nil }

    /// Block quote flag -- non-zero means blockquote (field 8).
    var blockQuote: Int32 {
        get { _blockQuote ?? 0 }
        set { _blockQuote = newValue }
    }
    var hasBlockQuote: Bool { _blockQuote != nil }
    mutating func clearBlockQuote() { _blockQuote = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _styleType: Int32?
    fileprivate var _alignment: Int32?
    fileprivate var _indentAmount: Int32?
    fileprivate var _checklist: NoteChecklist?
    fileprivate var _blockQuote: Int32?
}

// MARK: - NoteChecklist

nonisolated struct NoteChecklist: Sendable {
    /// Checklist item UUID (field 1).
    var uuid: Data {
        get { _uuid ?? Data() }
        set { _uuid = newValue }
    }
    var hasUuid: Bool { _uuid != nil }
    mutating func clearUuid() { _uuid = nil }

    /// Done state: 0=unchecked, 1=checked (field 2).
    var done: Int32 {
        get { _done ?? 0 }
        set { _done = newValue }
    }
    var hasDone: Bool { _done != nil }
    mutating func clearDone() { _done = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _uuid: Data?
    fileprivate var _done: Int32?
}

// MARK: - NoteFont (named to avoid collision with SwiftUI.Font)

nonisolated struct NoteFont: Sendable {
    /// Font name (field 1).
    var fontName: String {
        get { _fontName ?? "" }
        set { _fontName = newValue }
    }
    var hasFontName: Bool { _fontName != nil }
    mutating func clearFontName() { _fontName = nil }

    /// Point size (field 2).
    var pointSize: Float {
        get { _pointSize ?? 0 }
        set { _pointSize = newValue }
    }
    var hasPointSize: Bool { _pointSize != nil }
    mutating func clearPointSize() { _pointSize = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _fontName: String?
    fileprivate var _pointSize: Float?
}

// MARK: - NoteColor (named to avoid collision with SwiftUI.Color)

nonisolated struct NoteColor: Sendable {
    var red: Float { get { _red ?? 0 } set { _red = newValue } }
    var hasRed: Bool { _red != nil }
    var green: Float { get { _green ?? 0 } set { _green = newValue } }
    var hasGreen: Bool { _green != nil }
    var blue: Float { get { _blue ?? 0 } set { _blue = newValue } }
    var hasBlue: Bool { _blue != nil }
    var alpha: Float { get { _alpha ?? 0 } set { _alpha = newValue } }
    var hasAlpha: Bool { _alpha != nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _red: Float?
    fileprivate var _green: Float?
    fileprivate var _blue: Float?
    fileprivate var _alpha: Float?
}

// MARK: - NoteAttachmentInfo

nonisolated struct NoteAttachmentInfo: Sendable {
    /// Attachment identifier -- maps to ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER (field 1).
    var attachmentIdentifier: String {
        get { _attachmentIdentifier ?? "" }
        set { _attachmentIdentifier = newValue }
    }
    var hasAttachmentIdentifier: Bool { _attachmentIdentifier != nil }
    mutating func clearAttachmentIdentifier() { _attachmentIdentifier = nil }

    /// UTI type string, e.g. "public.jpeg", "com.apple.drawing.2" (field 2).
    var typeUti: String {
        get { _typeUti ?? "" }
        set { _typeUti = newValue }
    }
    var hasTypeUti: Bool { _typeUti != nil }
    mutating func clearTypeUti() { _typeUti = nil }

    var unknownFields = SwiftProtobuf.UnknownStorage()

    init() {}

    fileprivate var _attachmentIdentifier: String?
    fileprivate var _typeUti: String?
}

// MARK: - SwiftProtobuf runtime support

nonisolated extension NoteStoreProto: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "NoteStoreProto"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        2: .same(proto: "document"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 2: try { try decoder.decodeSingularMessageField(value: &self._document) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._document {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 2)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteStoreProto, rhs: NoteStoreProto) -> Bool {
        if lhs._document != rhs._document { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteDocument: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "Document"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        2: .same(proto: "version"),
        3: .same(proto: "note"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 2: try { try decoder.decodeSingularInt32Field(value: &self._version) }()
            case 3: try { try decoder.decodeSingularMessageField(value: &self._note) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._version {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 2)
        } }()
        try { if let v = self._note {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 3)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteDocument, rhs: NoteDocument) -> Bool {
        if lhs._version != rhs._version { return false }
        if lhs._note != rhs._note { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteContent: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "Note"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        2: .standard(proto: "note_text"),
        5: .standard(proto: "attribute_run"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 2: try { try decoder.decodeSingularStringField(value: &self._noteText) }()
            case 5: try { try decoder.decodeRepeatedMessageField(value: &self.attributeRun) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._noteText {
            try visitor.visitSingularStringField(value: v, fieldNumber: 2)
        } }()
        if !self.attributeRun.isEmpty {
            try visitor.visitRepeatedMessageField(value: self.attributeRun, fieldNumber: 5)
        }
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteContent, rhs: NoteContent) -> Bool {
        if lhs._noteText != rhs._noteText { return false }
        if lhs.attributeRun != rhs.attributeRun { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteAttributeRun: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "AttributeRun"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .same(proto: "length"),
        2: .standard(proto: "paragraph_style"),
        3: .same(proto: "font"),
        5: .standard(proto: "font_weight"),
        6: .same(proto: "underlined"),
        7: .same(proto: "strikethrough"),
        8: .same(proto: "superscript"),
        9: .same(proto: "link"),
        10: .same(proto: "color"),
        12: .standard(proto: "attachment_info"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularInt32Field(value: &self._length) }()
            case 2: try { try decoder.decodeSingularMessageField(value: &self._paragraphStyle) }()
            case 3: try { try decoder.decodeSingularMessageField(value: &self._font) }()
            case 5: try { try decoder.decodeSingularInt32Field(value: &self._fontWeight) }()
            case 6: try { try decoder.decodeSingularInt32Field(value: &self._underlined) }()
            case 7: try { try decoder.decodeSingularInt32Field(value: &self._strikethrough) }()
            case 8: try { try decoder.decodeSingularInt32Field(value: &self._superscriptStyle) }()
            case 9: try { try decoder.decodeSingularStringField(value: &self._link) }()
            case 10: try { try decoder.decodeSingularMessageField(value: &self._color) }()
            case 12: try { try decoder.decodeSingularMessageField(value: &self._attachmentInfo) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._length {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._paragraphStyle {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 2)
        } }()
        try { if let v = self._font {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 3)
        } }()
        try { if let v = self._fontWeight {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 5)
        } }()
        try { if let v = self._underlined {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 6)
        } }()
        try { if let v = self._strikethrough {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 7)
        } }()
        try { if let v = self._superscriptStyle {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 8)
        } }()
        try { if let v = self._link {
            try visitor.visitSingularStringField(value: v, fieldNumber: 9)
        } }()
        try { if let v = self._color {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 10)
        } }()
        try { if let v = self._attachmentInfo {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 12)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteAttributeRun, rhs: NoteAttributeRun) -> Bool {
        if lhs._length != rhs._length { return false }
        if lhs._paragraphStyle != rhs._paragraphStyle { return false }
        if lhs._font != rhs._font { return false }
        if lhs._fontWeight != rhs._fontWeight { return false }
        if lhs._underlined != rhs._underlined { return false }
        if lhs._strikethrough != rhs._strikethrough { return false }
        if lhs._superscriptStyle != rhs._superscriptStyle { return false }
        if lhs._link != rhs._link { return false }
        if lhs._color != rhs._color { return false }
        if lhs._attachmentInfo != rhs._attachmentInfo { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteParagraphStyle: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "ParagraphStyle"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .standard(proto: "style_type"),
        2: .same(proto: "alignment"),
        4: .standard(proto: "indent_amount"),
        5: .same(proto: "checklist"),
        8: .standard(proto: "block_quote"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularInt32Field(value: &self._styleType) }()
            case 2: try { try decoder.decodeSingularInt32Field(value: &self._alignment) }()
            case 4: try { try decoder.decodeSingularInt32Field(value: &self._indentAmount) }()
            case 5: try { try decoder.decodeSingularMessageField(value: &self._checklist) }()
            case 8: try { try decoder.decodeSingularInt32Field(value: &self._blockQuote) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._styleType {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._alignment {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 2)
        } }()
        try { if let v = self._indentAmount {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 4)
        } }()
        try { if let v = self._checklist {
            try visitor.visitSingularMessageField(value: v, fieldNumber: 5)
        } }()
        try { if let v = self._blockQuote {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 8)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteParagraphStyle, rhs: NoteParagraphStyle) -> Bool {
        if lhs._styleType != rhs._styleType { return false }
        if lhs._alignment != rhs._alignment { return false }
        if lhs._indentAmount != rhs._indentAmount { return false }
        if lhs._checklist != rhs._checklist { return false }
        if lhs._blockQuote != rhs._blockQuote { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteChecklist: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "Checklist"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .same(proto: "uuid"),
        2: .same(proto: "done"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularBytesField(value: &self._uuid) }()
            case 2: try { try decoder.decodeSingularInt32Field(value: &self._done) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._uuid {
            try visitor.visitSingularBytesField(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._done {
            try visitor.visitSingularInt32Field(value: v, fieldNumber: 2)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteChecklist, rhs: NoteChecklist) -> Bool {
        if lhs._uuid != rhs._uuid { return false }
        if lhs._done != rhs._done { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteFont: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "Font"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .standard(proto: "font_name"),
        2: .standard(proto: "point_size"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularStringField(value: &self._fontName) }()
            case 2: try { try decoder.decodeSingularFloatField(value: &self._pointSize) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._fontName {
            try visitor.visitSingularStringField(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._pointSize {
            try visitor.visitSingularFloatField(value: v, fieldNumber: 2)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteFont, rhs: NoteFont) -> Bool {
        if lhs._fontName != rhs._fontName { return false }
        if lhs._pointSize != rhs._pointSize { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteColor: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "Color"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .same(proto: "red"),
        2: .same(proto: "green"),
        3: .same(proto: "blue"),
        4: .same(proto: "alpha"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularFloatField(value: &self._red) }()
            case 2: try { try decoder.decodeSingularFloatField(value: &self._green) }()
            case 3: try { try decoder.decodeSingularFloatField(value: &self._blue) }()
            case 4: try { try decoder.decodeSingularFloatField(value: &self._alpha) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._red {
            try visitor.visitSingularFloatField(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._green {
            try visitor.visitSingularFloatField(value: v, fieldNumber: 2)
        } }()
        try { if let v = self._blue {
            try visitor.visitSingularFloatField(value: v, fieldNumber: 3)
        } }()
        try { if let v = self._alpha {
            try visitor.visitSingularFloatField(value: v, fieldNumber: 4)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteColor, rhs: NoteColor) -> Bool {
        if lhs._red != rhs._red { return false }
        if lhs._green != rhs._green { return false }
        if lhs._blue != rhs._blue { return false }
        if lhs._alpha != rhs._alpha { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}

nonisolated extension NoteAttachmentInfo: SwiftProtobuf.Message, SwiftProtobuf._MessageImplementationBase, SwiftProtobuf._ProtoNameProviding {
    static let protoMessageName: String = "AttachmentInfo"
    static let _protobuf_nameMap: SwiftProtobuf._NameMap = [
        1: .standard(proto: "attachment_identifier"),
        2: .standard(proto: "type_uti"),
    ]

    mutating func decodeMessage<D: SwiftProtobuf.Decoder>(decoder: inout D) throws {
        while let fieldNumber = try decoder.nextFieldNumber() {
            switch fieldNumber {
            case 1: try { try decoder.decodeSingularStringField(value: &self._attachmentIdentifier) }()
            case 2: try { try decoder.decodeSingularStringField(value: &self._typeUti) }()
            default: break
            }
        }
    }

    func traverse<V: SwiftProtobuf.Visitor>(visitor: inout V) throws {
        try { if let v = self._attachmentIdentifier {
            try visitor.visitSingularStringField(value: v, fieldNumber: 1)
        } }()
        try { if let v = self._typeUti {
            try visitor.visitSingularStringField(value: v, fieldNumber: 2)
        } }()
        try unknownFields.traverse(visitor: &visitor)
    }

    static func ==(lhs: NoteAttachmentInfo, rhs: NoteAttachmentInfo) -> Bool {
        if lhs._attachmentIdentifier != rhs._attachmentIdentifier { return false }
        if lhs._typeUti != rhs._typeUti { return false }
        if lhs.unknownFields != rhs.unknownFields { return false }
        return true
    }
}
