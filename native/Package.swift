// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Isometry",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "Isometry",
            targets: ["Isometry"]
        ),
        .executable(
            name: "IsometryApp",
            targets: ["IsometryApp"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"),
    ],
    targets: [
        .target(
            name: "Isometry",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ],
            resources: [
                .process("Resources")
            ]
        ),
        .executableTarget(
            name: "IsometryApp",
            dependencies: ["Isometry"],
            path: "IsometryApp"
        ),
        .testTarget(
            name: "IsometryTests",
            dependencies: ["Isometry"]
        ),
        .testTarget(
            name: "IsometryUITestsiOS",
            dependencies: ["Isometry"],
            path: "Tests/UI/iOS"
        ),
        .testTarget(
            name: "IsometryUITestsmacOS",
            dependencies: ["Isometry"],
            path: "Tests/UI/macOS"
        ),
        .testTarget(
            name: "IsometryPerformanceTests",
            dependencies: ["Isometry"],
            path: "Tests/Performance"
        ),
    ]
)
