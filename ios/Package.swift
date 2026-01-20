// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "IsometryiOS",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .executable(
            name: "IsometryiOS",
            targets: ["IsometryiOS"]
        ),
    ],
    dependencies: [
        .package(path: "../native"),
    ],
    targets: [
        .executableTarget(
            name: "IsometryiOS",
            dependencies: [
                .product(name: "Isometry", package: "native"),
            ],
            path: "Sources/IsometryApp"
        ),
    ]
)
