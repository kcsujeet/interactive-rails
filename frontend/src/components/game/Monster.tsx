import type { ReactNode } from 'react';
import {
	Skull,
	Bug,
	Ghost,
	Flame,
	Box,
	Crown,
	Settings,
	Package,
	Eye,
	Map,
	Search,
	AlertTriangle,
	BarChart3,
	Database,
	RefreshCw,
	Link,
	Wrench,
	Cog,
	TestTube,
	Gem,
	Globe,
	HardDrive,
	Zap,
	Mail,
	Swords,
} from 'lucide-react';

interface MonsterProps {
	name: string;
	hp: number;
	image?: string;
	showDamage: boolean;
	isDefeated: boolean;
}

// Map monster names to Lucide icons
function getMonsterIcon(name: string): ReactNode {
	const lowerName = name.toLowerCase();
	const iconClass = "w-8 h-8";

	if (
		lowerName.includes('boss') ||
		lowerName.includes('king') ||
		lowerName.includes('overlord')
	)
		return <Swords className={iconClass} />;
	if (lowerName.includes('dragon')) return <Flame className={iconClass} />;
	if (lowerName.includes('bug') || lowerName.includes('pest')) return <Bug className={iconClass} />;
	if (
		lowerName.includes('ghost') ||
		lowerName.includes('phantom') ||
		lowerName.includes('specter')
	)
		return <Ghost className={iconClass} />;
	if (lowerName.includes('snake') || lowerName.includes('serpent')) return <Swords className={iconClass} />;
	if (lowerName.includes('spider') || lowerName.includes('crawler')) return <Bug className={iconClass} />;
	if (lowerName.includes('bat') || lowerName.includes('vampire')) return <Ghost className={iconClass} />;
	if (lowerName.includes('troll') || lowerName.includes('ogre')) return <Swords className={iconClass} />;
	if (lowerName.includes('rat') || lowerName.includes('rodent')) return <Bug className={iconClass} />;
	if (lowerName.includes('wolf') || lowerName.includes('hound')) return <Swords className={iconClass} />;
	if (
		lowerName.includes('bird') ||
		lowerName.includes('vulture') ||
		lowerName.includes('raven')
	)
		return <Swords className={iconClass} />;
	if (lowerName.includes('demon') || lowerName.includes('devil')) return <Flame className={iconClass} />;
	if (lowerName.includes('elemental')) return <Flame className={iconClass} />;
	if (lowerName.includes('golem') || lowerName.includes('construct'))
		return <Box className={iconClass} />;
	if (lowerName.includes('fiend') || lowerName.includes('creature'))
		return <Swords className={iconClass} />;
	if (lowerName.includes('elf') || lowerName.includes('pixie')) return <Swords className={iconClass} />;
	if (lowerName.includes('wraith') || lowerName.includes('reaper')) return <Skull className={iconClass} />;

	// Rails-specific monsters
	if (lowerName.includes('controller')) return <Settings className={iconClass} />;
	if (lowerName.includes('model') || lowerName.includes('record')) return <Package className={iconClass} />;
	if (lowerName.includes('view') || lowerName.includes('erb')) return <Eye className={iconClass} />;
	if (lowerName.includes('route') || lowerName.includes('path')) return <Map className={iconClass} />;
	if (lowerName.includes('query') || lowerName.includes('n+1')) return <Search className={iconClass} />;
	if (lowerName.includes('validation')) return <AlertTriangle className={iconClass} />;
	if (lowerName.includes('migration') || lowerName.includes('schema'))
		return <BarChart3 className={iconClass} />;
	if (lowerName.includes('database') || lowerName.includes('table')) return <Database className={iconClass} />;
	if (lowerName.includes('callback')) return <RefreshCw className={iconClass} />;
	if (lowerName.includes('association') || lowerName.includes('relation'))
		return <Link className={iconClass} />;
	if (lowerName.includes('helper')) return <Wrench className={iconClass} />;
	if (lowerName.includes('config') || lowerName.includes('environment'))
		return <Cog className={iconClass} />;
	if (lowerName.includes('test') || lowerName.includes('spec')) return <TestTube className={iconClass} />;
	if (lowerName.includes('gem') || lowerName.includes('dependency'))
		return <Gem className={iconClass} />;
	if (lowerName.includes('api') || lowerName.includes('json')) return <Globe className={iconClass} />;
	if (lowerName.includes('cache')) return <HardDrive className={iconClass} />;
	if (lowerName.includes('job') || lowerName.includes('worker')) return <Zap className={iconClass} />;
	if (lowerName.includes('mail') || lowerName.includes('email')) return <Mail className={iconClass} />;

	return <Swords className={iconClass} />;
}

function getMonsterColor(name: string): string {
	const lowerName = name.toLowerCase();

	if (lowerName.includes('boss'))
		return 'linear-gradient(135deg, #9b59b6, #8e44ad)';
	if (lowerName.includes('dragon'))
		return 'linear-gradient(135deg, #e74c3c, #c0392b)';
	if (lowerName.includes('ghost') || lowerName.includes('phantom'))
		return 'linear-gradient(135deg, #95a5a6, #7f8c8d)';
	if (lowerName.includes('bug'))
		return 'linear-gradient(135deg, #27ae60, #1e8449)';
	if (lowerName.includes('controller'))
		return 'linear-gradient(135deg, #3498db, #2980b9)';
	if (lowerName.includes('model'))
		return 'linear-gradient(135deg, #e67e22, #d35400)';
	if (lowerName.includes('view'))
		return 'linear-gradient(135deg, #9b59b6, #8e44ad)';
	if (lowerName.includes('route'))
		return 'linear-gradient(135deg, #f1c40f, #f39c12)';
	if (lowerName.includes('query'))
		return 'linear-gradient(135deg, #1abc9c, #16a085)';
	if (lowerName.includes('validation'))
		return 'linear-gradient(135deg, #e74c3c, #c0392b)';

	return 'linear-gradient(135deg, #34495e, #2c3e50)';
}

export default function Monster({
	name,
	hp,
	showDamage,
	isDefeated,
}: MonsterProps) {
	const icon = getMonsterIcon(name);
	const bgColor = getMonsterColor(name);
	const isBoss = name.toLowerCase().includes('boss');

	return (
		<div
			className={`monster ${showDamage ? 'shake' : ''} ${isDefeated ? 'defeated' : ''}`}
		>
			<div className="monster-name">{name}</div>

			{/* Monster HP Bar */}
			<div className="monster-hp-bar">
				<div
					className="monster-hp-fill"
					style={{
						width: `${hp}%`,
						background: hp > 50 ? '#27ae60' : hp > 25 ? '#f1c40f' : '#e74c3c',
					}}
				/>
				<span className="monster-hp-text">{Math.round(hp)}%</span>
			</div>

			{/* Pixel Art Monster */}
			<div
				className={`monster-sprite ${isBoss ? 'boss' : ''}`}
				style={{ background: bgColor }}
			>
				{isDefeated ? (
					<div className="monster-defeated-text">
						<span className="defeat-emoji"><Skull className="w-8 h-8" /></span>
						<span>DEFEATED!</span>
					</div>
				) : (
					<div className="monster-display">
						<span className="monster-emoji">{icon}</span>
						{isBoss && <span className="boss-crown"><Crown className="w-6 h-6" /></span>}
					</div>
				)}
			</div>

			{showDamage && (
				<div className="damage-number">
					<span>-{Math.round(100 - hp)}!</span>
				</div>
			)}
		</div>
	);
}
