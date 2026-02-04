/**
 * Level Info App Component
 *
 * Displays level briefing information before starting the challenge.
 */

import { useEffect, useState } from 'react';
import { getLevel, getActForLevel } from '../../content/acts';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { levelChallenges } from '../game';
import { Play, Target, Code, ChevronRight } from 'lucide-react';
import { CodeBlock } from '../ui/CodeBlock';

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
	initialMetrics?: {
		queries: number;
		latency: number;
	};
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
					goal: level.problem.goal || 'Fix the pipeline to complete this level.',
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

	function startLevel() {
		window.location.href = `/acts/${levelInfo?.actId}/${levelId}/play`;
	}

	if (loading || !levelInfo) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return (
		<div className="max-w-3xl mx-auto">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-1.5 text-sm mb-6">
				<a href="/acts" className="text-muted-foreground hover:text-foreground transition-colors">
					Acts
				</a>
				<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
				<a href={`/acts/${levelInfo.actId}`} className="text-muted-foreground hover:text-foreground transition-colors">
					{levelInfo.actName}
				</a>
				<ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
				<span className="text-foreground font-medium">
					Level {levelInfo.levelNumber}
				</span>
			</nav>

			{/* Header */}
			<div className="flex items-start gap-5 mb-8">
				<div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
					<span className="text-xl font-bold text-primary">{levelInfo.levelNumber}</span>
				</div>
				<div className="flex-1 min-w-0">
					<h1 className="text-2xl font-semibold text-foreground mb-2">
						{levelInfo.name}
					</h1>
					<p className="text-muted-foreground text-sm leading-relaxed">
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
			<div className="space-y-5">
				{/* Scenario - Subtle inline */}
				{levelInfo.scenario && (
					<p className="text-sm text-muted-foreground leading-relaxed pl-4 border-l-2 border-border">
						{levelInfo.scenario}
					</p>
				)}

				{/* Problem Card - Prominent (red = something to fix) */}
				{levelInfo.problem && (
					<div className="rounded-xl border-2 border-destructive/20 overflow-hidden bg-destructive/[0.02]">
						<div className="px-5 py-3 bg-destructive/5 border-b border-destructive/10 flex items-center gap-2">
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

				{/* Goal Card */}
				{levelInfo.goal && (
					<div className="bg-success/5 rounded-xl p-5 border border-success/20">
						<div className="flex items-start gap-4">
							<div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
								<Target className="w-5 h-5 text-success" />
							</div>
							<div className="flex-1">
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
			</div>

			{/* Action */}
			<div className="mt-8">
				<Button className="w-full h-12 text-base" onClick={startLevel}>
					<Play className="w-5 h-5 mr-2" />
					Start Challenge
				</Button>
			</div>
		</div>
	);
}

export default LevelInfoApp;
