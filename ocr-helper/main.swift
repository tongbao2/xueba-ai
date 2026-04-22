import Vision
import Foundation

guard CommandLine.arguments.count >= 2 else {
    print("Usage: ocr-helper <image-path>")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let fileURL = URL(fileURLWithPath: imagePath)

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(url: fileURL, options: [:])
do {
    try handler.perform([request])
} catch {
    print("[ERROR] OCR failed: \(error.localizedDescription)")
    exit(1)
}

guard let observations = request.results, !observations.isEmpty else {
    print("[INFO] No text detected")
    exit(0)
}

for observation in observations {
    if let candidate = observation.topCandidates(1).first {
        print(candidate.string)
    }
}
