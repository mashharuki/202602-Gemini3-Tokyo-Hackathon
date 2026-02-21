import { useMUD } from "./MUDContext";

type Assert<T extends true> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type MUDValue = ReturnType<typeof useMUD>;
type SystemCalls = MUDValue["systemCalls"];

type _HasApplyWorldPatchFromContext = Assert<HasKey<SystemCalls, "applyWorldPatch">>;
type _HasSetEffectFromContext = Assert<HasKey<SystemCalls, "setEffect">>;
type _HasSpawnEntityFromContext = Assert<HasKey<SystemCalls, "spawnEntity">>;
type _HasSetCaptionFromContext = Assert<HasKey<SystemCalls, "setCaption">>;
