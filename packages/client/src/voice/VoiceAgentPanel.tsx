import { useEffect, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { getConnectionStateLabel } from "../connection/connection-state-machine";
import type { SystemCalls } from "../mud/createSystemCalls";
import type { ConnectionState, ConversationMessage } from "./types";
import { useVoiceAgent } from "./useVoiceAgent";

type VoiceAgentPanelViewProps = {
  connectionState: ConnectionState;
  isVoiceActive: boolean;
  conversation: ConversationMessage[];
  lastPatchResult: { success: boolean; error?: string } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleVoice: () => Promise<void>;
  onSendText: (text: string) => void;
};

const scanline = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0.5; }
`;

const HUDContainer = styled.section`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  height: 240px;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  z-index: 1000;
  pointer-events: none;

  & > * {
    pointer-events: auto;
  }
`;

const GlassPanel = styled.div`
  background: rgba(13, 2, 8, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 255, 65, 0.2);
  border-radius: 12px;
  overflow: hidden;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
      linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
    background-size:
      100% 4px,
      3px 100%;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: rgba(0, 255, 65, 0.1);
    animation: ${scanline} 6s linear infinite;
    pointer-events: none;
  }
`;

const ChatSection = styled(GlassPanel)`
  display: flex;
  flex-direction: column;
  padding: 16px;
`;

const MessageLogs = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const MessageBubble = styled.div<{ $role: string }>`
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.4;
  max-width: 85%;
  align-self: ${(props) => (props.$role === "user" ? "flex-end" : "flex-start")};
  background: ${(props) => (props.$role === "user" ? "rgba(0, 255, 65, 0.1)" : "rgba(255, 255, 255, 0.05)")};
  border-left: 3px solid
    ${(props) => {
      switch (props.$role) {
        case "user":
          return "#00ff41";
        case "agent":
          return "#4af07a";
        case "system":
          return "#ff003c";
        default:
          return "#ccc";
      }
    }};
`;

const InputArea = styled.div`
  display: flex;
  gap: 8px;
`;

const ModernInput = styled.input`
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 255, 65, 0.3);
  color: #00ff41;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;

  &:focus {
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.2);
  }
`;

const ControlSection = styled(GlassPanel)`
  display: flex;
  flex-direction: column;
  padding: 16px;
  align-items: center;
  justify-content: center;
  gap: 12px;
`;

const StatusIndicator = styled.div<{ $state: ConnectionState }>`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: ${(props) => (props.$state === "connected" ? "#00ff41" : "#ff003c")};
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 8px currentColor;
    animation: ${(props) =>
      props.$state === "connected"
        ? css`
            ${pulse} 2s infinite
          `
        : "none"};
  }
`;

const VoiceCircle = styled.button<{ $active: boolean }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid ${(props) => (props.$active ? "#ff003c" : "#00ff41")};
  background: ${(props) => (props.$active ? "rgba(255, 0, 60, 0.1)" : "rgba(0, 255, 65, 0.05)")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${(props) => (props.$active ? "#ff003c" : "#00ff41")};
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  clip-path: none; /* Override global button style */
  font-size: 10px;
  font-weight: bold;
  box-shadow: 0 0 15px ${(props) => (props.$active ? "rgba(255, 0, 60, 0.3)" : "rgba(0, 255, 65, 0.2)")};

  &:hover {
    transform: scale(1.05);
    background: ${(props) => (props.$active ? "rgba(255, 0, 60, 0.2)" : "rgba(0, 255, 65, 0.15)")};
    box-shadow: 0 0 25px ${(props) => (props.$active ? "rgba(255, 0, 60, 0.4)" : "rgba(0, 255, 65, 0.3)")};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  &:disabled:hover {
    transform: none;
    background: ${(props) => (props.$active ? "rgba(255, 0, 60, 0.1)" : "rgba(0, 255, 65, 0.05)")};
    box-shadow: none;
  }

  svg {
    width: 24px;
    height: 24px;
    margin-bottom: 4px;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  width: 100%;
  gap: 8px;
`;

const MiniButton = styled.button`
  flex: 1;
  font-size: 10px;
  padding: 6px;
`;

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  return (
    <HUDContainer>
      <ChatSection>
        <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
          Neural Communication Link
        </div>
        <MessageLogs ref={scrollRef}>
          {conversation.length === 0 && (
            <div style={{ opacity: 0.3, fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 40 }}>
              No active transmission...
            </div>
          )}
          {conversation.map((message) => (
            <MessageBubble key={message.id} $role={message.role}>
              <span style={{ fontWeight: "bold", fontSize: 10, marginRight: 4, textTransform: "uppercase" }}>
                {message.role}:
              </span>
              {message.content}
            </MessageBubble>
          ))}
        </MessageLogs>
        <InputArea>
          <ModernInput
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                onSendText(text.trim());
                setText("");
              }
            }}
            placeholder="Type command..."
          />
          <button
            style={{ padding: "8px 12px" }}
            onClick={() => {
              if (!text.trim()) return;
              onSendText(text.trim());
              setText("");
            }}
          >
            Execute
          </button>
        </InputArea>
        {lastPatchResult && (
          <div style={{ marginTop: 8, fontSize: 10, color: lastPatchResult.success ? "#00ff41" : "#ff003c" }}>
            WORLD_PATCH_OP: {lastPatchResult.success ? "SYNCHRONIZED" : "FAILED_CRC_CHECK"}
          </div>
        )}
      </ChatSection>

      <ControlSection>
        <StatusIndicator $state={connectionState}>{getConnectionStateLabel(connectionState)}</StatusIndicator>

        <VoiceCircle
          $active={isVoiceActive}
          onClick={() => void onToggleVoice()}
          disabled={connectionState !== "connected" && !isVoiceActive}
        >
          {isVoiceActive ? (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              STOP
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              OFFLINE
            </>
          )}
        </VoiceCircle>

        <ActionButtons>
          {connectionState !== "connected" ? (
            <MiniButton onClick={onConnect}>Establish Link</MiniButton>
          ) : (
            <MiniButton onClick={onDisconnect}>Terminate Link</MiniButton>
          )}
        </ActionButtons>

        <div style={{ fontSize: 9, opacity: 0.4, textAlign: "center", marginTop: 4 }}>
          EGO WORLD_OS v1.0.4
          <br />
          ENCRYPTED BIDI STREAM
        </div>
      </ControlSection>
    </HUDContainer>
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
