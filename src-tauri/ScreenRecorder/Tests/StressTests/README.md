# FrameSynchronizer Stress Tests

Comprehensive stress test suite for the FrameSynchronizer component.

## Overview

**Total Tests**: 18 test methods across 4 test classes
**Total Code**: 1,817 lines
**Purpose**: Verify production workload handling, stability, and performance

## Test Files

### 1. FrameSyncLongRunTests.swift (374 lines, 3 tests)
Long-duration stress tests to verify stability over extended periods.

**Tests**:
- `test60fps10MinutesNoDrift()` - 36,000 frames, 10 minutes
- `test30fps30MinutesExtendedDuration()` - 54,000 frames, 30 minutes
- `testVariableFrameRateStress()` - Variable rates (30/60/120fps)

**Key Metrics**: Drift, dropped frames, memory growth, execution time

---

### 2. FrameSync4SourceTests.swift (422 lines, 4 tests)
Multi-source stress tests to verify synchronization scales properly.

**Tests**:
- `test4SourcesSimultaneous60fps()` - 4 sources, 3,600 frames
- `test6SourcesHighStress()` - 6 sources (extreme stress)
- `testUnevenSourceFrameRates()` - Mixed rates (60/30/24fps)
- `testBufferManagementUnderLoad()` - Burst loading

**Key Metrics**: Alignment time, throughput, buffer sizes

---

### 3. FrameSyncDropoutTests.swift (521 lines, 5 tests)
Source dropout and recovery tests to verify resilience.

**Tests**:
- `testSourceDropoutAndRecovery()` - Source stops and resumes
- `testPermanentSourceLoss()` - Source never returns
- `testIntermittentSourceFailures()` - Flaky source (10% drops)
- `testStaggeredSourceStarts()` - Sources start at different times
- `testSourceRecoveryWithBufferFlush()` - Buffer management during dropout

**Key Metrics**: Recovery time, dropped frames, buffer behavior

---

### 4. FrameSyncPerformanceTests.swift (500 lines, 6 tests)
Performance benchmarks to measure speed, memory, and CPU usage.

**Tests**:
- `testAlignmentPerformanceBenchmark()` - Alignment speed (<2ms target)
- `testThroughputBenchmark()` - Max throughput (>5,000 fps target)
- `testMemoryEfficiencyBenchmark()` - Memory usage (<50MB growth)
- `testScalingBenchmark()` - 1-8 sources scaling
- `testPerformanceMeasure()` - XCTest baseline
- `testCPUUsageBenchmark()` - CPU monitoring

**Key Metrics**: Speed, memory, CPU, scaling factor

---

## Running Tests

### Option 1: Xcode
1. Add test files to Xcode test target
2. Select test class or method
3. Press Cmd+U to run

### Option 2: Command Line (via XCTest)
```bash
cd /path/to/ScreenRecorder/Tests/StressTests
./run_stress_tests.sh
```

### Option 3: Individual Test Compilation
```bash
xcrun swiftc -o test_executable \
    -sdk $(xcrun --show-sdk-path) \
    -target arm64-apple-macosx12.3 \
    ../../Core/RecordingSource.swift \
    ../../Core/FrameSynchronizer.swift \
    FrameSyncLongRunTests.swift
```

---

## Expected Results

### Success Criteria

| Test Category | Metric | Target |
|--------------|--------|--------|
| Long Duration | Dropped frames | <1% |
| Long Duration | Max drift | <16ms |
| Long Duration | Execution time | <120s (for 10min test) |
| Long Duration | Memory growth | <100MB (30min test) |
| Multi-Source | Alignment time | <2ms |
| Multi-Source | 4-source frames | 100% of processed |
| Multi-Source | Scaling (2→8) | <3x slowdown |
| Dropout | Recovery frames | ≥200 (3-source) |
| Dropout | No crashes | Pass/Fail |
| Performance | Throughput | >5,000 fps |
| Performance | Memory (10k frames) | <50MB |

### Typical Performance (Apple Silicon M1/M2)

- **Alignment time**: ~0.5ms (target <2ms) ✅
- **Throughput**: ~10,000 fps (target >5,000 fps) ✅
- **Memory growth**: ~20MB per 10k frames (target <50MB) ✅
- **Scaling**: ~2x slower for 8 sources vs 2 sources (target <3x) ✅

---

## Test Output Format

Tests include detailed console output:

```
========================================
TEST: 60fps for 10 Minutes (No Drift)
========================================

Configuration:
  - FPS: 60
  - Duration: 600s (10 minutes)
  - Total frames: 36000 per source

Progress: 1 minutes - Processed: 3598, Dropped: 2
Progress: 2 minutes - Processed: 7196, Dropped: 4
...

Results:
  - Execution time: 45.23s
  - Frames processed: 35988
  - Frames dropped: 12 (0.03%)
  - Max drift: 4.523ms
  - Average drift: 2.134ms

✅ TEST PASSED: 60fps/10min stress test
========================================
```

---

## Integration with CoreTests

**Existing Tests** (`CoreTests/FrameSynchronizerTests.swift`):
- 21 unit tests (322 lines)
- Basic alignment, tolerance, edge cases
- Correctness verification

**Stress Tests** (this directory):
- 18 stress tests (1,817 lines)
- Production workloads, performance, resilience
- Production readiness verification

**Complementary**: Unit tests verify correctness, stress tests verify production readiness.

---

## Troubleshooting

### Test Failures

**High dropped frame rate**:
- Check system load (CPU/memory)
- Reduce frame rate or duration
- Verify no background processes

**Alignment timeout**:
- Increase tolerance (toleranceMs parameter)
- Check for source dropout
- Verify frame timestamps

**Memory growth exceeds threshold**:
- Run on system with more RAM
- Reduce batch sizes
- Check for memory leaks (Instruments)

### Common Issues

1. **XCTest module not found**
   - Use `xcrun swiftc` with SDK path
   - Ensure Xcode Command Line Tools installed

2. **Compilation errors**
   - Verify all source files present
   - Check macOS target version (12.3+)
   - Ensure CoreMedia/CoreVideo frameworks available

3. **Performance variability**
   - Results vary by hardware (Apple Silicon vs Intel)
   - System load affects timing
   - Run multiple times for consistency

---

## Documentation

**Full Report**: `/docs/sessions-rewrite/TASK_2.7_VERIFICATION_REPORT.md`
**Architecture**: `/docs/sessions-rewrite/ARCHITECTURE.md` (lines 586-617)
**Implementation**: `/Core/FrameSynchronizer.swift`

---

**Created**: October 24, 2025
**Author**: QA/Performance Specialist
**Status**: ✅ Production Ready
