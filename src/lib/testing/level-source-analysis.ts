/**
 * Static analysis over level source files for curriculum-wide quality checks.
 *
 * Most levels keep their choice data (commands, option cards) as unexported
 * module-scope consts inside a single component file, so the data cannot be
 * imported and inspected. This module parses source with the TypeScript
 * compiler API instead and extracts:
 *
 * - option groups: array literals of objects carrying a `correct` flag
 * - PipelineFlow JSX tags and whether they pass `activeConnections`
 * - PROBE_DISCOVERY_MAP object literals
 *
 * The checks themselves (`findOptionGroupViolations`, `findAnswerLeaks`)
 * enforce the CLAUDE.md wrong-answer-feedback rules: the correct answer is
 * never first, every wrong option teaches via feedback, colors never hint,
 * and feedback never names the correct answer.
 */

import ts from 'typescript';

export interface AnalyzedOption {
	correct: boolean;
	label?: string;
	command?: string;
	feedback?: string;
	color?: string;
}

export interface OptionGroup {
	file: string;
	line: number;
	options: AnalyzedOption[];
}

export interface PipelineFlowTag {
	file: string;
	line: number;
	hasActiveConnections: boolean;
}

export interface ProbeDiscoveryMap {
	file: string;
	line: number;
	entries: Record<string, string[]>;
}

function parse(fileName: string, source: string): ts.SourceFile {
	return ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
	return (
		sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
	);
}

function stringValue(node: ts.Expression): string | undefined {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
		return node.text;
	}
	return undefined;
}

function propertyMap(
	obj: ts.ObjectLiteralExpression,
): Map<string, ts.Expression> {
	const props = new Map<string, ts.Expression>();
	for (const prop of obj.properties) {
		if (ts.isPropertyAssignment(prop)) {
			const name = ts.isIdentifier(prop.name)
				? prop.name.text
				: ts.isStringLiteral(prop.name)
					? prop.name.text
					: undefined;
			if (name) props.set(name, prop.initializer);
		}
	}
	return props;
}

function analyzeOption(obj: ts.ObjectLiteralExpression): AnalyzedOption | null {
	const props = propertyMap(obj);
	const correctNode = props.get('correct');
	if (!correctNode) return null;
	const isTrue = correctNode.kind === ts.SyntaxKind.TrueKeyword;
	const isFalse = correctNode.kind === ts.SyntaxKind.FalseKeyword;
	if (!isTrue && !isFalse) return null;
	const read = (key: string) => {
		const node = props.get(key);
		return node ? stringValue(node) : undefined;
	};
	return {
		correct: isTrue,
		label: read('label'),
		command: read('command'),
		// Decision modals teach through `consequence` instead of `feedback`;
		// both are the post-choice explanation surface, so both are checked.
		feedback: read('feedback') ?? read('consequence'),
		color: read('color'),
	};
}

/**
 * Extract every array literal that reads as a "choice group": two or more
 * object literals with a boolean `correct` flag, containing at least one
 * correct and one incorrect entry. Arrays of only-correct objects are
 * history/data, not choices, and are skipped.
 */
