import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
  window.dispatchEvent(new Event("resize"));
}

function dispatchMockStreamEvent(detail: unknown): void {
  window.dispatchEvent(new CustomEvent("mock-stream-event", { detail }));
}

function dispatchMockAudioChunk(detail: unknown): void {
  window.dispatchEvent(new CustomEvent("mock-audio-chunk", { detail }));
}

afterEach(() => {
  cleanup();
});

describe("App shell", () => {
  it("renders key areas needed for connection, conversation, controls, and observability", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Realtime Voice Agent" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "connection" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "conversation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "input-controls" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "event-console" })).toBeInTheDocument();
  });

  it("switches layout mode for desktop, tablet, and mobile breakpoints", () => {
    setViewport(1280);
    const { rerender } = render(<App />);
    expect(screen.getByTestId("layout-mode")).toHaveTextContent("desktop");

    setViewport(900);
    rerender(<App />);
    expect(screen.getByTestId("layout-mode")).toHaveTextContent("tablet");

    setViewport(375);
    rerender(<App />);
    expect(screen.getByTestId("layout-mode")).toHaveTextContent("mobile");
  });

  it("keeps send, voice-start, and image-send controls reachable in all layout modes", () => {
    const widths = [1280, 900, 375];

    for (const width of widths) {
      setViewport(width);
      const { unmount } = render(<App />);

      expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "音声開始" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "画像送信" })).toBeInTheDocument();

      unmount();
    }
  });

  it("shows connection state transitions consistently in UI", () => {
    vi.useFakeTimers();
    setViewport(1280);
    render(<App />);

    expect(screen.getByTestId("connection-state")).toHaveTextContent("切断");

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続中");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");
    vi.useRealTimers();
  });

  it("shows reconnect schedule, reconnecting state, and lifecycle notices after disconnect", () => {
    vi.useFakeTimers();
    setViewport(1280);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");

    fireEvent.click(screen.getByRole("button", { name: "切断" }));
    expect(screen.getByTestId("connection-state")).toHaveTextContent("切断");
    expect(screen.getByText("再接続予定")).toBeInTheDocument();
    expect(screen.getByTestId("system-notices")).toHaveTextContent("接続開始");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("切断");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("再接続中");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("再接続を試行中");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("再接続に成功");
    vi.useRealTimers();
  });

  it("adds valid text input to conversation as a user utterance and ignores blank input", () => {
    render(<App />);
    const input = screen.getByLabelText("テキスト入力");
    const sendButton = screen.getByRole("button", { name: "送信" });

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(sendButton);
    expect(screen.queryByTestId("conversation-message-user")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "こんにちは" } });
    fireEvent.click(sendButton);

    const userMessages = screen.getAllByTestId("conversation-message-user");
    expect(userMessages.at(-1)).toHaveTextContent("こんにちは");
  });

  it("keeps conversation view following latest message on new arrivals", () => {
    render(<App />);
    const conversationLog = screen.getByTestId("conversation-log");
    const input = screen.getByLabelText("テキスト入力");
    const sendButton = screen.getByRole("button", { name: "送信" });

    Object.defineProperty(conversationLog, "scrollHeight", {
      configurable: true,
      value: 320
    });
    Object.defineProperty(conversationLog, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0
    });

    fireEvent.change(input, { target: { value: "追従テスト" } });
    fireEvent.click(sendButton);

    expect(conversationLog.scrollTop).toBe(320);
  });

  it("renders agent text as partial during stream and finalizes on turn complete", () => {
    render(<App />);

    act(() => {
      dispatchMockStreamEvent({
        kind: "text",
        role: "agent",
        text: "こんにちは",
        partial: true
      });
    });

    const agentMessage = screen.getByTestId("conversation-message-agent");
    expect(agentMessage).toHaveTextContent("こんにちは");
    expect(agentMessage).toHaveTextContent("partial");

    act(() => {
      dispatchMockStreamEvent({ kind: "turnComplete" });
    });
    expect(screen.getByTestId("conversation-message-agent")).toHaveTextContent("complete");
  });

  it("marks the active agent turn as interrupted when interrupted event arrives", () => {
    render(<App />);

    act(() => {
      dispatchMockStreamEvent({
        kind: "text",
        role: "agent",
        text: "応答中",
        partial: true
      });
    });
    act(() => {
      dispatchMockStreamEvent({ kind: "interrupted" });
    });

    expect(screen.getByTestId("conversation-message-agent")).toHaveTextContent("interrupted");
  });

  it("renders generated image output as an agent message", () => {
    render(<App />);

    act(() => {
      dispatchMockStreamEvent({
        kind: "imageOutput",
        role: "agent",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9mZ1tcQAAAAASUVORK5CYII=",
        mimeType: "image/png"
      });
    });

    const image = screen.getByRole("img", { name: "生成画像" });
    expect(image).toHaveAttribute(
      "src",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9mZ1tcQAAAAASUVORK5CYII="
    );
  });

  it("toggles voice input active state between start and stop actions", () => {
    render(<App />);

    expect(screen.queryByTestId("voice-input-state")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "音声開始" }));

    expect(screen.getByTestId("voice-input-state")).toHaveTextContent("音声入力中");
    expect(screen.getByRole("button", { name: "音声停止" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "音声停止" }));
    expect(screen.queryByTestId("voice-input-state")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "音声開始" })).toBeInTheDocument();
  });

  it("counts upstream audio chunks only while voice input is active", () => {
    render(<App />);

    expect(screen.getByTestId("audio-upstream-chunk-count")).toHaveTextContent("0");

    act(() => {
      dispatchMockAudioChunk({ size: 320 });
    });
    expect(screen.getByTestId("audio-upstream-chunk-count")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "音声開始" }));
    act(() => {
      dispatchMockAudioChunk({ size: 320 });
      dispatchMockAudioChunk({ size: 320 });
    });
    expect(screen.getByTestId("audio-upstream-chunk-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "音声停止" }));
    act(() => {
      dispatchMockAudioChunk({ size: 320 });
    });
    expect(screen.getByTestId("audio-upstream-chunk-count")).toHaveTextContent("2");
  });

  it("starts audio playback on downstream audio events and shows playback state", () => {
    render(<App />);

    expect(screen.getByTestId("audio-playback-state")).toHaveTextContent("待機中");
    expect(screen.getByTestId("audio-downstream-chunk-count")).toHaveTextContent("0");

    act(() => {
      dispatchMockStreamEvent({ kind: "audioOutput", chunkSize: 640 });
    });

    expect(screen.getByTestId("audio-playback-state")).toHaveTextContent("再生中");
    expect(screen.getByTestId("audio-downstream-chunk-count")).toHaveTextContent("1");
  });

  it("stops active audio playback and marks interrupted state on interrupted event", () => {
    render(<App />);

    act(() => {
      dispatchMockStreamEvent({ kind: "audioOutput", chunkSize: 640 });
    });
    expect(screen.getByTestId("audio-playback-state")).toHaveTextContent("再生中");

    act(() => {
      dispatchMockStreamEvent({ kind: "interrupted" });
    });
    expect(screen.getByTestId("audio-playback-state")).toHaveTextContent("中断");
  });

  it("opens camera preview modal on image action and closes it while releasing camera state", async () => {
    const stopTrack = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: stopTrack }]
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      }
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));

    expect(await screen.findByRole("dialog", { name: "camera-preview" })).toBeInTheDocument();
    expect(screen.getByTestId("camera-state")).toHaveTextContent("利用中");

    fireEvent.click(within(screen.getByRole("dialog", { name: "camera-preview" })).getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "camera-preview" })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("camera-state")).toHaveTextContent("未使用");
    expect(stopTrack).toHaveBeenCalled();
  });

  it("shows identifiable failure notice when camera permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"))
      }
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));

    await waitFor(() => {
      expect(screen.getByTestId("system-notices")).toHaveTextContent("カメラ利用に失敗");
    });
    expect(screen.queryByRole("dialog", { name: "camera-preview" })).not.toBeInTheDocument();
  });

  it("provides send and cancel actions while camera preview is open", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));

    const dialog = await screen.findByRole("dialog", { name: "camera-preview" });
    expect(within(dialog).getByRole("button", { name: "画像を送信" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  it("reflects captured image in conversation and counts image upstream when send is confirmed", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    render(<App />);
    expect(screen.getByTestId("image-upstream-count")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));
    const dialog = await screen.findByRole("dialog", { name: "camera-preview" });
    fireEvent.click(within(dialog).getByRole("button", { name: "画像を送信" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "camera-preview" })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("conversation-message-user")).toHaveTextContent("[画像を送信しました]");
    expect(screen.getByTestId("image-upstream-count")).toHaveTextContent("1");
  });

  it("closes camera modal without adding image message when canceled", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));
    const dialog = await screen.findByRole("dialog", { name: "camera-preview" });
    fireEvent.click(within(dialog).getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "camera-preview" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText("[画像を送信しました]")).not.toBeInTheDocument();
    expect(screen.getByTestId("image-upstream-count")).toHaveTextContent("0");
  });

  it("records event logs with timestamp and allows detail expansion", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("テキスト入力"), { target: { value: "イベントログ確認" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    const logItems = screen.getAllByTestId("event-log-item");
    expect(logItems.length).toBeGreaterThan(0);
    expect(logItems[0]).toHaveTextContent("T");

    fireEvent.click(within(logItems[0]).getByRole("button", { name: "詳細を開く" }));
    expect(within(logItems[0]).getByTestId("event-log-detail")).toBeInTheDocument();
  });

  it("visually distinguishes notification events from conversation events in event console", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    fireEvent.change(screen.getByLabelText("テキスト入力"), { target: { value: "会話イベント" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("event-log-item-notification").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTestId("event-log-item-conversation").length).toBeGreaterThan(0);
  });

  it("toggles audio event visibility in event console", () => {
    render(<App />);

    act(() => {
      dispatchMockStreamEvent({ kind: "audioOutput", chunkSize: 640 });
    });
    expect(screen.getAllByTestId("event-log-item-audio").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "音声イベントを表示" }));
    expect(screen.queryByTestId("event-log-item-audio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "音声イベントを表示" }));
    expect(screen.getAllByTestId("event-log-item-audio").length).toBeGreaterThan(0);
  });

  it("clears event logs immediately when clear action is triggered", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    expect(screen.getAllByTestId("event-log-item").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "ログをクリア" }));
    expect(screen.queryByTestId("event-log-item")).not.toBeInTheDocument();
  });

  it("provides runconfig toggles for proactivity and affective dialog", () => {
    render(<App />);

    expect(screen.getByRole("checkbox", { name: "Proactivity" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Affective Dialog" })).toBeInTheDocument();
  });

  it("sends runconfig contract format and shows applying state during reconnect", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");

    const proactivityCheckbox = screen.getByRole("checkbox", { name: "Proactivity" });
    const affectiveCheckbox = screen.getByRole("checkbox", { name: "Affective Dialog" });
    fireEvent.click(proactivityCheckbox);

    expect(screen.getByTestId("run-config-query")).toHaveTextContent("proactivity=true&affective_dialog=false");
    expect(screen.getByTestId("run-config-status")).toHaveTextContent("反映中");
    expect(screen.getByTestId("connection-state")).toHaveTextContent("再接続中");
    expect(proactivityCheckbox).toBeDisabled();
    expect(affectiveCheckbox).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");
    expect(screen.getByTestId("run-config-status")).toHaveTextContent("待機");
    expect(proactivityCheckbox).not.toBeDisabled();
    expect(screen.getByTestId("run-config-effective")).toHaveTextContent("proactivity=true");
    vi.useRealTimers();
  });

  it("reflects backend runconfig apply result and updates effective values", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Proactivity" }));
    expect(screen.getByTestId("run-config-status")).toHaveTextContent("反映中");

    act(() => {
      dispatchMockStreamEvent({
        kind: "runConfigApplyResult",
        status: "applied",
        effective: { proactivity: true, affectiveDialog: false }
      });
    });

    expect(screen.getByTestId("run-config-status")).toHaveTextContent("待機");
    expect(screen.getByTestId("run-config-effective")).toHaveTextContent("proactivity=true");
    expect(screen.getByTestId("run-config-drift")).toHaveTextContent("一致");
    vi.useRealTimers();
  });

  it("falls back to last successful runconfig and shows failure notice on rejected apply result", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Proactivity" }));
    act(() => {
      dispatchMockStreamEvent({
        kind: "runConfigApplyResult",
        status: "applied",
        effective: { proactivity: true, affectiveDialog: false }
      });
    });
    expect(screen.getByTestId("run-config-effective")).toHaveTextContent("proactivity=true");

    fireEvent.click(screen.getByRole("checkbox", { name: "Affective Dialog" }));
    expect(screen.getByTestId("run-config-status")).toHaveTextContent("反映中");
    act(() => {
      dispatchMockStreamEvent({
        kind: "runConfigApplyResult",
        status: "rejected",
        effective: { proactivity: true, affectiveDialog: false },
        reason: "unsupported option"
      });
    });

    expect(screen.getByTestId("run-config-status")).toHaveTextContent("待機");
    expect(screen.getByTestId("run-config-effective")).toHaveTextContent("proactivity=true");
    expect(screen.getByTestId("run-config-effective")).toHaveTextContent("affectiveDialog=false");
    expect(screen.getByTestId("run-config-drift")).toHaveTextContent("不一致");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("設定反映に失敗");
    vi.useRealTimers();
  });

  it("records websocket error to observability log and notifies user with recovery flow", () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");

    act(() => {
      dispatchMockStreamEvent({ kind: "error", message: "socket down" });
    });

    expect(screen.getByTestId("connection-state")).toHaveTextContent("エラー");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("WebSocketエラー: socket down");
    expect(screen.getAllByTestId("event-log-item-notification")[0]).toHaveTextContent("WebSocketエラー");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("connection-state")).toHaveTextContent("再接続中");
    expect(screen.getByTestId("system-notices")).toHaveTextContent("再接続を試行中");
    vi.useRealTimers();
  });

  it("keeps system notices visually separated from conversation messages across breakpoints", () => {
    vi.useFakeTimers();
    const widths = [1280, 900, 375];

    for (const width of widths) {
      setViewport(width);
      const { unmount } = render(<App />);

      fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
      act(() => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.change(screen.getByLabelText("テキスト入力"), { target: { value: "表示分離テスト" } });
      fireEvent.click(screen.getByRole("button", { name: "送信" }));

      const noticeItems = screen.getAllByTestId("system-notice-item");
      expect(noticeItems.length).toBeGreaterThan(0);
      expect(screen.getByTestId("conversation-message-user")).toBeInTheDocument();
      expect(noticeItems[0].className).toContain("system-notice-item");
      expect(screen.getByTestId("conversation-message-user").className).not.toContain("system-notice-item");

      unmount();
    }
    vi.useRealTimers();
  });

  it("verifies integrated major flow including recovery banner, interruption, runconfig fallback, and event logs", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
    await waitFor(() => {
      expect(screen.getByTestId("connection-state")).toHaveTextContent("接続済み");
    });

    fireEvent.change(screen.getByLabelText("テキスト入力"), { target: { value: "統合フロー" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));
    expect(screen.getByTestId("conversation-message-user")).toHaveTextContent("統合フロー");

    fireEvent.click(screen.getByRole("button", { name: "音声開始" }));
    act(() => {
      dispatchMockAudioChunk({ size: 320 });
      dispatchMockStreamEvent({ kind: "audioOutput", chunkSize: 640 });
      dispatchMockStreamEvent({ kind: "interrupted" });
    });
    expect(screen.getByTestId("audio-playback-state")).toHaveTextContent("中断");

    fireEvent.click(screen.getByRole("button", { name: "画像送信" }));
    const dialog = await screen.findByRole("dialog", { name: "camera-preview" });
    fireEvent.click(within(dialog).getByRole("button", { name: "画像を送信" }));
    expect(screen.getByTestId("image-upstream-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("checkbox", { name: "Affective Dialog" }));
    act(() => {
      dispatchMockStreamEvent({
        kind: "runConfigApplyResult",
        status: "rejected",
        effective: { proactivity: false, affectiveDialog: false },
        reason: "unsupported"
      });
    });
    expect(screen.getByTestId("run-config-drift")).toHaveTextContent("不一致");

    act(() => {
      dispatchMockStreamEvent({ kind: "error", message: "temporary disconnect" });
    });
    expect(screen.getByText("自動回復を試行中")).toBeInTheDocument();
    expect(screen.getByTestId("system-notices")).toHaveTextContent("WebSocketエラー");

    await waitFor(
      () => {
        expect(screen.getByTestId("connection-state")).toHaveTextContent("再接続中");
      },
      { timeout: 2500 }
    );
    expect(screen.getAllByTestId("event-log-item").length).toBeGreaterThan(0);
  });

  it("covers acceptance regression for desktop and mobile on partial response completion and notice separation", () => {
    vi.useFakeTimers();
    const widths = [1280, 375];

    for (const width of widths) {
      setViewport(width);
      const { unmount } = render(<App />);

      fireEvent.click(screen.getByRole("button", { name: "接続開始" }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        dispatchMockStreamEvent({ kind: "text", role: "agent", text: "途中", partial: true });
      });
      expect(screen.getByTestId("conversation-message-agent")).toHaveTextContent("partial");
      act(() => {
        dispatchMockStreamEvent({ kind: "turnComplete" });
      });
      expect(screen.getByTestId("conversation-message-agent")).toHaveTextContent("complete");

      const noticeItems = screen.getAllByTestId("system-notice-item");
      expect(noticeItems.length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "送信" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "音声開始" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "画像送信" })).toBeInTheDocument();

      unmount();
    }
    vi.useRealTimers();
  });
});
