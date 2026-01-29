interface HealthBarProps {
  current: number;
  max: number;
  type?: 'hp' | 'xp';
  showText?: boolean;
}

export default function HealthBar({
  current,
  max,
  type = 'hp',
  showText = true,
}: HealthBarProps) {
  const percent = Math.round((current / max) * 100);
  const isLow = type === 'hp' && percent < 25;

  return (
    <div className={`health-bar stat-bar ${isLow ? 'low' : ''}`}>
      <div
        className={`stat-bar-fill ${type}`}
        style={{ width: `${percent}%` }}
      />
      {showText && (
        <span className="stat-bar-text">
          {current}/{max}
        </span>
      )}
    </div>
  );
}
