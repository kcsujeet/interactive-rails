import { selectLevelProgress, useGameStore } from '@/stores';

export default function XPBar() {
	const level = useGameStore((state) => state.level);
	const xp = useGameStore((state) => state.xp);
	const xpToNextLevel = useGameStore((state) => state.xpToNextLevel);
	const progressPercent = useGameStore(selectLevelProgress);

	return (
		<div className="xp-bar-container">
			<div className="xp-level">
				<span className="level-badge">LVL {level}</span>
			</div>
			<div className="xp-bar stat-bar">
				<div
					className="stat-bar-fill xp"
					style={{ width: `${progressPercent}%` }}
				/>
				<span className="stat-bar-text">
					{xp}/{xpToNextLevel} XP
				</span>
			</div>
		</div>
	);
}
