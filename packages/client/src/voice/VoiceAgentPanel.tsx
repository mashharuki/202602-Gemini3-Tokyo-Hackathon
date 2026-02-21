import { useState } from "react";
import type { SystemCalls } from "../mud/createSystemCalls";
import type { ConversationMessage, ConnectionState } from "./types";
import { useVoiceAgent } from "./useVoiceAgent";
import { getConnectionStateLabel } from "../connection/connection-state-machine";

type PatchResult = { success: boolean; error?: string } | null;

type VoiceAgentPanelViewProps = {
  connectionState: ConnectionState;
  isVoiceActive: boolean;
  conversation: ConversationMessage[];
  lastPatchResult: PatchResult;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleVoice: () => Promise<void>;
  onSendText: (text: string) => void;
};

export const VoiceAgentPanelView = ({
  connectionState,
  isVoiceActive,
  conversation,
  lastPatchResult,
  onConnect,
  onDisconnect,
  onToggleVoice,
  onSendText,
}: VoiceAgentPanelViewProps) => {
  const [text, setText] = useState("");

  return (
    <section
      style={{
        position: "fixed",
        right: 16,
        top: 16,
        width: 340,
        background: "rgba(0,0,0,0.78)",
        color: "#e6ffe8",
        border: "1px solid #4af07a",
        borderRadius: 8,
        padding: 12,
        zIndex: 1000,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div>接続状態: {getConnectionStateLabel(connectionState)}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onConnect}>接続</button>
        <button onClick={onDisconnect}>切断</button>
        <button onClick={() => void onToggleVoice()}>{isVoiceActive ? "音声停止" : "音声開始"}</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="テキストコマンド"
          style={{ flex: 1 }}
        />
        <button
          onClick={() => {
            if (!text.trim()) return;
            onSendText(text.trim());
            setText("");
          }}
        >
          送信
        </button>
      </div>
      <div style={{ marginTop: 10, maxHeight: 140, overflow: "auto", fontSize: 12 }}>
        {conversation.map((message) => (
          <div key={message.id}>
            {message.role}: {message.content}
          </div>
        ))}
      </div>
      {lastPatchResult && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          世界パッチ適用: {lastPatchResult.success ? "成功" : `失敗 (${lastPatchResult.error ?? "unknown"})`}
        </div>
      )}
    </section>
  );
};

export const VoiceAgentPanel = ({ systemCalls }: { systemCalls: SystemCalls }) => {
  const voice = useVoiceAgent(systemCalls);
  return (
    <VoiceAgentPanelView
      connectionState={voice.connectionState}
      isVoiceActive={voice.isVoiceActive}
      conversation={voice.conversation}
      lastPatchResult={voice.lastPatchResult}
      onConnect={voice.connect}
      onDisconnect={voice.disconnect}
      onToggleVoice={voice.toggleVoice}
      onSendText={voice.sendText}
    />
  );
};

