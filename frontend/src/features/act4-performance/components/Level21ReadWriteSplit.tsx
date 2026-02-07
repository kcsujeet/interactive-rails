/**
 * Level 21: Read/Write Split
 *
 * Route read queries to replica for scaling.
 * Shows blue (read) and orange (write) traffic separation.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';
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

interface Query {
	id: number;
	type: 'read' | 'write';
	target: 'primary' | 'replica';
}

export function Level21ReadWriteSplit({
	onComplete,
	onExit,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [replicaEnabled, setReplicaEnabled] = useState(false);
	const [queries, setQueries] = useState<Query[]>([]);
	const [primaryLoad, setPrimaryLoad] = useState(0);
	const [replicaLoad, setReplicaLoad] = useState(0);
	const [readCount, setReadCount] = useState(0);
	const [writeCount, setWriteCount] = useState(0);

	const isComplete = replicaEnabled && primaryLoad < 50 && readCount >= 10;

	// Simulate queries
	useEffect(() => {
		const interval = setInterval(() => {
			const id = Date.now();
			const isRead = Math.random() > 0.3; // 70% reads
			const type = isRead ? 'read' : 'write';
			const target = replicaEnabled && isRead ? 'replica' : 'primary';

			if (type === 'read') setReadCount((c) => c + 1);
			else setWriteCount((c) => c + 1);

			// Update load
			if (target === 'primary') {
				setPrimaryLoad((l) => Math.min(100, l + (isRead ? 8 : 5)));
			} else {
				setReplicaLoad((l) => Math.min(100, l + 8));
			}

			setQueries((prev) => [...prev.slice(-15), { id, type, target }]);
		}, 400);

		// Load decay
		const loadInterval = setInterval(() => {
			setPrimaryLoad((l) => Math.max(0, l - 3));
			setReplicaLoad((l) => Math.max(0, l - 3));
		}, 300);

		return () => {
			clearInterval(interval);
			clearInterval(loadInterval);
		};
	}, [replicaEnabled]);

	const handleComplete = async () => {
		const success = await completeLevel('act4-level21-read-write-splitting', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Learn to scale reads with database replicas using Rails multi-database support."
					instructions={[
						'Watch all queries (blue=read, orange=write) hit primary',
						'Enable read replica',
						'See reads route to replica, writes stay on primary',
					]}
					scenario="The primary database is at 95% CPU! Most queries are SELECTs, but they're all hitting the same database as writes."
				>
					<div className="p-4 border-t border-border">
						<Button
							className={`w-full py-3 ${
								replicaEnabled
									? 'bg-success text-success-foreground cursor-default'
									: ''
							}`}
							disabled={replicaEnabled}
							onClick={() => setReplicaEnabled(true)}
						>
							{replicaEnabled ? 'Replica Enabled' : 'Enable Read Replica'}
						</Button>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Query Distribution
						</div>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-primary" />
								<span className="text-foreground text-sm">
									Reads: {readCount}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 rounded bg-warning" />
								<span className="text-foreground text-sm">
									Writes: {writeCount}
								</span>
							</div>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={4}
					levelName="Read/Write Split"
					levelNumber={21}
					onExit={onExit}
					onReset={() => {
						setReplicaEnabled(false);
						setQueries([]);
						setPrimaryLoad(0);
						setReplicaLoad(0);
						setReadCount(0);
						setWriteCount(0);
					}}
				/>

				<div className="flex-1 relative bg-background p-8">
					{/* Architecture */}
					<div className="flex justify-center gap-16 mb-8">
						{/* App */}
						<div className="flex flex-col items-center">
							<div className="bg-card border border-border rounded-xl p-4 w-32 text-center">
								<div className="text-2xl mb-2">A</div>
								<div className="text-muted-foreground text-sm">App</div>
							</div>
						</div>

						{/* Databases */}
						<div className="flex flex-col gap-4">
							{/* Primary */}
							<div
								className={`border rounded-xl p-4 w-48 transition-colors ${
									primaryLoad > 80
										? 'bg-destructive/20 border-destructive'
										: primaryLoad > 50
											? 'bg-warning/20 border-warning'
											: 'bg-card border-border'
								}`}
							>
								<div className="flex items-center justify-between mb-2">
									<span
										className={`font-medium ${
											primaryLoad > 80
												? 'text-destructive'
												: primaryLoad > 50
													? 'text-warning'
													: 'text-foreground'
										}`}
									>
										Primary DB
									</span>
									<span className="text-xs text-warning">writes</span>
								</div>
								<div className="bg-secondary rounded-full h-3 overflow-hidden">
									<div
										className={`h-full transition-all ${
											primaryLoad > 80
												? 'bg-destructive'
												: primaryLoad > 50
													? 'bg-warning'
													: 'bg-success'
										}`}
										style={{ width: `${primaryLoad}%` }}
									/>
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									CPU: {Math.round(primaryLoad)}%
								</div>
							</div>

							{/* Replica */}
							{replicaEnabled && (
								<div className="bg-primary/20 border border-primary rounded-xl p-4 w-48">
									<div className="flex items-center justify-between mb-2">
										<span className="text-primary font-medium">Replica DB</span>
										<span className="text-xs text-primary">reads</span>
									</div>
									<div className="bg-secondary rounded-full h-3 overflow-hidden">
										<div
											className="h-full transition-all bg-primary"
											style={{ width: `${replicaLoad}%` }}
										/>
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										CPU: {Math.round(replicaLoad)}%
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Query Stream */}
					<div className="bg-card rounded-xl p-4 max-w-xl mx-auto">
						<div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">
							Query Stream
						</div>
						<div className="flex flex-wrap gap-2 h-24 overflow-hidden">
							{queries.map((q) => (
								<div
									className={`px-2 py-1 rounded text-xs font-medium ${
										q.type === 'read'
											? 'bg-primary/30 text-primary'
											: 'bg-warning/30 text-warning'
									}`}
									key={q.id}
								>
									{q.type === 'read' ? 'SELECT' : 'INSERT'}
									<span className="text-muted-foreground ml-1">
										→ {q.target}
									</span>
								</div>
							))}
						</div>
					</div>

					{/* Replication lag warning */}
					{replicaEnabled && (
						<div className="mt-4 max-w-xl mx-auto bg-warning/10 border border-warning/50 rounded-lg p-3 text-warning text-sm">
							Note: Replicas may have slight lag (~100ms). Reads after writes
							should use primary.
						</div>
					)}

					{/* Completion button */}
					{isComplete && (
						<div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
							<Button
								className="px-8 py-3 bg-linear-to-r from-success to-success/80 text-success-foreground font-bold shadow-lg"
								onClick={handleComplete}
							>
								Complete Level
							</Button>
						</div>
					)}
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/database.yml',
							language: 'yaml',
							code: `production:
  primary:
    database: myapp_production
    adapter: postgresql
    host: db-primary.example.com

  primary_replica:
    database: myapp_production
    adapter: postgresql
    host: db-replica.example.com
    replica: true

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true

  connects_to database: {
    writing: :primary,
    reading: :primary_replica
  }
end

# Automatic routing:
# - Model.find, Model.where → replica
# - Model.create, Model.update → primary`,
							highlight: [6, 11, 12, 18, 19, 20],
						},
					]}
					learningGoal="Read replicas scale read-heavy workloads. Rails 6+ has built-in support for automatic read/write routing."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level21ReadWriteSplit;
