import { useStore } from '@nanostores/react';
import { $xpToNextLevel, $progress } from '../../stores/gameStore';

export default function XPBar() {
  const progress = useStore($progress);
  const xpInfo = useStore($xpToNextLevel);

  if (!progress) return null;

  return (
    <div className="xp-bar-container">
      <div className="xp-level">
        <span className="level-badge">LVL {progress.level}</span>
      </div>
      <div className="xp-bar stat-bar">
        <div
          className="stat-bar-fill xp"
          style={{ width: `${xpInfo.percent}%` }}
        />
        <span className="stat-bar-text">
          {xpInfo.current}/{xpInfo.needed} XP
        </span>
      </div>
    </div>
  );
}
