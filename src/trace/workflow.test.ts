import type { components } from "@octokit/openapi-types";
import { trace } from "@opentelemetry/api";
import { traceWorkflowRun } from "./workflow";

process.env["OTEL_CONSOLE_ONLY"] = "true";
process.env["OTEL_ID_SEED"] = "123"; // seed for stable otel ids generation

describe("traceWorkflowRun", () => {
  afterEach(() => {
    trace.disable(); // Remove the global tracer provider
  });

  const mockWorkflowRun = {
    id: 123456,
    name: "Test Workflow",
    display_title: "Test Workflow",
    workflow_id: 789,
    run_number: 1,
    run_attempt: 1,
    status: "completed",
    conclusion: "success",
    event: "push",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:01:00Z",
    run_started_at: "2024-01-01T00:00:00Z",
    url: "https://api.github.com/repos/test/repo/actions/runs/123456",
    html_url: "https://github.com/test/repo/actions/runs/123456",
    workflow_url: "https://api.github.com/repos/test/repo/actions/workflows/789",
    node_id: "WFR_test",
    check_suite_id: 111,
    check_suite_node_id: "CS_test",
    jobs_url: "https://api.github.com/repos/test/repo/actions/runs/123456/jobs",
    logs_url: "https://api.github.com/test/repo/actions/runs/123456/logs",
    check_suite_url: "https://api.github.com/repos/test/repo/check-suites/111",
    artifacts_url: "https://api.github.com/repos/test/repo/actions/runs/123456/artifacts",
    cancel_url: "https://api.github.com/repos/test/repo/actions/runs/123456/cancel",
    rerun_url: "https://api.github.com/repos/test/repo/actions/runs/123456/rerun",
    head_sha: "abc123",
    head_branch: "main",
    head_repository: {
      id: 1,
      name: "repo",
      full_name: "test/repo",
    } as components["schemas"]["minimal-repository"],
    path: ".github/workflows/test.yml",
    repository: {
      id: 1,
      name: "repo",
      full_name: "test/repo",
    } as components["schemas"]["minimal-repository"],
    head_commit: {
      id: "abc123",
      tree_id: "def456",
      message: "Test commit",
      timestamp: "2024-01-01T00:00:00Z",
      author: {
        name: "Test Author",
        email: "test@example.com",
      },
      committer: {
        name: "Test Committer",
        email: "test@example.com",
      },
    },
    pull_requests: [],
    referenced_workflows: [
      {
        path: ".github/workflows/referenced.yml",
        sha: "sha123",
        ref: "main",
      },
    ],
  } as components["schemas"]["workflow-run"];

  const mockJobs: components["schemas"]["job"][] = [
    {
      id: 1,
      name: "test-job",
      status: "completed",
      conclusion: "success",
      started_at: "2024-01-01T00:00:10Z",
      completed_at: "2024-01-01T00:00:50Z",
      steps: [],
      labels: ["ubuntu-latest"],
      runner_id: 1,
      runner_name: "test-runner",
      runner_group_id: 1,
      runner_group_name: "test-group",
      run_id: 123456,
      run_attempt: 1,
      workflow_name: "Test Workflow",
      head_branch: "main",
      head_sha: "abc123",
      url: "https://api.github.com/repos/test/repo/actions/jobs/1",
      html_url: "https://github.com/test/repo/actions/runs/123456/job/1",
      check_run_url: "https://api.github.com/repos/test/repo/check-runs/1",
      created_at: "2024-01-01T00:00:05Z",
      run_url: "https://api.github.com/repos/test/repo/actions/runs/123456",
      node_id: "JOB_test",
    },
  ];

  it("should trace workflow with valid parentTraceId", async () => {
    const parentTraceId = "329e58aa53cec7a2beadd2fd0a85c388"; // Valid 32-char hex string

    const traceId = await traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, parentTraceId);

    expect(traceId).toBeTruthy();
    expect(typeof traceId).toBe("string");
    expect(traceId.length).toBe(32);
  }, 10000);

  it("should throw error with invalid parentTraceId format", async () => {
    const invalidParentTraceId = "invalid-trace-id";

    await expect(traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, invalidParentTraceId)).rejects.toThrow(
      'Invalid parentTraceId format: "invalid-trace-id". Expected 32 hexadecimal characters.',
    );
  });

  it("should throw error with parentTraceId that is too short", async () => {
    const shortParentTraceId = "1234567890abcdef"; // Only 16 chars

    await expect(traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, shortParentTraceId)).rejects.toThrow(
      'Invalid parentTraceId format: "1234567890abcdef". Expected 32 hexadecimal characters.',
    );
  });

  it("should throw error with parentTraceId that is too long", async () => {
    const longParentTraceId = "329e58aa53cec7a2beadd2fd0a85c38800"; // 34 chars

    await expect(traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, longParentTraceId)).rejects.toThrow(
      'Invalid parentTraceId format: "329e58aa53cec7a2beadd2fd0a85c38800". Expected 32 hexadecimal characters.',
    );
  });

  it("should throw error with parentTraceId containing invalid characters", async () => {
    const invalidCharParentTraceId = "329e58aa53cec7a2beadd2fd0a85c38g"; // Contains 'g'

    await expect(traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, invalidCharParentTraceId)).rejects.toThrow(
      'Invalid parentTraceId format: "329e58aa53cec7a2beadd2fd0a85c38g". Expected 32 hexadecimal characters.',
    );
  });

  it("should trace workflow with referenced_workflows", async () => {
    const traceId = await traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, undefined);

    expect(traceId).toBeTruthy();
    expect(typeof traceId).toBe("string");
  }, 10000);

  it("should trace workflow without parentTraceId", async () => {
    const traceId = await traceWorkflowRun(mockWorkflowRun, mockJobs, {}, {}, undefined);

    expect(traceId).toBeTruthy();
    expect(typeof traceId).toBe("string");
  }, 10000);
});
