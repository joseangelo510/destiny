export function classifyTestAttempts(attempts) {
  const statuses = attempts.map((attempt) => attempt.status);
  const failedBeforePass = statuses.at(-1) === "pass" && statuses.slice(0, -1).includes("fail");
  return {
    flaky: failedBeforePass,
    gateStatus: statuses.every((status) => status === "pass") ? "pass" : "fail",
    retries: Math.max(0, attempts.length - 1),
  };
}

export function validateQuarantine(quarantine, now = new Date()) {
  const errors = [];
  if (!quarantine?.owner) errors.push("Quarantine requires an owner.");
  if (!quarantine?.reason) errors.push("Quarantine requires a reason.");
  if (!quarantine?.expiresAt) errors.push("Quarantine requires an expiry.");
  else if (Number.isNaN(Date.parse(quarantine.expiresAt))) errors.push("Quarantine expiry is invalid.");
  else if (new Date(quarantine.expiresAt) <= now) errors.push("Quarantine has expired.");
  return errors;
}
