/**
 * Level 49: Database Sharding
 *
 * Horizontal partitioning across multiple databases.
 * Shows tenant-based sharding strategy.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ValidationResult } from '@/components/levels';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

interface Tenant {
	id: number;
	name: string;
	shard: number;
	records: number;
}

interface Query {
	id: number;
	tenant: string;
	shard: number;
}

export function Level49Sharding({ onComplete, onExit }: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [shardingEnabled, setShardingEnabled] = useState(false);
	const [tenants] = useState<Tenant[]>([
		{ id: 1, name: 'Acme Corp', shard: 0, records: 5000000 },
		{ id: 2, name: 'Globex Inc', shard: 1, records: 3000000 },
		{ id: 3, name: 'Initech', shard: 0, records: 2000000 },
		{ id: 4, name: 'Umbrella', shard: 1, records: 4000000 },
	]);
	const [queries, setQueries] = useState<Query[]>([]);
	const [shard0Load, setShard0Load] = useState(0);
	const [shard1Load, setShard1Load] = useState(0);
	const [singleDbLoad, setSingleDbLoad] = useState(0);

	const handleValidate = useCallback((): ValidationResult => {
		if (!shardingEnabled) {
			return {
				valid: false,
				message: 'Enable sharding',
				details: [
					'Click "Enable Sharding" to distribute data across databases',
				],
			};
		}
		if (shard0Load >= 60 || shard1Load >= 60) {
			return {
				valid: false,
				message: 'Shards still loaded',
				details: ['Wait for load to balance across shards (both need < 60%)'],
			};
		}
		return {
			valid: true,
			message: 'Sharding distributes load across databases!',
		};
	}, [shardingEnabled, shard0Load, shard1Load]);

	// Simulate queries
	useEffect(() => {
		const interval = setInterval(() => {
			const tenant = tenants[Math.floor(Math.random() * tenants.length)];
			const id = Date.now();

			if (shardingEnabled) {
				if (tenant.shard === 0) {
					setShard0Load((l) => Math.min(100, l + 8));
				} else {
					setShard1Load((l) => Math.min(100, l + 8));
				}
			} else {
				setSingleDbLoad((l) => Math.min(100, l + 10));
			}

			setQueries((prev) => [
				...prev.slice(-12),
				{
					id,
					tenant: tenant.name,
					shard: tenant.shard,
				},
			]);
		}, 400);

		// Load decay
		const loadInterval = setInterval(() => {
			setShard0Load((l) => Math.max(0, l - 4));
			setShard1Load((l) => Math.max(0, l - 4));
			setSingleDbLoad((l) => Math.max(0, l - 3));
		}, 300);

		return () => {
			clearInterval(interval);
			clearInterval(loadInterval);
		};
	}, [shardingEnabled, tenants]);

	const handleComplete = async () => {
		const success = await completeLevel('act8-level49-sharding', { stars: 3 });
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const totalRecords = tenants.reduce((sum, t) => sum + t.records, 0);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn horizontal database sharding for massive scale."
					instructions={[
						'Watch the single database struggle with all data',
						'Enable tenant-based sharding',
						'See queries route to the correct shard',
					]}
					scenario="We have 14M user records in a single database. Even with replicas, the single DB can't keep up. We need to split the data across multiple databases."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								shardingEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={shardingEnabled}
							onClick={() => setShardingEnabled(true)}
						>
							{shardingEnabled ? 'Sharding Enabled' : 'Enable Sharding'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Tenant Distribution
						</div>
						<div className="space-y-2 text-sm">
							{tenants.map((t) => (
								<div className="flex items-center justify-between" key={t.id}>
									<span className="text-foreground">{t.name}</span>
									<span
										className={`text-xs px-2 py-0.5 rounded ${
											t.shard === 0
												? 'bg-primary/30 text-primary'
												: 'bg-success/30 text-success'
										}`}
									>
										Shard {t.shard}
									</span>
								</div>
							))}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
							Total Records
						</div>
						<div className="text-2xl font-bold text-foreground">
							{(totalRecords / 1000000).toFixed(1)}M
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={8}
					levelName="Database Sharding"
					levelNumber={49}
					onComplete={handleComplete}
					onExit={onExit}
					onReset={() => {
						setShardingEnabled(false);
						setQueries([]);
						setShard0Load(0);
						setShard1Load(0);
						setSingleDbLoad(0);
					}}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex justify-center gap-8 mb-8">
						{/* App + Router */}
						<div className="flex flex-col items-center gap-4">
							<div className="bg-card border border-border rounded-xl p-4 w-32 text-center">
								<div className="text-2xl mb-2">A</div>
								<div className="text-muted-foreground text-sm">App</div>
							</div>
							{shardingEnabled && (
								<div className="bg-primary/20 border border-primary rounded-lg px-4 py-2">
									<div className="text-primary text-xs">Shard Router</div>
									<div className="text-primary/80 text-xs mt-1">
										tenant_id % 2
									</div>
								</div>
							)}
						</div>

						{/* Databases */}
						{shardingEnabled ? (
							<div className="flex gap-4">
								{/* Shard 0 */}
								<div
									className={`border rounded-xl p-4 w-44 transition-colors ${
										shard0Load > 80
											? 'bg-destructive/20 border-destructive'
											: shard0Load > 60
												? 'bg-warning/20 border-warning'
												: 'bg-primary/20 border-primary'
									}`}
								>
									<div className="text-primary font-medium mb-2">Shard 0</div>
									<div className="text-xs text-muted-foreground mb-2">
										7M records
									</div>
									<div className="bg-secondary rounded-full h-3 overflow-hidden">
										<div
											className={`h-full transition-all ${
												shard0Load > 80
													? 'bg-destructive'
													: shard0Load > 60
														? 'bg-warning'
														: 'bg-primary'
											}`}
											style={{ width: `${shard0Load}%` }}
										/>
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										CPU: {Math.round(shard0Load)}%
									</div>
								</div>

								{/* Shard 1 */}
								<div
									className={`border rounded-xl p-4 w-44 transition-colors ${
										shard1Load > 80
											? 'bg-destructive/20 border-destructive'
											: shard1Load > 60
												? 'bg-warning/20 border-warning'
												: 'bg-success/20 border-success'
									}`}
								>
									<div className="text-success font-medium mb-2">Shard 1</div>
									<div className="text-xs text-muted-foreground mb-2">
										7M records
									</div>
									<div className="bg-secondary rounded-full h-3 overflow-hidden">
										<div
											className={`h-full transition-all ${
												shard1Load > 80
													? 'bg-destructive'
													: shard1Load > 60
														? 'bg-warning'
														: 'bg-success'
											}`}
											style={{ width: `${shard1Load}%` }}
										/>
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										CPU: {Math.round(shard1Load)}%
									</div>
								</div>
							</div>
						) : (
							<div
								className={`border rounded-xl p-6 w-56 transition-colors ${
									singleDbLoad > 80
										? 'bg-destructive/20 border-destructive'
										: singleDbLoad > 60
											? 'bg-warning/20 border-warning'
											: 'bg-card border-border'
								}`}
							>
								<div
									className={`font-medium mb-2 ${
										singleDbLoad > 80 ? 'text-destructive' : 'text-foreground'
									}`}
								>
									Single Database
								</div>
								<div className="text-xs text-muted-foreground mb-2">
									14M records
								</div>
								<div className="bg-secondary rounded-full h-4 overflow-hidden">
									<div
										className={`h-full transition-all ${
											singleDbLoad > 80
												? 'bg-destructive'
												: singleDbLoad > 60
													? 'bg-warning'
													: 'bg-success'
										}`}
										style={{ width: `${singleDbLoad}%` }}
									/>
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									CPU: {Math.round(singleDbLoad)}%
								</div>
								{singleDbLoad > 80 && (
									<div className="text-destructive text-xs mt-2">
										Overloaded!
									</div>
								)}
							</div>
						)}
					</div>

					{/* Query Stream */}
					<div className="bg-card rounded-xl p-4 max-w-xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Query Routing
						</div>
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{queries.map((q) => (
								<div
									className="flex items-center justify-between text-sm"
									key={q.id}
								>
									<span className="text-foreground">{q.tenant}</span>
									<span
										className={`text-xs px-2 py-0.5 rounded ${
											q.shard === 0
												? 'bg-primary/30 text-primary'
												: 'bg-success/30 text-success'
										}`}
									>
										→ Shard {q.shard}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/application_record.rb',
							language: 'ruby',
							code: `class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to shards: {
    shard_0: { writing: :shard_0, reading: :shard_0_replica },
    shard_1: { writing: :shard_1, reading: :shard_1_replica }
  }
end

# Shard selection based on tenant
class ShardRouter
  def self.shard_for(tenant)
    "shard_#{tenant.id % 2}".to_sym
  end

  def self.with_tenant(tenant, &block)
    ActiveRecord::Base.connected_to(shard: shard_for(tenant)) do
      block.call
    end
  end
end

# Usage:
ShardRouter.with_tenant(current_tenant) do
  User.where(email: params[:email]).first
end`,
							highlight: [4, 5, 6, 13, 16, 17, 18, 23, 24, 25],
						},
					]}
					learningGoal="Sharding splits data across multiple databases. Choose a shard key (like tenant_id) that keeps related data together."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level49Sharding;
