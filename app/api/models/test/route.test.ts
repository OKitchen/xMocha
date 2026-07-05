import { describe, expect, it } from "vitest";

import { diagnoseModelTestError } from "./route";

describe("diagnoseModelTestError", () => {
  it("explains Google project permission or billing denial", () => {
    const diagnostic = diagnoseModelTestError(
      'Google GenAI request failed. ApiError: {"error":{"code":403,"message":"Lightning dunning decision is deny for project: projects/123","status":"PERMISSION_DENIED"}}.',
    );

    expect(diagnostic?.code).toBe("google_project_denied");
    expect(diagnostic?.message.en).toContain("project rejected");
    expect(diagnostic?.message["zh-CN"]).toContain("Google 项目拒绝");
  });

  it("explains Ollama socket failures as local runtime availability problems", () => {
    const diagnostic = diagnoseModelTestError(
      'Gemma Ollama request failed. Confirm Ollama is running at OLLAMA_BASE_URL="http://localhost:11434" and the model "gemma4" is available. TypeError: fetch failed. cause=SocketError code=UND_ERR_SOCKET message=other side closed',
    );

    expect(diagnostic?.code).toBe("ollama_unavailable");
    expect(diagnostic?.message.en).toContain("Ollama is running");
    expect(diagnostic?.message["zh-CN"]).toContain("Ollama 正在运行");
  });
});
