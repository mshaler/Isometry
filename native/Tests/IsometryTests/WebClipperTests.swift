import XCTest
@testable import Isometry
import Foundation

final class WebClipperTests: XCTestCase {

    func testMetadataExtraction() async throws {
        let metadataExtractor = MetadataExtractor()

        let sampleHTML = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sample Web Page</title>
            <meta name="description" content="This is a sample web page for testing">
            <meta property="og:title" content="Open Graph Title">
            <meta property="og:description" content="Open Graph Description">
            <meta name="twitter:card" content="summary">
            <meta name="twitter:title" content="Twitter Title">
        </head>
        <body>
            <h1>Main Content</h1>
            <p>This is the main content of the page.</p>
        </body>
        </html>
        """

        let url = URL(string: "https://example.com")!
        let metadata = await metadataExtractor.extractMetadata(from: sampleHTML, url: url)

        XCTAssertEqual(metadata.title, "Open Graph Title")
        XCTAssertEqual(metadata.description, "Open Graph Description")
        XCTAssertEqual(metadata.ogTitle, "Open Graph Title")
        XCTAssertEqual(metadata.ogDescription, "Open Graph Description")
        XCTAssertEqual(metadata.twitterCard, "summary")
        XCTAssertEqual(metadata.twitterTitle, "Twitter Title")
    }

    func testReadabilityContentExtraction() async throws {
        let readabilityEngine = ReadabilityEngine()

        let sampleHTML = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sample Article</title>
        </head>
        <body>
            <nav>Navigation menu</nav>
            <aside class="sidebar">Advertisement</aside>
            <article>
                <h1>Article Title</h1>
                <p>This is the main article content that should be extracted.</p>
                <p>This is a second paragraph with <strong>important</strong> text.</p>
            </article>
            <footer>Footer content</footer>
        </body>
        </html>
        """

        let url = URL(string: "https://example.com")!
        let cleanContent = await readabilityEngine.extractContent(from: sampleHTML, url: url)

        XCTAssertTrue(cleanContent.contains("Article Title"))
        XCTAssertTrue(cleanContent.contains("main article content"))
        XCTAssertTrue(cleanContent.contains("**important**"))
        XCTAssertFalse(cleanContent.contains("Navigation menu"))
        XCTAssertFalse(cleanContent.contains("Advertisement"))
        XCTAssertFalse(cleanContent.contains("Footer content"))
    }

    func testWebPageMetadataStructure() throws {
        let metadata = WebPageMetadata(
            title: "Test Title",
            description: "Test Description",
            imageUrl: "https://example.com/image.jpg",
            tags: ["test", "web", "clipper"]
        )

        XCTAssertEqual(metadata.title, "Test Title")
        XCTAssertEqual(metadata.description, "Test Description")
        XCTAssertEqual(metadata.imageUrl, "https://example.com/image.jpg")
        XCTAssertEqual(metadata.tags, ["test", "web", "clipper"])
    }

    func testImportResultCombining() throws {
        var result1 = ImportResult()
        result1.imported = 2
        result1.failed = 1

        var result2 = ImportResult()
        result2.imported = 3
        result2.failed = 0

        let combined = ImportResult.combine([result1, result2])

        XCTAssertEqual(combined.imported, 5)
        XCTAssertEqual(combined.failed, 1)
        XCTAssertEqual(combined.total, 6)
    }
}