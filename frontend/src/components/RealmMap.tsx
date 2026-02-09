import {
	BookOpen,
	Castle,
	Check,
	Crown,
	Database,
	Gem,
	Lock,
	Mail,
	Map,
	Palette,
	Rocket,
	Settings,
	Sword,
	Zap,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { getRealms } from '@/lib/api';
import type { Realm } from '../../../shared/types';
import { Button } from './ui/Button';

interface RealmCardProps {
	realm: Realm;
	index: number;
}

function RealmCard({ realm, index }: RealmCardProps) {
	const isLocked = !realm.isUnlocked;
	const progress =
		realm.totalDungeons > 0
			? Math.round((realm.dungeonsCompleted / realm.totalDungeons) * 100)
			: 0;

	// Different icons for different realms
	const icons: ReactNode[] = [
		<Castle className="w-6 h-6" key="castle" />,
		<BookOpen className="w-6 h-6" key="book" />,
		<Map className="w-6 h-6" key="map" />,
		<Settings className="w-6 h-6" key="settings" />,
		<Palette className="w-6 h-6" key="palette" />,
		<Database className="w-6 h-6" key="database" />,
		<Zap className="w-6 h-6" key="zap" />,
		<Mail className="w-6 h-6" key="mail" />,
		<Gem className="w-6 h-6" key="gem" />,
		<Rocket className="w-6 h-6" key="rocket" />,
		<Crown className="w-6 h-6" key="crown" />,
	];

	return (
		<a
			className={`realm-card ${isLocked ? 'locked' : ''}`}
			href={isLocked ? '#' : `/realms/${realm.id}`}
			onClick={(e) => isLocked && e.preventDefault()}
		>
			<div className="realm-icon">
				{isLocked ? (
					<Lock className="w-6 h-6" />
				) : (
					icons[index] || <Sword className="w-6 h-6" />
				)}
			</div>
			<div className="realm-info">
				<h3 className="realm-name">{realm.name}</h3>
				<p className="realm-desc">{realm.description}</p>
				{!isLocked && (
					<div className="realm-progress">
						<div className="progress-bar">
							<div
								className="progress-fill"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<span className="progress-text">
							{realm.dungeonsCompleted}/{realm.totalDungeons} Levels
						</span>
					</div>
				)}
			</div>
			{realm.dungeonsCompleted === realm.totalDungeons &&
				realm.totalDungeons > 0 && (
					<div className="realm-complete">
						<Check className="w-5 h-5" />
					</div>
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
				<Button onClick={() => window.location.reload()}>Retry</Button>
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
					<RealmCard index={index} key={realm.id} realm={realm} />
				))}
			</div>
		</div>
	);
}
