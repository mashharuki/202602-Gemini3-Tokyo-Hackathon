import type { SystemCalls } from "./createSystemCalls";

type Assert<T extends true> = T;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

type _HasApplyWorldPatch = Assert<HasKey<SystemCalls, "applyWorldPatch">>;
type _HasSetEffect = Assert<HasKey<SystemCalls, "setEffect">>;
type _HasSpawnEntity = Assert<HasKey<SystemCalls, "spawnEntity">>;
type _HasSetCaption = Assert<HasKey<SystemCalls, "setCaption">>;
