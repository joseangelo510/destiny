import type { Evidence, PanelResult } from "./contracts";

export function loading<T>(message = "Loading current data."): PanelResult<T> {
  return { state: "loading", data: null, evidence: [], message };
}

export function ready<T>(data: T, evidence: Evidence[] = []): PanelResult<T> {
  return { state: "ready", data, evidence, message: null };
}

export function empty<T>(message: string): PanelResult<T> {
  return { state: "empty", data: null, evidence: [], message };
}

export function notConnected<T>(message: string): PanelResult<T> {
  return { state: "not_connected", data: null, evidence: [], message };
}

export function failed<T>(message = "Rebound SEO could not load this panel."): PanelResult<T> {
  return { state: "error", data: null, evidence: [], message };
}
