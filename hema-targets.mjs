// Shared with the native launch gate; never allow arbitrary AppIDs.
import targets from './hema-targets.json' with { type: 'json' };
export const TARGETS = Object.freeze(targets);
export const isSupportedApp = appid => Object.hasOwn(TARGETS, appid);
