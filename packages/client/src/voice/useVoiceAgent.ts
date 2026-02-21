import { useEffect, useMemo, useState } from "react";
import type { SystemCalls } from "../mud/createSystemCalls";
import { createVoiceAgentController, type VoiceAgentControllerState } from "./voice-agent-controller";

export type VoiceAgentState = VoiceAgentControllerState & {
  connect: () => void;
  disconnect: () => void;
  toggleVoice: () => Promise<void>;
  sendText: (text: string) => void;
};

export type UseVoiceAgentOptions = {
  host?: string;
  userId?: string;
  sessionId?: string;
};

export const useVoiceAgent = (
  systemCalls: SystemCalls,
  options: UseVoiceAgentOptions = {},
): VoiceAgentState => {
  const host = options.host ?? import.meta.env.VITE_BACKEND_URL ?? window.location.host;
  const userId = options.userId ?? "guest";
  const sessionId =
    options.sessionId ?? `session-${Math.random().toString(36).slice(2, 10)}`;

  const controller = useMemo(
    () =>
      createVoiceAgentController({
        systemCalls,
        host,
        userId,
        sessionId,
      }),
    [systemCalls, host, userId, sessionId],
  );

  const [state, setState] = useState<VoiceAgentControllerState>(controller.getState());

  useEffect(() => {
    const unsubscribe = controller.subscribe((next) => setState(next));
    setState(controller.getState());
    return () => {
      unsubscribe();
      controller.disconnect();
    };
  }, [controller]);

  return {
    ...state,
    connect: controller.connect,
    disconnect: controller.disconnect,
    toggleVoice: controller.toggleVoice,
    sendText: controller.sendText,
  };
};

