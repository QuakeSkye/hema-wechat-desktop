// Explicitly verified mini-program identities. Never allow arbitrary AppIDs.
export const TARGETS = Object.freeze({
  wx26a31270d9ab25e0: '盒马鲜生',
  wx28be50015b0f8a29: '超盒算 NB',
});
export const isSupportedApp = appid => Object.hasOwn(TARGETS, appid);
