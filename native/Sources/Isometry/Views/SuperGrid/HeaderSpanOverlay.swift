import SwiftUI

/// Visual overlay that renders header spans in SuperGrid
/// Provides the signature "stacked headers" functionality from CardBoard v1/v2
public struct HeaderSpanOverlay: View {
    let spans: [HeaderSpan]
    let orientation: Orientation
    let cellSize: CGFloat
    let getCumulativeOffset: (Int) -> CGFloat

    public enum Orientation {
        case horizontal
        case vertical
    }

    public init(
        spans: [HeaderSpan],
        orientation: Orientation,
        cellSize: CGFloat,
        getCumulativeOffset: @escaping (Int) -> CGFloat
    ) {
        self.spans = spans
        self.orientation = orientation
        self.cellSize = cellSize
        self.getCumulativeOffset = getCumulativeOffset
    }

    public var body: some View {
        ZStack {
            ForEach(spans) { span in
                HeaderSpanView(
                    span: span,
                    orientation: orientation,
                    cellSize: cellSize,
                    getCumulativeOffset: getCumulativeOffset
                )
            }
        }
    }
}

/// Individual header span view component
struct HeaderSpanView: View {
    let span: HeaderSpan
    let orientation: HeaderSpanOverlay.Orientation
    let cellSize: CGFloat
    let getCumulativeOffset: (Int) -> CGFloat

    private var spanFrame: CGRect {
        let startOffset = getCumulativeOffset(span.startIndex)
        let endOffset = getCumulativeOffset(span.endIndex + 1)
        let spanSize = endOffset - startOffset

        switch orientation {
        case .horizontal:
            return CGRect(
                x: startOffset,
                y: CGFloat(span.dimensionIndex) * cellSize,
                width: spanSize,
                height: cellSize
            )
        case .vertical:
            return CGRect(
                x: CGFloat(span.dimensionIndex) * cellSize,
                y: startOffset,
                width: cellSize,
                height: spanSize
            )
        }
    }

    private var textPosition: CGPoint {
        let frame = spanFrame
        switch orientation {
        case .horizontal:
            return CGPoint(x: frame.midX, y: frame.midY)
        case .vertical:
            return CGPoint(x: frame.minX + 12, y: frame.midY)
        }
    }

    var body: some View {
        ZStack {
            // Background rectangle
            Rectangle()
                .fill(Color(red: 0.97, green: 0.97, blue: 0.97, opacity: 0.95))
                .stroke(Color.gray.opacity(0.4), lineWidth: 1)
                .frame(width: spanFrame.width, height: spanFrame.height)

            // Header text
            Text(span.value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.primary)
                .multilineTextAlignment(orientation == .horizontal ? .center : .leading)
        }
        .position(x: spanFrame.midX, y: spanFrame.midY)
        .accessibilityLabel("Header span: \(span.value)")
        .accessibilityIdentifier("header-span-\(span.dimensionIndex)-\(span.startIndex)")
    }
}

/// SwiftUI Canvas-based header span renderer for high performance
/// Alternative implementation using Canvas for complex grids
public struct CanvasHeaderSpanOverlay: View {
    let spans: [HeaderSpan]
    let orientation: HeaderSpanOverlay.Orientation
    let cellSize: CGFloat
    let getCumulativeOffset: (Int) -> CGFloat

    public init(
        spans: [HeaderSpan],
        orientation: HeaderSpanOverlay.Orientation,
        cellSize: CGFloat,
        getCumulativeOffset: @escaping (Int) -> CGFloat
    ) {
        self.spans = spans
        self.orientation = orientation
        self.cellSize = cellSize
        self.getCumulativeOffset = getCumulativeOffset
    }

    public var body: some View {
        Canvas { context, size in
            for span in spans {
                drawHeaderSpan(span, in: context, canvasSize: size)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func drawHeaderSpan(_ span: HeaderSpan, in context: GraphicsContext, canvasSize: CGSize) {
        let startOffset = getCumulativeOffset(span.startIndex)
        let endOffset = getCumulativeOffset(span.endIndex + 1)
        let spanSize = endOffset - startOffset

        let frame: CGRect
        let textCenter: CGPoint

        switch orientation {
        case .horizontal:
            frame = CGRect(
                x: startOffset,
                y: CGFloat(span.dimensionIndex) * cellSize,
                width: spanSize,
                height: cellSize
            )
            textCenter = CGPoint(x: frame.midX, y: frame.midY)

        case .vertical:
            frame = CGRect(
                x: CGFloat(span.dimensionIndex) * cellSize,
                y: startOffset,
                width: cellSize,
                height: spanSize
            )
            textCenter = CGPoint(x: frame.minX + 12, y: frame.midY)
        }

        // Draw background
        let path = Path(frame)
        context.fill(path, with: .color(.init(red: 0.97, green: 0.97, blue: 0.97, opacity: 0.95)))
        context.stroke(path, with: .color(.gray.opacity(0.4)), lineWidth: 1)

        // Draw text
        let text = Text(span.value)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.primary)

        context.draw(text, at: textCenter, anchor: .center)
    }
}

#if DEBUG
/// Preview support for header span overlay
struct HeaderSpanOverlay_Previews: PreviewProvider {
    static var previews: some View {
        let (combinations, dimensions) = HeaderSpanCalculator.sampleCombinations()
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        VStack {
            HeaderSpanOverlay(
                spans: spans,
                orientation: .horizontal,
                cellSize: 40
            ) { index in
                CGFloat(index * 120) // Sample offset calculation
            }
            .frame(height: 120)
            .background(Color.gray.opacity(0.1))

            Spacer().frame(height: 20)

            CanvasHeaderSpanOverlay(
                spans: spans,
                orientation: .vertical,
                cellSize: 40
            ) { index in
                CGFloat(index * 80) // Sample offset calculation
            }
            .frame(width: 120)
            .background(Color.gray.opacity(0.1))
        }
        .padding()
        .previewDisplayName("Header Span Overlays")
    }
}
#endif