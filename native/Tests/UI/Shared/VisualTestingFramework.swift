import XCTest
import SwiftUI

#if canImport(UIKit)
import UIKit
typealias PlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
typealias PlatformImage = NSImage
#endif

/// Visual testing framework for automated screenshot comparison
@MainActor
class VisualTestingFramework {

    /// Tolerance for image comparison (0.0 = perfect match, 1.0 = any match)
    static let defaultTolerance: Float = 0.02

    /// Reference images directory
    static let referenceImagesPath = "ReferenceImages"

    /// Failed comparison images directory
    static let failureImagesPath = "FailureImages"

    /// Compare current view with reference screenshot
    /// - Parameters:
    ///   - view: SwiftUI view to capture
    ///   - identifier: Unique test identifier
    ///   - tolerance: Comparison tolerance (default: 0.02)
    ///   - file: Test file (automatically filled)
    ///   - line: Test line (automatically filled)
    /// - Returns: True if images match within tolerance
    static func verifySnapshot<Content: View>(
        of view: Content,
        identifier: String,
        tolerance: Float = defaultTolerance,
        file: StaticString = #file,
        line: UInt = #line
    ) -> Bool {
        let currentImage = captureSnapshot(of: view)
        let referenceImage = loadReferenceImage(identifier: identifier)

        if let referenceImage = referenceImage {
            let matches = compareImages(
                current: currentImage,
                reference: referenceImage,
                tolerance: tolerance
            )

            if !matches {
                saveFailureImages(
                    current: currentImage,
                    reference: referenceImage,
                    identifier: identifier
                )
                XCTFail("Snapshot comparison failed for \(identifier)", file: file, line: line)
            }

            return matches
        } else {
            // No reference image exists, save current as reference
            saveReferenceImage(currentImage, identifier: identifier)
            XCTFail("No reference image found for \(identifier). Saved current image as reference.", file: file, line: line)
            return false
        }
    }

    /// Capture screenshot of SwiftUI view
    private static func captureSnapshot<Content: View>(of view: Content) -> PlatformImage {
        #if canImport(UIKit)
        let controller = UIHostingController(rootView: view)
        let size = controller.view.intrinsicContentSize
        controller.view.frame = CGRect(origin: .zero, size: size)
        controller.view.layoutIfNeeded()

        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            controller.view.layer.render(in: context.cgContext)
        }
        #elseif canImport(AppKit)
        let controller = NSHostingController(rootView: view)
        let size = controller.view.intrinsicContentSize
        controller.view.frame = CGRect(origin: .zero, size: size)

        let imageRep = controller.view.bitmapImageRepForCachingDisplay(in: controller.view.bounds)!
        controller.view.cacheDisplay(in: controller.view.bounds, to: imageRep)

        let image = NSImage(size: size)
        image.addRepresentation(imageRep)
        return image
        #endif
    }

    /// Load reference image from disk
    private static func loadReferenceImage(identifier: String) -> PlatformImage? {
        let bundle = Bundle.module
        guard let path = bundle.path(forResource: identifier, ofType: "png", inDirectory: referenceImagesPath) else {
            return nil
        }

        #if canImport(UIKit)
        return UIImage(contentsOfFile: path)
        #elseif canImport(AppKit)
        return NSImage(contentsOfFile: path)
        #endif
    }

    /// Compare two images with tolerance
    private static func compareImages(
        current: PlatformImage,
        reference: PlatformImage,
        tolerance: Float
    ) -> Bool {
        #if canImport(UIKit)
        guard let currentCGImage = current.cgImage,
              let referenceCGImage = reference.cgImage else {
            return false
        }
        #elseif canImport(AppKit)
        guard let currentCGImage = current.cgImage(forProposedRect: nil, context: nil, hints: nil),
              let referenceCGImage = reference.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return false
        }
        #endif

        return ImageComparison.compare(
            currentCGImage,
            referenceCGImage,
            tolerance: tolerance
        )
    }

    /// Save reference image to disk
    private static func saveReferenceImage(_ image: PlatformImage, identifier: String) {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let referencePath = documentsPath.appendingPathComponent(referenceImagesPath)

        try? FileManager.default.createDirectory(at: referencePath, withIntermediateDirectories: true)

        let filePath = referencePath.appendingPathComponent("\(identifier).png")

        #if canImport(UIKit)
        if let data = image.pngData() {
            try? data.write(to: filePath)
        }
        #elseif canImport(AppKit)
        if let tiffData = image.tiffRepresentation,
           let bitmapImage = NSBitmapImageRep(data: tiffData) {
            let pngData = bitmapImage.representation(using: .png, properties: [:])
            try? pngData?.write(to: filePath)
        }
        #endif
    }

    /// Save failure comparison images
    private static func saveFailureImages(
        current: PlatformImage,
        reference: PlatformImage,
        identifier: String
    ) {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let failurePath = documentsPath.appendingPathComponent(failureImagesPath)

        try? FileManager.default.createDirectory(at: failurePath, withIntermediateDirectories: true)

        let currentPath = failurePath.appendingPathComponent("\(identifier)_current.png")
        let referencePath = failurePath.appendingPathComponent("\(identifier)_reference.png")

        #if canImport(UIKit)
        try? current.pngData()?.write(to: currentPath)
        try? reference.pngData()?.write(to: referencePath)
        #elseif canImport(AppKit)
        if let currentData = current.tiffRepresentation,
           let currentBitmap = NSBitmapImageRep(data: currentData) {
            try? currentBitmap.representation(using: .png, properties: [:])?.write(to: currentPath)
        }

        if let refData = reference.tiffRepresentation,
           let refBitmap = NSBitmapImageRep(data: refData) {
            try? refBitmap.representation(using: .png, properties: [:])?.write(to: referencePath)
        }
        #endif
    }
}

