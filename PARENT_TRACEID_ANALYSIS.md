# Parent TraceId Support Analysis

## Overview
This document outlines the changes needed to add parent traceId propagation support to the `otel-cicd-action`.

## Current Architecture

### Key Files:
1. **action.yml** - Defines inputs/outputs for the GitHub Action
2. **src/runner.ts** - Main entry point, reads inputs and orchestrates tracing
3. **src/trace/workflow.ts** - Creates the root span for the workflow run
4. **src/tracer.ts** - Sets up the OpenTelemetry tracer provider

### Current Flow:
1. `runner.ts` reads inputs (otlpEndpoint, otlpHeaders, runId, etc.)
2. Fetches workflow data from GitHub API
3. Creates tracer provider
4. Calls `traceWorkflowRun()` which creates a root span with `{ root: true }`
5. Returns the traceId as output

## Changes Required

### 1. Add `parentTraceId` Input (action.yml)
- Add optional `parentTraceId` input parameter
- Description: "Parent trace ID to link this workflow trace to (for trace propagation between workflows)"

### 2. Read Parent TraceId (runner.ts)
- Read `parentTraceId` input in the `run()` function
- Pass it to `traceWorkflowRun()` function

### 3. Create Parent Context (workflow.ts)
- Modify `traceWorkflowRun()` to accept optional `parentTraceId` parameter
- If `parentTraceId` is provided:
  - Create a `SpanContext` from the parent traceId
  - Create a context with that span context using `trace.setSpanContext()`
  - Use that context when starting the root span (instead of `root: true`)
- If `parentTraceId` is not provided, keep current behavior (`root: true`)

## Implementation Details

### OpenTelemetry API Usage:
```typescript
import { trace, SpanContext, TraceFlags } from "@opentelemetry/api";

// Create SpanContext from parent traceId
const parentSpanContext: SpanContext = {
  traceId: parentTraceId, // 32 hex characters
  spanId: generateNewSpanId(), // 16 hex characters (can be random)
  traceFlags: TraceFlags.SAMPLED,
  isRemote: true, // Indicates this is from a remote parent
};

// Create context with parent span context
const parentContext = trace.setSpanContext(context.active(), parentSpanContext);

// Use parent context when starting span
await tracer.startActiveSpan(
  workflowRun.name,
  { attributes, startTime }, // Remove 'root: true'
  parentContext, // Use parent context
  async (rootSpan) => { ... }
);
```

### TraceId Format:
- OpenTelemetry traceIds are 32 hexadecimal characters
- The action already outputs traceId in this format
- We should validate the input format (32 hex chars)

## Testing Considerations
- Test with parentTraceId provided
- Test without parentTraceId (backward compatibility)
- Test with invalid parentTraceId format
- Verify traces are linked correctly in the observability backend

## Backward Compatibility
- All changes are backward compatible
- `parentTraceId` is optional
- If not provided, behavior remains the same (creates root span)
