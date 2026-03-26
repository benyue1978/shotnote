import Foundation
import Photos

enum HelperError: Error, CustomStringConvertible {
    case invalidArguments
    case authorizationDenied
    case screenshotsCollectionNotFound
    case resourceWriteFailed(String)

    var description: String {
        switch self {
        case .invalidArguments:
            return "Usage: export-smart-screenshots <export-directory> [limit] [since-iso]"
        case .authorizationDenied:
            return "Photo library access was denied."
        case .screenshotsCollectionNotFound:
            return "The Photos Screenshots smart album was not found."
        case .resourceWriteFailed(let message):
            return message
        }
    }
}

let timestampFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}()

func requestAuthorization(completion: @escaping (Result<Void, Error>) -> Void) {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if status == .authorized || status == .limited {
        completion(.success(()))
        return
    }

    PHPhotoLibrary.requestAuthorization(for: .readWrite) { newStatus in
        if newStatus == .authorized || newStatus == .limited {
            completion(.success(()))
        } else {
            completion(.failure(HelperError.authorizationDenied))
        }
    }
}

func exportScreenshots(to exportDirectory: URL, limit: Int?, since: Date?, completion: @escaping (Result<Void, Error>) -> Void) {
    requestAuthorization { authorizationResult in
        switch authorizationResult {
        case .failure(let error):
            completion(.failure(error))
        case .success:
            let collections = PHAssetCollection.fetchAssetCollections(
                with: .smartAlbum,
                subtype: .smartAlbumScreenshots,
                options: nil
            )

            guard let screenshotsCollection = collections.firstObject else {
                completion(.failure(HelperError.screenshotsCollectionNotFound))
                return
            }

            let fetchOptions = PHFetchOptions()
            fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            let assets = PHAsset.fetchAssets(in: screenshotsCollection, options: fetchOptions)
            let resourceManager = PHAssetResourceManager.default()
            let fileManager = FileManager.default
            var exportedPaths: [String] = []

            do {
                try fileManager.createDirectory(at: exportDirectory, withIntermediateDirectories: true)
            } catch {
                completion(.failure(error))
                return
            }

            let options = PHAssetResourceRequestOptions()
            options.isNetworkAccessAllowed = true

            let group = DispatchGroup()
            var firstError: Error?

            var selectedAssets: [PHAsset] = []
            let maxCount = limit.map { max($0, 0) }.flatMap { $0 == 0 ? nil : $0 }

            assets.enumerateObjects { asset, _, stop in
                if let since, let creationDate = asset.creationDate, creationDate <= since {
                    stop.pointee = true
                    return
                }

                selectedAssets.append(asset)

                if let maxCount, selectedAssets.count >= maxCount {
                    stop.pointee = true
                }
            }

            for asset in selectedAssets {
                guard let resource = PHAssetResource.assetResources(for: asset).first(where: { $0.type == .photo }) ??
                        PHAssetResource.assetResources(for: asset).first else {
                    continue
                }

                let destinationURL = exportDirectory.appendingPathComponent(resource.originalFilename)
                group.enter()
                resourceManager.writeData(for: resource, toFile: destinationURL, options: options) { error in
                    if let error, firstError == nil {
                        firstError = HelperError.resourceWriteFailed(error.localizedDescription)
                    } else {
                        let discoveredAt = asset.creationDate.map { timestampFormatter.string(from: $0) } ?? ""
                        exportedPaths.append("\(destinationURL.path)\t\(discoveredAt)")
                    }
                    group.leave()
                }
            }

            group.notify(queue: DispatchQueue.global()) {
                if let firstError {
                    completion(.failure(firstError))
                } else {
                    FileHandle.standardOutput.write(exportedPaths.sorted().joined(separator: "\n").data(using: .utf8) ?? Data())
                    completion(.success(()))
                }
            }
        }
    }
}

guard CommandLine.arguments.count >= 3,
      CommandLine.arguments[1] == "export-screenshots" else {
    FileHandle.standardError.write((HelperError.invalidArguments.description + "\n").data(using: .utf8) ?? Data())
    exit(1)
}

let semaphore = DispatchSemaphore(value: 0)
let exportDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let limit = CommandLine.arguments.count >= 4 ? Int(CommandLine.arguments[3]) : nil
let sinceFormatter = ISO8601DateFormatter()
sinceFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
let since = CommandLine.arguments.count >= 5 ? sinceFormatter.date(from: CommandLine.arguments[4]) : nil

exportScreenshots(to: exportDirectory, limit: limit, since: since) { result in
    if case .failure(let error) = result {
        let message: String
        if let helperError = error as? HelperError {
            message = helperError.description
        } else {
            message = error.localizedDescription
        }
        FileHandle.standardError.write((message + "\n").data(using: .utf8) ?? Data())
        fflush(stderr)
        semaphore.signal()
        exit(1)
    }

    semaphore.signal()
}

semaphore.wait()
