import { useState, useEffect } from 'react';
import { getRealms } from '../../lib/api';
import type { Realm } from '../../../../shared/types';
import { Button } from '../ui/Button';

interface RealmCardProps {
  realm: Realm;
  index: number;
}

function RealmCard({ realm, index }: RealmCardProps) {
  const isLocked = !realm.isUnlocked;
  const progress = realm.totalDungeons > 0
    ? Math.round((realm.dungeonsCompleted / realm.totalDungeons) * 100)
    : 0;

  // Different icons for different realms
  const icons = ['🏰', '📚', '🗺️', '🎮', '🎨', '🗄️', '⚡', '📧', '💎', '🚀', '👑'];

  return (
    <a
      href={isLocked ? '#' : `/realms/${realm.id}`}
      className={`realm-card ${isLocked ? 'locked' : ''}`}
      onClick={(e) => isLocked && e.preventDefault()}
    >
      <div className="realm-icon">{isLocked ? '🔒' : icons[index] || '⚔️'}</div>
      <div className="realm-info">
        <h3 className="realm-name">{realm.name}</h3>
        <p className="realm-desc">{realm.description}</p>
        {!isLocked && (
          <div className="realm-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">
              {realm.dungeonsCompleted}/{realm.totalDungeons} Levels
            </span>
          </div>
        )}
      </div>
      {realm.dungeonsCompleted === realm.totalDungeons && realm.totalDungeons > 0 && (
        <div className="realm-complete">✓</div>
      )}
    </a>
  );
}

export default function RealmMap() {
  const [realms, setRealms] = useState<Realm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRealms() {
      try {
        const data = await getRealms();
        setRealms(data.realms);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load realms');
      } finally {
        setLoading(false);
      }
    }

    loadRealms();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <span className="loading-text">Loading realms...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error pixel-panel">
        <p>Error: {error}</p>
        <Button onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="realm-map">
      <div className="realm-header">
        <h1>Choose Your Realm</h1>
        <p>Complete levels to unlock new realms and become a Rails Master!</p>
      </div>

      <div className="realm-grid">
        {realms.map((realm, index) => (
          <RealmCard key={realm.id} realm={realm} index={index} />
        ))}
      </div>
    </div>
  );
}
