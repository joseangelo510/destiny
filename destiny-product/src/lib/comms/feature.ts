export function isCommsBetaEnabled(environment = process.env) {
  if (environment.DESTINY_COMMS_BETA_ENABLED !== "true") return false;
  if (environment.DESTINY_COMMS_BETA_LOCAL_PREVIEW !== "true") return false;
  return environment.NODE_ENV !== "production";
}
