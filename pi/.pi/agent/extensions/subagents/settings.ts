/**
 * Settings access for the subagents extension.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const DEFAULT_CONCURRENCY = 3;

/**
 * Simultaneous task subagents one dispatch may run.
 * Read from `subagents.worker.concurrency` in settings.json; the same value
 * caps parallel dispatch from a worker child and the `tasks` array mode.
 */
export function getConcurrency(pi: ExtensionAPI): number {
	const settings = pi.getSettings() as { subagents?: { worker?: { concurrency?: unknown } } };
	const raw = settings?.subagents?.worker?.concurrency;
	if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) return DEFAULT_CONCURRENCY;
	return raw;
}
