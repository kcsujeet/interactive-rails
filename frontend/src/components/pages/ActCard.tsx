import { Check, ChevronRight, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { Act } from '@/types/game';

interface ActCardProps {
	act: Act;
	isUnlocked: boolean;
	isCompleted: boolean;
	completedCount: number;
}

export function ActCard({
	act,
	isUnlocked,
	isCompleted,
	completedCount,
}: ActCardProps) {
	const content = (
		<div className="flex items-center justify-between w-full">
			<div className="flex items-center gap-4">
				<div
					className={`
						w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold
						${
							isCompleted
								? 'bg-success/15 text-success'
								: isUnlocked
									? 'bg-primary/10 text-primary border border-primary/20'
									: 'bg-secondary text-muted-foreground'
						}
					`}
				>
					{isCompleted ? <Check className="w-5 h-5" /> : act.id}
				</div>
				<div>
					<h3 className="text-base font-medium text-foreground">
						{act.name}
					</h3>
					<p className="text-sm text-muted-foreground mt-0.5">{act.tagline}</p>
					<div className="flex items-center gap-2 mt-2">
						<div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
							<div
								className="h-full bg-linear-to-r from-primary to-amber-400 transition-all"
								style={{
									width: `${Math.round((completedCount / act.levels.length) * 100)}%`,
								}}
							/>
						</div>
						<span className="text-xs text-muted-foreground tabular-nums">
							{completedCount}/{act.levels.length}
						</span>
						<Badge variant="secondary" size="sm">
							L{act.levels[0].levelNumber}–{act.levels[act.levels.length - 1].levelNumber}
						</Badge>
					</div>
				</div>
			</div>
			<div className="shrink-0">
				{isUnlocked ? (
					<ChevronRight className="w-5 h-5 text-muted-foreground" />
				) : (
					<Lock className="w-5 h-5 text-muted-foreground" />
				)}
			</div>
		</div>
	);

	return (
		<Card
			className={`
				p-5 gap-0 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both
				${
					isUnlocked
						? 'transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_20px_oklch(0.65_0.25_18/0.08)] hover:-translate-y-0.5'
						: 'border-transparent opacity-50'
				}
			`}
		>
			{isUnlocked ? (
				<a
					className="flex items-center justify-between w-full no-underline"
					href={`/acts/${act.id}`}
				>
					{content}
				</a>
			) : (
				content
			)}
		</Card>
	);
}
