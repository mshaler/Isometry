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
            name: "IsometryCore",
            targets: ["IsometryCore"]
        ),
        .library(
            name: "Isometry",
            targets: ["Isometry"]
        ),
        .library(
            name: "IsometryAPI",
            targets: ["IsometryAPI"]
        ),
        .executable(
            name: "IsometryApp",
            targets: ["IsometryApp"]
        ),
        .executable(
            name: "IsometryAPIServer",
            targets: ["IsometryAPIServer"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0"),
        .package(url: "https://github.com/vapor/vapor.git", from: "4.89.0"),
        .package(url: "https://github.com/ZipArchive/ZipArchive.git", from: "2.5.5"),
        .package(url: "https://github.com/fumoboy007/msgpack-swift", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "IsometryCore",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
        .target(
            name: "Isometry",
            dependencies: [
                "IsometryCore",
                .product(name: "GRDB", package: "GRDB.swift"),
                .product(name: "ZipArchive", package: "ZipArchive"),
                .product(name: "DMMessagePack", package: "msgpack-swift"),
            ],
            resources: [
                .process("Resources")
            ]
        ),
        .target(
            name: "IsometryAPI",
            dependencies: [
                "Isometry",
                "IsometryCore",
                .product(name: "Vapor", package: "vapor"),
                .product(name: "GRDB", package: "GRDB.swift"),
            ]
        ),
        .executableTarget(
            name: "IsometryApp",
            dependencies: ["Isometry"],
            path: "IsometryApp"
        ),
        .executableTarget(
            name: "IsometryAPIServer",
            dependencies: [
                "IsometryAPI",
                "Isometry",
                "IsometryCore"
            ],
            path: "Sources/IsometryAPIServer"
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
    ]
)
