export function isCommsBetaEnabled(environment = process.env) {
  if (environment.DESTINY_COMMS_BETA_ENABLED !== "true") return false;
  if (environment.NODE_ENV !== "production") return true;
  return environment.DESTINY_COMMS_BETA_PRODUCTION_ENABLED === "true";
}
