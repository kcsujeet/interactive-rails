/**
 * Level 45: Multi-Tenancy
 *
 * Strategy picker with data isolation visualization.
 * Shows how acts_as_tenant scopes queries to prevent data leaks.
 */

import {
	Building2,
	Database,
	Eye,
	EyeOff,
	Lock,
	ShieldCheck,
	Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import {
	CenterPanel,
	CodePreviewPanel,
	InstructionPanel,
	LeftPanel,
	LevelHeader,
	LevelLayout,
	RightPanel,
	useLevelCompletion,
	type ValidationResult,
} from '@/components/levels';
import { Button } from '@/components/ui/Button';
import type { LevelComponentProps } from '@/features/levels-registry';

// --- Types ---

type TenancyStrategy = 'shared-db' | 'schema-per-tenant' | 'db-per-tenant';

interface StrategyInfo {
	id: TenancyStrategy;
	name: string;
	description: string;
	isolation: string;
	isolationLevel: number; // 1-3
	complexity: string;
	complexityLevel: number; // 1-3
	cost: string;
	costLevel: number; // 1-3
	performance: string;
	performanceLevel: number; // 1-3
	recommended?: boolean;
}

interface TenantRecord {
	id: number;
	name: string;
	companyId: number;
	companyName: string;
}

interface ModelConfig {
	name: string;
	enabled: boolean;
}

// --- Data ---

const STRATEGIES: StrategyInfo[] = [
	{
		id: 'shared-db',
		name: 'Shared DB + tenant_id',
		description:
			'All tenants share one database. A tenant_id column scopes every query.',
		isolation: 'Row-level',
		isolationLevel: 1,
		complexity: 'Low',
		complexityLevel: 1,
		cost: 'Low',
		costLevel: 1,
		performance: 'High',
		performanceLevel: 3,
		recommended: true,
	},
	{
		id: 'schema-per-tenant',
		name: 'Schema-per-Tenant',
		description:
			'Each tenant gets a separate PostgreSQL schema within the same database.',
		isolation: 'Schema-level',
		isolationLevel: 2,
		complexity: 'Medium',
		complexityLevel: 2,
		cost: 'Medium',
		costLevel: 2,
		performance: 'Medium',
		performanceLevel: 2,
	},
	{
		id: 'db-per-tenant',
		name: 'DB-per-Tenant',
		description: 'Each tenant gets a completely separate database instance.',
		isolation: 'Full',
		isolationLevel: 3,
		complexity: 'High',
		complexityLevel: 3,
		cost: 'High',
		costLevel: 3,
		performance: 'Low',
		performanceLevel: 1,
	},
];

const ALL_RECORDS: TenantRecord[] = [
	{ id: 1, name: 'Website Redesign', companyId: 1, companyName: 'Acme Corp' },
	{ id: 2, name: 'Mobile App', companyId: 1, companyName: 'Acme Corp' },
	{ id: 3, name: 'API Integration', companyId: 2, companyName: 'Globex Inc' },
	{
		id: 4,
		name: 'Data Migration',
		companyId: 2,
		companyName: 'Globex Inc',
	},
	{
		id: 5,
		name: 'Security Audit',
		companyId: 3,
		companyName: 'Initech LLC',
	},
	{ id: 6, name: 'Cloud Setup', companyId: 3, companyName: 'Initech LLC' },
];

const INITIAL_MODELS: ModelConfig[] = [
	{ name: 'Project', enabled: false },
	{ name: 'Task', enabled: false },
	{ name: 'Document', enabled: false },
	{ name: 'Invoice', enabled: false },
];

// --- Helpers ---

function getLevelDots(level: number, max: number) {
	return Array.from({ length: max }, (_, i) => i < level);
}

// --- Component ---

export function Level49MultiTenancy({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();

	// State
	const [selectedStrategy, setSelectedStrategy] =
		useState<TenancyStrategy | null>(null);
	const [models, setModels] = useState<ModelConfig[]>(INITIAL_MODELS);
	const [isolationTested, setIsolationTested] = useState(false);
	const [isolationPassed, setIsolationPassed] = useState(false);
	const [currentTenant, setCurrentTenant] = useState<number | null>(null);
	const [queryInput, setQueryInput] = useState('Project.all');
	const [queryExecuted, setQueryExecuted] = useState(false);
	const [leakDetected, setLeakDetected] = useState(false);

	const enabledModelCount = models.filter((m) => m.enabled).length;

	// Toggle acts_as_tenant on a model
	const toggleModel = (name: string) => {
		setModels((prev) =>
			prev.map((m) => (m.name === name ? { ...m, enabled: !m.enabled } : m)),
		);
		// Reset isolation test when models change
		setIsolationTested(false);
		setIsolationPassed(false);
	};

	// Get visible records based on tenant and scoping
	const getVisibleRecords = (
		tenantId: number | null,
		scoped: boolean,
	): TenantRecord[] => {
		if (!scoped || tenantId === null) {
			return ALL_RECORDS;
		}
		return ALL_RECORDS.filter((r) => r.companyId === tenantId);
	};

	// Transform query string to show tenant scoping
	const getTransformedQuery = (): string => {
		const hasScoping =
			selectedStrategy === 'shared-db' && enabledModelCount > 0;
		if (queryInput === 'Project.all') {
			if (hasScoping && currentTenant !== null) {
				const tenantName =
					currentTenant === 1
						? 'Acme Corp'
						: currentTenant === 2
							? 'Globex Inc'
							: 'Initech LLC';
				return `SELECT * FROM projects WHERE company_id = ${currentTenant}\n-- Tenant: ${tenantName}`;
			}
			return 'SELECT * FROM projects\n-- No tenant scoping! ALL records returned';
		}
		if (queryInput === 'Project.create!(name: "New")') {
			if (hasScoping && currentTenant !== null) {
				return `INSERT INTO projects (name, company_id) VALUES ('New', ${currentTenant})\n-- company_id auto-set by acts_as_tenant`;
			}
			return `INSERT INTO projects (name) VALUES ('New')\n-- No company_id! Orphaned record`;
		}
		return hasScoping && currentTenant !== null
			? `-- Scoped to company_id = ${currentTenant}`
			: '-- No tenant scoping';
	};

	// Run isolation test
	const runIsolationTest = async () => {
		setCurrentTenant(1);
		setIsolationTested(true);

		const hasScoping =
			selectedStrategy === 'shared-db' && enabledModelCount >= 2;

		// Simulate the test with a brief delay
		await new Promise((r) => setTimeout(r, 600));
		setIsolationPassed(hasScoping);
	};

	// Validation
	const handleValidate = useCallback((): ValidationResult => {
		const errors: string[] = [];

		if (selectedStrategy !== 'shared-db') {
			errors.push(
				'Select the "Shared DB + tenant_id" strategy (recommended for most B2B SaaS apps)',
			);
		}

		if (enabledModelCount < 2) {
			errors.push(
				'Enable acts_as_tenant on at least 2 models to ensure broad coverage',
			);
		}

		if (!isolationTested) {
			errors.push('Run the isolation test to verify data is properly scoped');
		} else if (!isolationPassed) {
			errors.push(
				'Isolation test failed -- make sure you selected the shared DB strategy and enabled acts_as_tenant on 2+ models',
			);
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Multi-tenancy not fully configured',
				details: errors,
			};
		}

		return {
			valid: true,
			message:
				'Data isolation verified! Every query is scoped to the current tenant.',
		};
	}, [selectedStrategy, enabledModelCount, isolationTested, isolationPassed]);

	// Complete
	const handleComplete = async () => {
		const success = await completeLevel('act7-level49-multi-tenancy', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	// Reset
	const handleReset = () => {
		setSelectedStrategy(null);
		setModels(INITIAL_MODELS);
		setIsolationTested(false);
		setIsolationPassed(false);
		setCurrentTenant(null);
		setQueryInput('Project.all');
		setQueryExecuted(false);
		setLeakDetected(false);
	};

	// Determine current scoping status
	const hasScoping = selectedStrategy === 'shared-db' && enabledModelCount > 0;
	const scopedRecords = getVisibleRecords(currentTenant, hasScoping);
	const unscopedRecords = getVisibleRecords(null, false);

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Implement multi-tenancy to isolate data between companies in a B2B SaaS app."
					instructions={[
						'Pick a tenancy strategy (shared DB recommended)',
						'Enable acts_as_tenant on 2+ models',
						'Test data isolation between companies',
					]}
					scenario="Bug report: Company A can see Company B's project records. Every database query must be automatically scoped to the current tenant."
				>
					{/* Strategy Selection */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Tenancy Strategy
						</div>
						<div className="space-y-2">
							{STRATEGIES.map((strategy) => (
								<Button
									className={`w-full text-left p-3 rounded-lg border transition-all ${
										selectedStrategy === strategy.id
											? 'border-primary bg-primary/10'
											: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={strategy.id}
									onClick={() => {
										setSelectedStrategy(strategy.id);
										setIsolationTested(false);
										setIsolationPassed(false);
									}}
								>
									<div className="flex items-center gap-2">
										<Database className="w-3.5 h-3.5 text-primary shrink-0" />
										<span className="text-sm font-medium text-foreground">
											{strategy.name}
										</span>
										{strategy.recommended && (
											<span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded-full ml-auto">
												recommended
											</span>
										)}
									</div>
								</Button>
							))}
						</div>
					</div>

					{/* Model Configuration */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							<Lock className="w-3 h-3 inline mr-1" />
							acts_as_tenant Models
						</div>
						<div className="space-y-1.5">
							{models.map((model) => (
								<Button
									className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
										model.enabled
											? 'bg-success/10 border border-success/30'
											: 'bg-card border border-border hover:border-muted-foreground'
									}`}
									key={model.name}
									onClick={() => toggleModel(model.name)}
								>
									<span
										className={`text-sm ${model.enabled ? 'text-success' : 'text-muted-foreground'}`}
									>
										{model.name}
									</span>
									{model.enabled ? (
										<ShieldCheck className="w-4 h-4 text-success" />
									) : (
										<span className="w-4 h-4 rounded border border-muted-foreground" />
									)}
								</Button>
							))}
						</div>
						<div className="text-xs text-muted-foreground mt-2">
							{enabledModelCount}/4 models scoped
						</div>
					</div>

					{/* Isolation Test */}
					<div className="p-4 border-t border-border">
						<Button
							className="w-full py-3"
							color={
								isolationTested && !isolationPassed
									? 'destructive'
									: isolationTested && isolationPassed
										? 'success'
										: 'primary'
							}
							disabled={!selectedStrategy}
							onClick={runIsolationTest}
						>
							<ShieldCheck className="w-4 h-4 mr-2" />
							{isolationTested
								? isolationPassed
									? 'Isolation Passed'
									: 'Isolation Failed'
								: 'Test Isolation'}
						</Button>
						{isolationTested && (
							<div
								className={`text-xs mt-2 p-2 rounded ${
									isolationPassed
										? 'text-success bg-success/10'
										: 'text-destructive bg-destructive/10'
								}`}
							>
								{isolationPassed
									? 'Logged in as Acme Corp -- Globex and Initech data invisible.'
									: "Data leak detected! Other companies' records are visible."}
							</div>
						)}
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={7}
					levelName="Multi-Tenancy"
					levelNumber={49}
					onComplete={handleComplete}
					onReset={handleReset}
					onValidate={handleValidate}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-y-auto">
					{/* Strategy Detail Card */}
					{selectedStrategy && (
						<div className="bg-card rounded-xl border border-border p-5 mb-6">
							<div className="flex items-center gap-2 mb-4">
								<Database className="w-5 h-5 text-primary" />
								<h3 className="text-foreground font-semibold">
									{STRATEGIES.find((s) => s.id === selectedStrategy)?.name}
								</h3>
							</div>
							<p className="text-muted-foreground text-sm mb-4">
								{STRATEGIES.find((s) => s.id === selectedStrategy)?.description}
							</p>

							{/* Metrics */}
							<div className="grid grid-cols-4 gap-3">
								{(() => {
									const strategy = STRATEGIES.find(
										(s) => s.id === selectedStrategy,
									);
									if (!strategy) return null;
									const metrics = [
										{
											label: 'Isolation',
											value: strategy.isolation,
											level: strategy.isolationLevel,
										},
										{
											label: 'Complexity',
											value: strategy.complexity,
											level: strategy.complexityLevel,
										},
										{
											label: 'Cost',
											value: strategy.cost,
											level: strategy.costLevel,
										},
										{
											label: 'Performance',
											value: strategy.performance,
											level: strategy.performanceLevel,
										},
									];
									return metrics.map((metric) => (
										<div
											className="bg-background rounded-lg p-3 text-center"
											key={metric.label}
										>
											<div className="text-xs text-muted-foreground mb-1">
												{metric.label}
											</div>
											<div className="text-sm font-medium text-foreground">
												{metric.value}
											</div>
											<div className="flex justify-center gap-1 mt-1.5">
												{getLevelDots(metric.level, 3).map((filled, i) => (
													<div
														className={`w-2 h-2 rounded-full ${
															filled ? 'bg-primary' : 'bg-border'
														}`}
														key={i}
													/>
												))}
											</div>
										</div>
									));
								})()}
							</div>
						</div>
					)}

					{/* Data Visualization: Without vs With Tenancy */}
					<div className="grid grid-cols-2 gap-4 mb-6">
						{/* Without Tenancy */}
						<div className="bg-card rounded-xl border border-destructive/30 p-5">
							<div className="flex items-center gap-2 mb-3">
								<Eye className="w-4 h-4 text-destructive" />
								<h4 className="text-sm font-semibold text-destructive">
									Without Tenancy
								</h4>
							</div>
							<div className="text-xs text-muted-foreground mb-3 font-mono bg-background rounded p-2">
								SELECT * FROM projects
							</div>
							<div className="space-y-1.5">
								{unscopedRecords.map((record) => (
									<div
										className="flex items-center justify-between text-xs p-2 rounded bg-destructive/5 border border-destructive/20"
										key={record.id}
									>
										<span className="text-foreground">{record.name}</span>
										<span className="text-destructive flex items-center gap-1">
											<Building2 className="w-3 h-3" />
											{record.companyName}
										</span>
									</div>
								))}
							</div>
							<div className="mt-3 text-xs text-destructive flex items-center gap-1">
								<Eye className="w-3 h-3" />
								Data leak: {unscopedRecords.length} records from all companies
							</div>
						</div>

						{/* With Tenancy */}
						<div
							className={`bg-card rounded-xl border p-5 ${
								hasScoping ? 'border-success/30' : 'border-border'
							}`}
						>
							<div className="flex items-center gap-2 mb-3">
								<EyeOff
									className={`w-4 h-4 ${hasScoping ? 'text-success' : 'text-muted-foreground'}`}
								/>
								<h4
									className={`text-sm font-semibold ${hasScoping ? 'text-success' : 'text-muted-foreground'}`}
								>
									With Tenancy
								</h4>
							</div>
							<div className="text-xs text-muted-foreground mb-3 font-mono bg-background rounded p-2">
								{hasScoping
									? 'SELECT * FROM projects WHERE company_id = 1'
									: 'SELECT * FROM projects -- enable scoping'}
							</div>

							{hasScoping ? (
								<>
									<div className="space-y-1.5">
										{getVisibleRecords(1, true).map((record) => (
											<div
												className="flex items-center justify-between text-xs p-2 rounded bg-success/5 border border-success/20"
												key={record.id}
											>
												<span className="text-foreground">{record.name}</span>
												<span className="text-success flex items-center gap-1">
													<Building2 className="w-3 h-3" />
													{record.companyName}
												</span>
											</div>
										))}
									</div>
									<div className="mt-3 text-xs text-success flex items-center gap-1">
										<ShieldCheck className="w-3 h-3" />
										Isolated: {getVisibleRecords(1, true).length} records from
										Acme Corp only
									</div>
								</>
							) : (
								<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
									<Lock className="w-8 h-8 mb-2 opacity-30" />
									<span className="text-xs">
										Select strategy and enable models
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Interactive Query Builder */}
					<div className="bg-card rounded-xl border border-border p-5 mb-6">
						<div className="flex items-center gap-2 mb-4">
							<Database className="w-4 h-4 text-primary" />
							<h4 className="text-sm font-semibold text-foreground">
								Interactive Query Builder
							</h4>
						</div>

						{/* Tenant selector */}
						<div className="flex items-center gap-3 mb-4">
							<Users className="w-4 h-4 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								Current tenant:
							</span>
							<div className="flex gap-2">
								{[
									{ id: 1, name: 'Acme Corp' },
									{ id: 2, name: 'Globex Inc' },
									{ id: 3, name: 'Initech LLC' },
								].map((company) => (
									<Button
										className={`text-xs px-3 py-1.5 rounded-full transition-all ${
											currentTenant === company.id
												? 'bg-primary text-primary-foreground'
												: 'bg-secondary text-muted-foreground hover:text-foreground'
										}`}
										key={company.id}
										onClick={() => {
											setCurrentTenant(company.id);
											setQueryExecuted(false);
										}}
									>
										<Building2 className="w-3 h-3 inline mr-1" />
										{company.name}
									</Button>
								))}
							</div>
						</div>

						{/* Query input */}
						<div className="flex gap-3 mb-4">
							<div className="flex-1 flex gap-2">
								<Button
									className={`text-xs px-3 py-2 rounded-lg border transition-all font-mono ${
										queryInput === 'Project.all'
											? 'border-primary bg-primary/10 text-primary'
											: 'border-border text-muted-foreground hover:border-muted-foreground'
									}`}
									onClick={() => {
										setQueryInput('Project.all');
										setQueryExecuted(false);
									}}
								>
									Project.all
								</Button>
								<Button
									className={`text-xs px-3 py-2 rounded-lg border transition-all font-mono ${
										queryInput === 'Project.create!(name: "New")'
											? 'border-primary bg-primary/10 text-primary'
											: 'border-border text-muted-foreground hover:border-muted-foreground'
									}`}
									onClick={() => {
										setQueryInput('Project.create!(name: "New")');
										setQueryExecuted(false);
									}}
								>
									Project.create!(name: &quot;New&quot;)
								</Button>
							</div>
							<Button
								disabled={currentTenant === null}
								onClick={() => {
									setQueryExecuted(true);
									if (!hasScoping && currentTenant !== null) {
										setLeakDetected(true);
									}
								}}
								size="sm"
							>
								Run Query
							</Button>
						</div>

						{/* Query transformation */}
						{queryExecuted && currentTenant !== null && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span className="font-mono bg-background rounded px-2 py-1">
										{queryInput}
									</span>
									<span>transforms to:</span>
								</div>
								<div
									className={`font-mono text-xs p-3 rounded-lg ${
										hasScoping
											? 'bg-success/10 border border-success/30 text-success'
											: 'bg-destructive/10 border border-destructive/30 text-destructive'
									}`}
								>
									<pre className="whitespace-pre-wrap">
										{getTransformedQuery()}
									</pre>
								</div>

								{/* Data leak alert */}
								{!hasScoping && currentTenant !== null && (
									<div className="bg-destructive/10 border-2 border-destructive rounded-xl p-4 mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
										<div className="flex items-center gap-2 mb-2">
											<Eye className="w-5 h-5 text-destructive" />
											<span className="text-destructive font-semibold text-sm">DATA LEAK DETECTED</span>
										</div>
										<div className="text-xs text-destructive/80 mb-2">
											Logged in as {currentTenant === 1 ? 'Acme Corp' : currentTenant === 2 ? 'Globex Inc' : 'Initech LLC'},{' '}
											but seeing records from {ALL_RECORDS.filter(r => r.companyId !== currentTenant).map(r => r.companyName).filter((v, i, a) => a.indexOf(v) === i).join(' and ')}.
										</div>
										<div className="text-xs text-destructive/60">
											Without acts_as_tenant, queries return ALL records regardless of who is logged in.
										</div>
									</div>
								)}

								{/* Leak fixed confirmation */}
								{hasScoping && currentTenant !== null && leakDetected && (
									<div className="bg-success/10 border border-success/30 rounded-xl p-3 mt-3 animate-in fade-in duration-300">
										<div className="flex items-center gap-2">
											<ShieldCheck className="w-4 h-4 text-success" />
											<span className="text-success text-sm font-medium">Leak fixed! Only {scopedRecords.length} records from the current tenant are visible.</span>
										</div>
									</div>
								)}

								{/* Result records */}
								{queryInput === 'Project.all' && (
									<div className="mt-3">
										<div className="text-xs text-muted-foreground mb-2">
											Returns{' '}
											{hasScoping
												? scopedRecords.length
												: unscopedRecords.length}{' '}
											record(s):
										</div>
										<div className="space-y-1">
											{(hasScoping
												? getVisibleRecords(currentTenant, true)
												: unscopedRecords
											).map((record) => (
												<div
													className={`flex items-center justify-between text-xs p-2 rounded ${
														hasScoping
															? 'bg-success/5 border border-success/20'
															: record.companyId === currentTenant
																? 'bg-success/5 border border-success/20'
																: 'bg-destructive/5 border border-destructive/20'
													}`}
													key={record.id}
												>
													<span className="text-foreground">{record.name}</span>
													<span
														className={
															hasScoping || record.companyId === currentTenant
																? 'text-success'
																: 'text-destructive'
														}
													>
														{record.companyName}
														{!hasScoping &&
															record.companyId !== currentTenant && (
																<Eye className="w-3 h-3 inline ml-1 animate-pulse" />
															)}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'app/models/project.rb',
							language: 'ruby',
							code: `class Project < ApplicationRecord
  acts_as_tenant :company

  belongs_to :company
  has_many :tasks

  validates :name, presence: true
end`,
							highlight: [2],
						},
						{
							filename: 'app/controllers/application_controller.rb',
							language: 'ruby',
							code: `class ApplicationController < ActionController::API
  set_current_tenant_through_filter
  before_action :set_tenant

  private

  def set_tenant
    set_current_tenant(current_user.company)
  end
end`,
							highlight: [2, 3, 7, 8],
						},
						{
							filename: 'config/initializers/acts_as_tenant.rb',
							language: 'ruby',
							code: `# Automatic scoping examples:
#
# Project.all
# => SELECT * FROM projects
#    WHERE company_id = 42
#
# Project.create!(name: "New")
# => INSERT with company_id auto-set to 42
#
# Project.find(999)
# => Raises NotFound if project belongs
#    to a different company

ActsAsTenant.configure do |config|
  config.require_tenant = true
end`,
							highlight: [3, 4, 5, 7, 8, 14, 15],
						},
					]}
					learningGoal="Multi-tenancy with acts_as_tenant adds automatic WHERE clauses to every query, preventing data leaks between companies. The shared DB + tenant_id approach is the simplest and most common strategy for B2B SaaS."
				/>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level49MultiTenancy;
