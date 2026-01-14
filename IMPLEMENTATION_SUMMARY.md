# Parent TraceId Implementation Summary

## Changes Made

### 1. action.yml
- Added optional `parentTraceId` input parameter
- Description: "Parent trace ID to link this workflow trace to (for trace propagation between workflows). Must be a 32-character hexadecimal string."

### 2. src/runner.ts
- Added reading of `parentTraceId` input
- Added logging when parentTraceId is provided
- Pass `parentTraceId` to `traceWorkflowRun()` function

### 3. src/trace/workflow.ts
- Added `parentTraceId?: string` parameter to `traceWorkflowRun()` function
- Added `isValidTraceId()` validation function (validates 32 hex characters)
- Added `generateRandomSpanId()` helper function
- Modified span creation logic:
  - If `parentTraceId` is provided:
    - Validates the traceId format
    - Creates a `SpanContext` from the parent traceId
    - Sets the parent context using `trace.setSpanContext()`
    - Wraps `startActiveSpan` in `context.with()` to use the parent context
    - Creates span without `root: true` (creates child span)
  - If `parentTraceId` is not provided:
    - Creates span with `root: true` (creates root span) - maintains backward compatibility

## How It Works

### OpenTelemetry Context Propagation
When a `parentTraceId` is provided:
1. A `SpanContext` is created with:
   - `traceId`: The parent traceId (normalized to lowercase)
   - `spanId`: A randomly generated 16-character hex string
   - `traceFlags`: Set to `SAMPLED`
   - `isRemote`: Set to `true` (indicates this is from a remote parent)

2. The parent context is set using `trace.setSpanContext()`

3. The span is created within this context using `context.with()`, which ensures the parent context is active

4. The new span becomes a child of the parent trace, maintaining trace continuity

## Usage Example

### Workflow 1 (Parent):
```yaml
- name: Export Workflow Trace
  id: export-trace
  uses: corentinmusard/otel-cicd-action@v2
  with:
    otlpEndpoint: https://your-endpoint/v1/traces
    otlpHeaders: apikey=${{ secrets.APIKEY }}
    githubToken: ${{ secrets.GITHUB_TOKEN }}

- name: Save traceId
  run: echo "${{ steps.export-trace.outputs.traceId }}" > trace_id.txt

- name: Upload traceId artifact
  uses: actions/upload-artifact@v4
  with:
    name: trace-id
    path: trace_id.txt
```

### Workflow 2 (Child):
```yaml
- name: Download parent traceId
  uses: actions/download-artifact@v4
  with:
    name: trace-id
    github-token: ${{ github.token }}
    run-id: ${{ github.event.workflow_run.id }}

- name: Read parent traceId
  id: read-trace
  run: echo "parentTraceId=$(cat trace_id.txt)" >> $GITHUB_OUTPUT

- name: Export Workflow Trace with Parent
  uses: corentinmusard/otel-cicd-action@v2
  with:
    otlpEndpoint: https://your-endpoint/v1/traces
    otlpHeaders: apikey=${{ secrets.APIKEY }}
    githubToken: ${{ secrets.GITHUB_TOKEN }}
    parentTraceId: ${{ steps.read-trace.outputs.parentTraceId }}
```

## Backward Compatibility
✅ Fully backward compatible
- `parentTraceId` is optional
- If not provided, behavior is identical to before (creates root span)
- No breaking changes to existing workflows

## Validation
- TraceId format is validated (must be 32 hexadecimal characters)
- Invalid format throws a descriptive error message
- TraceId is normalized to lowercase for consistency

## Testing Recommendations
1. Test with valid parentTraceId (32 hex chars)
2. Test without parentTraceId (backward compatibility)
3. Test with invalid parentTraceId format (should error)
4. Verify traces are linked correctly in observability backend
5. Test trace continuity across multiple workflow runs
