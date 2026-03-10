/**
 * Level Info App Component
 *
 * Displays level briefing information before starting the challenge.
 */

import { BookOpen, Code, Info, Play, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getActForLevel, getLevel } from '@/features/acts-registry';
import { levelChallenges } from '../game-barrel';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { CodeBlock } from '../ui/CodeBlock';
import { LevelBreadcrumb } from '../ui/LevelBreadcrumb';

interface LevelInfoAppProps {
	levelId: string;
}

interface LevelInfo {
	levelNumber: number;
	actId: number;
	actName: string;
	name: string;
	description: string;
	concepts: string[];
	scenario?: string;
	problem?: string;
	goal?: string;
	learningGoals?: string[];
	initialMetrics?: {
		queries: number;
		latency: number;
	};
}

/** Parse markdown-style bullet lines from learningContent.goal */
function parseLearningGoals(goalText: string): string[] {
	return goalText
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2).trim());
}

export function LevelInfoApp({ levelId }: LevelInfoAppProps) {
	const [loading, setLoading] = useState(true);
	const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);

	useEffect(() => {
		loadLevelInfo();
	}, [levelId]);

	function loadLevelInfo() {
		const level = getLevel(levelId);
		const act = getActForLevel(levelId);
		const challenge = levelChallenges[levelId];

		const info: LevelInfo = level
			? {
					levelNumber: level.levelNumber,
					actId: act?.id || 1,
					actName: act?.name || '',
					name: level.name,
					description: level.trigger.description,
					concepts: [level.learningContent.title],
					scenario: level.problem.observation,
					problem: level.problem.codeExample,
					goal:
						level.problem.goal || 'Fix the pipeline to complete this level.',
					learningGoals: level.learningContent.goal
						? parseLearningGoals(level.learningContent.goal)
						: undefined,
				}
			: challenge
				? {
						levelNumber: 0,
						actId: 1,
						actName: '',
						name: challenge.name,
						description: challenge.description,
						concepts: challenge.concepts,
						scenario: challenge.scenario,
						problem: challenge.problem,
						goal: challenge.goal,
						initialMetrics: challenge.initialMetrics,
					}
				: {
						levelNumber: 0,
						actId: 1,
						actName: '',
						name: 'Unknown Level',
						description: '',
						concepts: [],
					};

		setLevelInfo(info);
		setLoading(false);
	}

	if (loading || !levelInfo) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto">
			{/* Breadcrumb */}
			<LevelBreadcrumb
				actId={levelInfo.actId}
				actName={levelInfo.actName}
				levelNumber={levelInfo.levelNumber}
			/>

			{/* Header */}
			<div className="flex items-start gap-5 mb-10">
				<div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
					<span className="text-2xl font-bold text-primary">
						{levelInfo.levelNumber}
					</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
						Act {levelInfo.actId}
					</p>
					<h1 className="text-3xl font-semibold text-foreground mb-2">
						{levelInfo.name}
					</h1>
					<p className="text-muted-foreground leading-relaxed">
						{levelInfo.description}
					</p>
					<div className="flex items-center gap-2 mt-3">
						{levelInfo.concepts.map((concept) => (
							<Badge key={concept} variant="default">
								{concept}
							</Badge>
						))}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="space-y-6">
				{/* Scenario */}
				{levelInfo.scenario && (
					<Alert variant="info">
						<Info />
						<AlertDescription>{levelInfo.scenario}</AlertDescription>
					</Alert>
				)}

				{/* Problem Code */}
				{levelInfo.problem && (
					<div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
						<div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
							<Code className="w-4 h-4 text-destructive" />
							<span className="text-xs font-semibold text-destructive uppercase tracking-wider">
								The Problem
							</span>
						</div>
						<CodeBlock code={levelInfo.problem} language="ruby" />
					</div>
				)}

				{/* Metrics (if available) */}
				{levelInfo.initialMetrics && (
					<div className="grid grid-cols-2 gap-3">
						<div className="bg-card rounded-xl p-4 text-center border border-border">
							<div className="text-3xl font-bold text-destructive tabular-nums">
								{levelInfo.initialMetrics.queries}
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								queries per request
							</div>
						</div>
						<div className="bg-card rounded-xl p-4 text-center border border-border">
							<div className="text-3xl font-bold text-warning tabular-nums">
								{levelInfo.initialMetrics.latency}ms
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								response latency
							</div>
						</div>
					</div>
				)}

				{/* Goal + Learning Goals side by side on lg */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Goal */}
					{levelInfo.goal && (
						<div className="rounded-xl bg-success/5 border border-success/20 p-5">
							<div className="flex items-start gap-3">
								<Target className="w-5 h-5 text-success shrink-0 mt-0.5" />
								<div>
									<span className="text-xs font-medium text-success uppercase tracking-wider">
										Your Goal
									</span>
									<p className="text-sm text-foreground leading-relaxed mt-1">
										{levelInfo.goal}
									</p>
								</div>
							</div>
						</div>
					)}

					{/* What You'll Learn */}
					{levelInfo.learningGoals && levelInfo.learningGoals.length > 0 && (
						<div className="rounded-xl bg-primary/5 border border-primary/15 p-5">
							<div className="flex items-center gap-2 mb-3">
								<BookOpen className="w-4 h-4 text-primary" />
								<span className="text-xs font-semibold text-primary uppercase tracking-wider">
									What You'll Learn
								</span>
							</div>
							<ul className="space-y-1.5">
								{levelInfo.learningGoals.map((goal) => (
									<li
										key={goal}
										className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
									>
										<span className="mt-2 block w-1 h-1 rounded-full bg-primary/50 shrink-0" />
										{goal}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>

			{/* CTA */}
			<div className="mt-10">
				<Button
					className="w-full h-12 text-base shadow-lg shadow-primary/20"
				>
					<a href={`/acts/${levelInfo.actId}/${levelId}/play`} className="flex items-center justify-center w-full no-underline">
						<Play className="w-5 h-5 mr-2" />
						Start Challenge
					</a>
				</Button>
			</div>
		</div>
	);
}

export default LevelInfoApp;
