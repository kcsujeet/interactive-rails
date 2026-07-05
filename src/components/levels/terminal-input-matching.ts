/**
 * Free-input terminal matching.
 *
 * Terminal steps let the player TYPE the command (recall) before falling
 * back to option buttons (recognition). This module holds the pure matching
 * logic so it stays testable without DOM rendering.
 *
 * Matching is case-sensitive: shell commands are case-sensitive, and some
 * steps have options that differ only by case. Whitespace is normalized so
 * stray spaces never fail an otherwise-correct answer. Input can match a
 * command's full `command` string or its shorter `label` (labels are what
 * a player would reasonably type when the command bundles extras like
 * `&& rails db:migrate`).
 */

import type { TerminalCommand } from './SimulatedTerminal';

/** Failed attempts (wrong match or unrecognized) before options reveal. */
export const FREE_INPUT_MISS_LIMIT = 2;

export type TypedCommandMatch =
	| { kind: 'match'; command: TerminalCommand }
	| { kind: 'unrecognized' };

function normalize(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function matchTypedCommand(
	input: string,
	commands: TerminalCommand[],
): TypedCommandMatch {
	const typed = normalize(input);
	if (typed.length === 0) return { kind: 'unrecognized' };
	for (const command of commands) {
		if (
			typed === normalize(command.command) ||
			typed === normalize(command.label)
		) {
			return { kind: 'match', command };
		}
	}
	return { kind: 'unrecognized' };
}

export function shouldRevealOptions(missCount: number): boolean {
	return missCount >= FREE_INPUT_MISS_LIMIT;
}