/// Low-level image comparison utilities
struct ImageComparison {

    /// Compare two CGImages pixel by pixel with tolerance
    static func compare(
        _ image1: CGImage,
        _ image2: CGImage,
        tolerance: Float
    ) -> Bool {
        // Quick size check
        guard image1.width == image2.width && image1.height == image2.height else {
            return false
        }

        let width = image1.width
        let height = image1.height
        let totalPixels = width * height

        // Create pixel data contexts
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bytesPerPixel = 4
        let bytesPerRow = bytesPerPixel * width

        var data1 = [UInt8](repeating: 0, count: totalPixels * bytesPerPixel)
        var data2 = [UInt8](repeating: 0, count: totalPixels * bytesPerPixel)

        let context1 = CGContext(
            data: &data1,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )

        let context2 = CGContext(
            data: &data2,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )

        guard let context1 = context1, let context2 = context2 else {
            return false
        }

        context1.draw(image1, in: CGRect(x: 0, y: 0, width: width, height: height))
        context2.draw(image2, in: CGRect(x: 0, y: 0, width: width, height: height))

        // Compare pixels
        var differentPixels = 0
        for i in 0..<totalPixels {
            let offset = i * bytesPerPixel
            let r1 = data1[offset]
            let g1 = data1[offset + 1]
            let b1 = data1[offset + 2]
            let a1 = data1[offset + 3]

            let r2 = data2[offset]
            let g2 = data2[offset + 1]
            let b2 = data2[offset + 2]
            let a2 = data2[offset + 3]

            // Calculate pixel difference
            let rDiff = abs(Int(r1) - Int(r2))
            let gDiff = abs(Int(g1) - Int(g2))
            let bDiff = abs(Int(b1) - Int(b2))
            let aDiff = abs(Int(a1) - Int(a2))

            let pixelDiff = max(rDiff, gDiff, bDiff, aDiff)

            if pixelDiff > Int(tolerance * 255) {
                differentPixels += 1
            }
        }

        let differenceRatio = Float(differentPixels) / Float(totalPixels)
        return differenceRatio <= tolerance
    }
}

/// Device-specific test configurations
struct TestConfiguration {
    let name: String
    let size: CGSize
    let scale: CGFloat

    #if canImport(UIKit)
    static let iPhone13 = TestConfiguration(name: "iPhone13", size: CGSize(width: 390, height: 844), scale: 3.0)
    static let iPhone15ProMax = TestConfiguration(name: "iPhone15ProMax", size: CGSize(width: 430, height: 932), scale: 3.0)
    static let iPadAir = TestConfiguration(name: "iPadAir", size: CGSize(width: 820, height: 1180), scale: 2.0)
    static let iPadPro = TestConfiguration(name: "iPadPro", size: CGSize(width: 1024, height: 1366), scale: 2.0)
    #endif

    #if canImport(AppKit)
    static let macBook13 = TestConfiguration(name: "MacBook13", size: CGSize(width: 1280, height: 800), scale: 2.0)
    static let macBook16 = TestConfiguration(name: "MacBook16", size: CGSize(width: 1728, height: 1117), scale: 2.0)
    static let iMac24 = TestConfiguration(name: "iMac24", size: CGSize(width: 2560, height: 1440), scale: 2.0)
    #endif
}