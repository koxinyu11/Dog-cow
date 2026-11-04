// Run from the repository root: swift scripts/build-icons.swift
// Keep the original artwork separate so rebuilding never adds another layer of padding.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets")
let sourceURL = assets.appendingPathComponent("狗牛-source.png")
let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("dogcow-icons-\(UUID().uuidString)")

func png(_ image: CGImage) throws -> Data {
    let data = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "DogCowIcon", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法创建 PNG 编码器。"])
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "DogCowIcon", code: 2, userInfo: [NSLocalizedDescriptionKey: "PNG 编码失败。"])
    }
    return data as Data
}

func render(_ source: CGImage, size: Int, framed: Bool) throws -> CGImage {
    guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                  bytesPerRow: size * 4, space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw NSError(domain: "DogCowIcon", code: 3, userInfo: [NSLocalizedDescriptionKey: "无法创建图标画布。"])
    }
    let bounds = CGRect(x: 0, y: 0, width: size, height: size)
    context.clear(bounds)
    context.interpolationQuality = .high
    if framed {
        // 824px artwork on a 1024px canvas, with transparent optical margins.
        let inset = CGFloat(size) * 100 / 1024
        let artwork = bounds.insetBy(dx: inset, dy: inset)
        let radius = artwork.width / 4
        context.addPath(CGPath(roundedRect: artwork, cornerWidth: radius, cornerHeight: radius, transform: nil))
        context.clip()
        context.draw(source, in: artwork)
    } else {
        context.draw(source, in: bounds)
    }
    guard let image = context.makeImage() else {
        throw NSError(domain: "DogCowIcon", code: 4, userInfo: [NSLocalizedDescriptionKey: "图标渲染失败。"])
    }
    return image
}

func littleEndian(_ value: UInt32, bytes: Int) -> Data {
    Data((0..<bytes).map { UInt8((value >> ($0 * 8)) & 255) })
}

do {
    guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
          let artwork = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "DogCowIcon", code: 5, userInfo: [NSLocalizedDescriptionKey: "无法读取原始狗牛素材。"])
    }
    try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: temporary) }
    let iconset = temporary.appendingPathComponent("狗牛.iconset")
    try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
    let master = try render(artwork, size: 1024, framed: true)
    let masterPNG = try png(master)
    for size in [16, 32, 128, 256, 512] {
        for scale in [1, 2] {
            let suffix = scale == 2 ? "@2x" : ""
            let filename = "icon_\(size)x\(size)\(suffix).png"
            try png(render(master, size: size * scale, framed: false)).write(to: iconset.appendingPathComponent(filename))
        }
    }
    let icns = temporary.appendingPathComponent("狗牛.icns")
    let convert = Process()
    convert.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
    convert.arguments = ["-c", "icns", iconset.path, "-o", icns.path]
    try convert.run()
    convert.waitUntilExit()
    guard convert.terminationStatus == 0 else {
        throw NSError(domain: "DogCowIcon", code: 6, userInfo: [NSLocalizedDescriptionKey: "ICNS 导出失败。"])
    }
    // Modern Windows ICO supports PNG frames, preserving the same alpha edges at every size.
    let sizes = [16, 24, 32, 48, 64, 128, 256]
    let frames = try sizes.map { try png(render(master, size: $0, framed: false)) }
    var ico = Data([0, 0, 1, 0])
    ico.append(littleEndian(UInt32(sizes.count), bytes: 2))
    var offset = UInt32(6 + sizes.count * 16)
    for (size, frame) in zip(sizes, frames) {
        let edge: UInt8 = size == 256 ? 0 : UInt8(size)
        ico.append(contentsOf: [edge, edge, 0, 0])
        ico.append(littleEndian(1, bytes: 2))
        ico.append(littleEndian(32, bytes: 2))
        ico.append(littleEndian(UInt32(frame.count), bytes: 4))
        ico.append(littleEndian(offset, bytes: 4))
        offset += UInt32(frame.count)
    }
    for frame in frames { ico.append(frame) }
    let icnsData = try Data(contentsOf: icns)
    try masterPNG.write(to: assets.appendingPathComponent("狗牛.png"), options: .atomic)
    try icnsData.write(to: assets.appendingPathComponent("狗牛.icns"), options: .atomic)
    try ico.write(to: assets.appendingPathComponent("狗牛.ico"), options: .atomic)
    print("已生成狗牛 PNG / ICNS / ICO，包含透明圆角和四周留白。")
} catch {
    fputs("图标生成失败：\(error.localizedDescription)\n", stderr)
    exit(1)
}
