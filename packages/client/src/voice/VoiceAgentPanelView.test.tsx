import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceAgentPanelView } from "./VoiceAgentPanel";

describe("VoiceAgentPanelView", () => {
  it("renders connection label and controls", () => {
    const html = renderToStaticMarkup(
      <VoiceAgentPanelView
        connectionState="connected"
        isVoiceActive={false}
        conversation={[]}
        lastPatchResult={null}
        onConnect={() => undefined}
        onDisconnect={() => undefined}
        onToggleVoice={() => Promise.resolve()}
        onSendText={() => undefined}
      />,
    );

    expect(html).toContain("接続状態: 接続済み");
    expect(html).toContain("接続");
    expect(html).toContain("切断");
    expect(html).toContain("音声開始");
    expect(html).toContain("送信");
  });

  it("renders conversation and patch result", () => {
    const html = renderToStaticMarkup(
      <VoiceAgentPanelView
        connectionState="connected"
        isVoiceActive={true}
        conversation={[
          { id: "1", role: "user", content: "hello", status: "final" },
          { id: "2", role: "agent", content: "world", status: "streaming" },
        ]}
        lastPatchResult={{ success: true }}
        onConnect={() => undefined}
        onDisconnect={() => undefined}
        onToggleVoice={() => Promise.resolve()}
        onSendText={() => undefined}
      />,
    );

    expect(html).toContain("音声停止");
    expect(html).toContain("user: hello");
    expect(html).toContain("agent: world");
    expect(html).toContain("世界パッチ適用: 成功");
  });
});