export function extractOptionGroups(
	fileName: string,
	source: string,
): OptionGroup[] {
	const sourceFile = parse(fileName, source);
	const groups: OptionGroup[] = [];

	const visit = (node: ts.Node) => {
		if (ts.isArrayLiteralExpression(node)) {
			const options: AnalyzedOption[] = [];
			for (const element of node.elements) {
				if (ts.isObjectLiteralExpression(element)) {
					const option = analyzeOption(element);
					if (option) options.push(option);
				}
			}
			const hasBoth =
				options.some((o) => o.correct) && options.some((o) => !o.correct);
			if (options.length >= 2 && hasBoth) {
				groups.push({
					file: fileName,
					line: lineOf(sourceFile, node),
					options,
				});
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return groups;
}

/** Find every `<PipelineFlow ...>` JSX tag and whether it passes activeConnections. */
export function extractPipelineFlowTags(
	fileName: string,
	source: string,
): PipelineFlowTag[] {
	const sourceFile = parse(fileName, source);
	const tags: PipelineFlowTag[] = [];

	const inspect = (node: ts.JsxSelfClosingElement | ts.JsxOpeningElement) => {
		if (!ts.isIdentifier(node.tagName)) return;
		if (node.tagName.text !== 'PipelineFlow') return;
		const hasActiveConnections = node.attributes.properties.some(
			(attr) =>
				ts.isJsxAttribute(attr) &&
				ts.isIdentifier(attr.name) &&
				attr.name.text === 'activeConnections',
		);
		tags.push({
			file: fileName,
			line: lineOf(sourceFile, node),
			hasActiveConnections,
		});
	};

	const visit = (node: ts.Node) => {
		if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
			inspect(node);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return tags;
}

/** Find PROBE_DISCOVERY_MAP declarations; string values normalize to arrays. */
export function extractProbeDiscoveryMaps(
	fileName: string,
	source: string,
): ProbeDiscoveryMap[] {
	const sourceFile = parse(fileName, source);
	const maps: ProbeDiscoveryMap[] = [];

	const visit = (node: ts.Node) => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text === 'PROBE_DISCOVERY_MAP' &&
			node.initializer &&
			ts.isObjectLiteralExpression(node.initializer)
		) {
			const entries: Record<string, string[]> = {};
			for (const [key, value] of propertyMap(node.initializer)) {
				const single = stringValue(value);
				if (single !== undefined) {
					entries[key] = [single];
				} else if (ts.isArrayLiteralExpression(value)) {
					entries[key] = value.elements
						.map((e) => stringValue(e))
						.filter((s): s is string => s !== undefined);
				}
			}
			maps.push({ file: fileName, line: lineOf(sourceFile, node), entries });
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return maps;
}

/** Structural rules from CLAUDE.md "Wrong-Answer Feedback: Never Reveal Answers". */
export function findOptionGroupViolations(group: OptionGroup): string[] {
	const at = `${group.file}:${group.line}`;
	const violations: string[] = [];
	const correctCount = group.options.filter((o) => o.correct).length;
	if (correctCount !== 1) {
		violations.push(
			`${at}: has ${correctCount} correct options (expected exactly 1)`,
		);
	}
	if (group.options[0]?.correct) {
		violations.push(`${at}: correct answer is the first option`);
	}
	for (const option of group.options) {
		if (!option.correct && !option.feedback?.trim()) {
			violations.push(
				`${at}: wrong option "${option.label ?? option.command ?? '?'}" has no feedback`,
			);
		}
	}
	const colors = new Set(group.options.map((o) => o.color ?? '(none)'));
	if (colors.size > 1) {
		violations.push(
			`${at}: options use mixed colors (${[...colors].join(', ')}), a visual answer hint`,
		);
	}
	return violations;
}

// Words too generic to identify the correct answer even when feedback uses
// them. Everything else that appears in the correct option but not in the
// wrong option being explained is treated as revealing.
const LEAK_STOPWORDS = new Set([
	'rails',
	'ruby',
	'bundle',
	'bundler',
	'install',
	'generate',
	'generator',
	'create',
	'database',
	'db:migrate',
	'migrate',
	'migration',
	'server',
	'console',
	'true',
	'false',
	'name',
	'nil',
	'null',
	'this',
	'that',
	'with',
	'from',
	'into',
	'your',
	'here',
	'each',
	'when',
	'then',
	'does',
	'have',
	'only',
	'call',
	'file',
	'class',
	'model',
	'field',
	'method',
	'value',
	'string',
	'record',
	'request',
	'response',
]);

const TOKEN_RE = /[A-Za-z_][A-Za-z0-9_./:@!?-]{3,}/g;

function tokensOf(...texts: (string | undefined)[]): Set<string> {
	const tokens = new Set<string>();
	for (const text of texts) {
		if (!text) continue;
		for (const match of text.toLowerCase().matchAll(TOKEN_RE)) {
			const token = match[0].replace(/[.,:;!?]+$/, '');
			if (token.length >= 4 && !LEAK_STOPWORDS.has(token)) {
				tokens.add(token);
			}
		}
	}
	return tokens;
}

/**
 * Answer-leak scan: a wrong option's feedback must not contain a token that
 * is distinctive to the correct answer (present in the correct option's
 * label/command, absent from the wrong option's own label/command).
 */
export function findAnswerLeaks(group: OptionGroup): string[] {
	const at = `${group.file}:${group.line}`;
	const correct = group.options.find((o) => o.correct);
	if (!correct) return [];
	const correctTokens = tokensOf(correct.label, correct.command);
	const normalize = (text: string) =>
		text.toLowerCase().replace(/\s+/g, ' ').trim();
	const correctPhrases = [correct.label, correct.command]
		.filter((t): t is string => Boolean(t))
		.map(normalize);
	const leaks: string[] = [];
	for (const option of group.options) {
		if (option.correct || !option.feedback) continue;
		const name = option.label ?? option.command ?? '?';
		const ownTokens = tokensOf(option.label, option.command);
		const ownPhrases = [option.label, option.command]
			.filter((t): t is string => Boolean(t))
			.map(normalize);
		const feedback = normalize(option.feedback);
		const feedbackTokens = tokensOf(option.feedback);
		for (const phrase of correctPhrases) {
			if (
				feedback.includes(phrase) &&
				!ownPhrases.some((p) => p.includes(phrase))
			) {
				leaks.push(
					`${at}: feedback for "${name}" quotes the correct answer "${phrase}"`,
				);
				break;
			}
		}
		for (const token of correctTokens) {
			if (!ownTokens.has(token) && feedbackTokens.has(token)) {
				leaks.push(
					`${at}: feedback for "${name}" reveals answer token "${token}"`,
				);
			}
		}
	}
	return leaks;
}
