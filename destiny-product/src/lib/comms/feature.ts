export function isCommsBetaEnabled(environment = process.env) {
  return environment.DESTINY_COMMS_BETA_ENABLED === "true";
}
