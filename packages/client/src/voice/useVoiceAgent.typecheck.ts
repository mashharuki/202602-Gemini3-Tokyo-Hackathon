import type { SystemCalls } from "../mud/createSystemCalls";
import { useVoiceAgent } from "./useVoiceAgent";

type Assert<T extends true> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type VoiceAgentValue = ReturnType<typeof useVoiceAgent>;

type _HasConnect = Assert<HasKey<VoiceAgentValue, "connect">>;
type _HasDisconnect = Assert<HasKey<VoiceAgentValue, "disconnect">>;
type _HasToggleVoice = Assert<HasKey<VoiceAgentValue, "toggleVoice">>;
type _HasSendText = Assert<HasKey<VoiceAgentValue, "sendText">>;
type _HasConnectionState = Assert<HasKey<VoiceAgentValue, "connectionState">>;
type _HasConversation = Assert<HasKey<VoiceAgentValue, "conversation">>;
type _HasPatchResult = Assert<HasKey<VoiceAgentValue, "lastPatchResult">>;

// ensure hook accepts SystemCalls typed argument
declare const systemCalls: SystemCalls;
void useVoiceAgent(systemCalls);
