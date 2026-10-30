// Record one process's sound to a WAV file until SIGINT or SIGTERM.
//
//   sim-audio <pid> out.wav
//
// simctl recordVideo has no audio, so recordings pair it with this. Simulator apps run as Mac
// processes, so a Core Audio process tap hears exactly the app: nothing is rerouted, no audio
// driver is needed, and you still hear it. The terminal needs "Screen & System Audio
// Recording" permission. Prints "started <unix time>" with the wall-clock time of the first
// sample, for lining the audio up with the video.
import AVFoundation
import CoreAudio
import Foundation

func fail(_ message: String) -> Never {
  FileHandle.standardError.write("sim-audio: \(message)\n".data(using: .utf8)!)
  exit(1)
}

guard CommandLine.arguments.count == 3, var pid = pid_t(CommandLine.arguments[1]) else {
  FileHandle.standardError.write("usage: sim-audio <pid> out.wav\n".data(using: .utf8)!)
  exit(2)
}
let outURL = URL(fileURLWithPath: CommandLine.arguments[2])

func address(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
  AudioObjectPropertyAddress(
    mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
}

// The PID's Core Audio process object.
var processObject = AudioObjectID(kAudioObjectUnknown)
var addr = address(kAudioHardwarePropertyTranslatePIDToProcessObject)
var size = UInt32(MemoryLayout<AudioObjectID>.size)
guard AudioObjectGetPropertyData(
  AudioObjectID(kAudioObjectSystemObject), &addr, UInt32(MemoryLayout<pid_t>.size), &pid, &size, &processObject)
  == noErr, processObject != kAudioObjectUnknown
else { fail("no audio process for pid \(pid)") }

let description = CATapDescription(stereoMixdownOfProcesses: [processObject])
description.uuid = UUID()
description.muteBehavior = .unmuted
description.isPrivate = true
var tapID = AudioObjectID(kAudioObjectUnknown)
var err = AudioHardwareCreateProcessTap(description, &tapID)
guard err == noErr else { fail("couldn't create the process tap (\(err)); is the permission granted?") }

var format = AudioStreamBasicDescription()
addr = address(kAudioTapPropertyFormat)
size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
guard AudioObjectGetPropertyData(tapID, &addr, 0, nil, &size, &format) == noErr else { fail("no tap format") }

// The default output device clocks the aggregate; without one its IO proc never runs.
var outputID = AudioObjectID(kAudioObjectUnknown)
addr = address(kAudioHardwarePropertyDefaultSystemOutputDevice)
size = UInt32(MemoryLayout<AudioObjectID>.size)
guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &outputID) == noErr
else { fail("no default output device") }
var uidRef: Unmanaged<CFString>?
addr = address(kAudioDevicePropertyDeviceUID)
size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
guard AudioObjectGetPropertyData(outputID, &addr, 0, nil, &size, &uidRef) == noErr, let uidRef
else { fail("no output device UID") }
let outputUID = uidRef.takeRetainedValue()

// A private aggregate device that reads the tap.
let aggregate: [String: Any] = [
  kAudioAggregateDeviceNameKey: "sim-audio",
  kAudioAggregateDeviceUIDKey: UUID().uuidString,
  kAudioAggregateDeviceMainSubDeviceKey: outputUID as String,
  kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID as String]],
  kAudioAggregateDeviceIsPrivateKey: true,
  kAudioAggregateDeviceIsStackedKey: false,
  kAudioAggregateDeviceTapAutoStartKey: true,
  kAudioAggregateDeviceTapListKey: [
    [kAudioSubTapUIDKey: description.uuid.uuidString, kAudioSubTapDriftCompensationKey: true]
  ],
]
var deviceID = AudioObjectID(kAudioObjectUnknown)
err = AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &deviceID)
guard err == noErr else { fail("couldn't create the aggregate device (\(err))") }

guard let avFormat = AVAudioFormat(streamDescription: &format) else { fail("unsupported tap format") }
let file: AVAudioFile
do {
  file = try AVAudioFile(
    forWriting: outURL,
    settings: [
      AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: format.mSampleRate,
      AVNumberOfChannelsKey: format.mChannelsPerFrame, AVLinearPCMBitDepthKey: 16,
    ],
    commonFormat: .pcmFormatFloat32, interleaved: avFormat.isInterleaved)
} catch { fail("\(error)") }

var started = false
let queue = DispatchQueue(label: "sim-audio")
var procID: AudioDeviceIOProcID?
err = AudioDeviceCreateIOProcIDWithBlock(&procID, deviceID, queue) { _, input, inputTime, _, _ in
  guard let pcm = AVAudioPCMBuffer(pcmFormat: avFormat, bufferListNoCopy: input, deallocator: nil) else { return }
  if !started {
    started = true
    // Host time of this buffer's first sample, as wall-clock time.
    let ageSeconds = Double(Int64(mach_absolute_time()) - Int64(inputTime.pointee.mHostTime))
      * Double(timebase.numer) / Double(timebase.denom) / 1e9
    print(String(format: "started %.3f", Date().timeIntervalSince1970 - ageSeconds))
    fflush(stdout)
  }
  try? file.write(from: pcm)
}
var timebase = mach_timebase_info_data_t()
mach_timebase_info(&timebase)
guard err == noErr, let procID else { fail("couldn't add the IO proc (\(err))") }
guard AudioDeviceStart(deviceID, procID) == noErr else { fail("couldn't start the device") }

func stop() {
  AudioDeviceStop(deviceID, procID)
  queue.sync {
    AudioDeviceDestroyIOProcID(deviceID, procID)
    AudioHardwareDestroyAggregateDevice(deviceID)
    AudioHardwareDestroyProcessTap(tapID)
    file.close()  // writes the final WAV header
    exit(0)
  }
}
signal(SIGINT, SIG_IGN)
signal(SIGTERM, SIG_IGN)
let sigint = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
sigint.setEventHandler(handler: stop)
sigint.resume()
let sigterm = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
sigterm.setEventHandler(handler: stop)
sigterm.resume()
dispatchMain()
