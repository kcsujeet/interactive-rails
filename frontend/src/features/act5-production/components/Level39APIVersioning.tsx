/**
 * Level 36: API Versioning
 *
 * Evolve your API without breaking existing clients using namespaced routes
 * and versioned serializers. Player learns URL path versioning, deprecation
 * headers, and sunset dates.
 */

import {
	ArrowLeftRight,
	ArrowRight,
	Check,
	Clock,
	Code,
	FileCode,
	GitBranch,
	Send,
	Tag,
} from 'lucide-react';
import { useState } from 'react';
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

type VersioningStrategy = 'url-path' | 'header' | 'query-param' | null;

interface VersioningConfig {
	strategy: VersioningStrategy;
	deprecationHeaders: boolean;
	sunsetDate: boolean;
	v2Enabled: boolean;
}

interface SimulationResult {
	version: 'v1' | 'v2';
	status: number;
	headers: Record<string, string>;
	body: string;
	timestamp: number;
}

const STRATEGY_OPTIONS: {
	id: VersioningStrategy;
	name: string;
	example: string;
	recommended: boolean;
}[] = [
	{
		id: 'url-path',
		name: 'URL Path',
		example: '/api/v1/orders/42',
		recommended: true,
	},
	{
		id: 'header',
		name: 'Header',
		example: 'Accept: vnd.myapp.v2+json',
		recommended: false,
	},
	{
		id: 'query-param',
		name: 'Query Param',
		example: '/api/orders/42?version=2',
		recommended: false,
	},
];

const V1_RESPONSE_BODY = JSON.stringify({ id: 42, total: 1999 }, null, 2);

const V2_RESPONSE_BODY = JSON.stringify(
	{
		id: 42,
		total: {
			amount: '19.99',
			currency: 'USD',
		},
	},
	null,
	2,
);

export function Level39APIVersioning({
	onComplete,
}: LevelComponentProps) {
	const { completeLevel } = useLevelCompletion();
	const [config, setConfig] = useState<VersioningConfig>({
		strategy: null,
		deprecationHeaders: false,
		sunsetDate: false,
		v2Enabled: false,
	});
	const [simulations, setSimulations] = useState<SimulationResult[]>([]);

	const selectStrategy = (strategy: VersioningStrategy) => {
		setConfig((prev) => ({ ...prev, strategy }));
	};

	const toggleConfig = (key: keyof Omit<VersioningConfig, 'strategy'>) => {
		setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const simulateRequest = (version: 'v1' | 'v2') => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		if (version === 'v1') {
			if (config.deprecationHeaders) {
				headers['Deprecation'] = 'true';
				headers['Link'] = '</api/v2/orders>; rel="successor-version"';
			}
			if (config.sunsetDate) {
				headers['Sunset'] = 'Sat, 01 Jun 2026 00:00:00 GMT';
			}
		}

		const result: SimulationResult = {
			version,
			status: version === 'v2' && !config.v2Enabled ? 404 : 200,
			headers,
			body:
				version === 'v2' && !config.v2Enabled
					? JSON.stringify({ error: 'Not Found' }, null, 2)
					: version === 'v1'
						? V1_RESPONSE_BODY
						: V2_RESPONSE_BODY,
			timestamp: Date.now(),
		};

		setSimulations((prev) => [...prev.slice(-5), result]);
	};

	const validateSolution = (): ValidationResult => {
		const errors: string[] = [];

		if (config.strategy !== 'url-path') {
			errors.push(
				"The current strategy doesn't align well with Rails namespaced routes. Pick the approach that maps naturally to `namespace :v1 do`.",
			);
		}
		if (!config.deprecationHeaders) {
			errors.push('Enable deprecation headers on v1 to notify clients');
		}
		if (!config.v2Enabled) {
			errors.push('Enable the v2 endpoint so clients can migrate');
		}

		if (errors.length > 0) {
			return {
				valid: false,
				message: 'Complete all versioning requirements!',
				details: errors,
			};
		}

		return {
			valid: true,
			message: 'API versioning configured correctly!',
		};
	};

	const handleComplete = async () => {
		const success = await completeLevel('act5-level39-api-versioning', {
			stars: 3,
		});
		if (success) {
			onComplete({ stars: 3 });
		}
	};

	const getEndpointPath = (version: 'v1' | 'v2') => {
		if (!config.strategy) return `/api/orders/42`;
		switch (config.strategy) {
			case 'url-path':
				return `/api/${version}/orders/42`;
			case 'header':
				return `/api/orders/42`;
			case 'query-param':
				return `/api/orders/42?version=${version === 'v1' ? '1' : '2'}`;
		}
	};

	const getRequestHeader = (version: 'v1' | 'v2') => {
		if (config.strategy === 'header') {
			return `Accept: application/vnd.myapp.${version}+json`;
		}
		return null;
	};

	const configuredCount = [
		config.strategy === 'url-path',
		config.deprecationHeaders,
		config.v2Enabled,
	].filter(Boolean).length;

	return (
		<LevelLayout>
			<LeftPanel>
				<InstructionPanel
					goal="Evolve your API without breaking existing clients using namespaced routes and versioned controllers."
					instructions={[
						'Pick a versioning strategy (URL path recommended)',
						'Enable deprecation headers on v1',
						'Enable the v2 endpoint',
						'Test both versions to verify coexistence',
					]}
					scenario="Your API returns order totals in cents: { &quot;total&quot;: 1999 }. The new v2 format uses { &quot;total&quot;: { &quot;amount&quot;: &quot;19.99&quot;, &quot;currency&quot;: &quot;USD&quot; } }. But 200 partners still use v1. You need both versions to coexist."
				>
					{/* Strategy Picker */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Versioning Strategy
						</div>
						<div className="space-y-2">
							{STRATEGY_OPTIONS.map((opt) => (
								<Button
									className={`w-full p-3 h-auto text-left justify-start flex-col items-start rounded-lg border ${
										config.strategy === opt.id
											? 'border-success bg-success/10'
											: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={opt.id}
									onClick={() => selectStrategy(opt.id)}
									variant="ghost"
								>
									<div className="flex items-center justify-between w-full">
										<div className="flex items-center gap-2">
											<GitBranch
												className={`w-4 h-4 ${config.strategy === opt.id ? 'text-success' : 'text-muted-foreground'}`}
											/>
											<span
												className={`text-sm font-medium ${config.strategy === opt.id ? 'text-success' : 'text-foreground'}`}
											>
												{opt.name}
											</span>
										</div>
										{opt.recommended && (
											<span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
												Recommended
											</span>
										)}
									</div>
									<code className="text-xs text-muted-foreground mt-1 font-mono">
										{opt.example}
									</code>
								</Button>
							))}
						</div>
					</div>

					{/* Configuration Toggles */}
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
							Configuration
						</div>
						<div className="space-y-2">
							{(
								[
									{
										key: 'deprecationHeaders' as const,
										name: 'Deprecation Headers',
										desc: 'Add Deprecation + Link headers to v1',
										Icon: Clock,
										required: true,
									},
									{
										key: 'sunsetDate' as const,
										name: 'Sunset Date',
										desc: 'Add Sunset header with retirement date',
										Icon: Tag,
										required: false,
									},
									{
										key: 'v2Enabled' as const,
										name: 'Enable v2 Endpoint',
										desc: 'Deploy the new v2 controller',
										Icon: FileCode,
										required: true,
									},
								] as const
							).map((item) => (
								<Button
									className={`w-full p-2 h-auto text-left justify-start flex-col items-start rounded-lg border ${
										config[item.key]
											? 'border-success bg-success/10'
											: 'border-border bg-card hover:border-muted-foreground'
									}`}
									key={item.key}
									onClick={() => toggleConfig(item.key)}
									variant="ghost"
								>
									<div className="flex items-center justify-between w-full">
										<div className="flex items-center gap-2">
											<item.Icon
												className={`w-4 h-4 ${config[item.key] ? 'text-success' : 'text-muted-foreground'}`}
											/>
											<span
												className={`text-sm ${config[item.key] ? 'text-success' : 'text-foreground'}`}
											>
												{item.name}
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											{item.required && (
												<span className="text-xs text-muted-foreground">
													required
												</span>
											)}
											{config[item.key] && (
												<Check className="w-3.5 h-3.5 text-success" />
											)}
										</div>
									</div>
									<div className="text-xs text-muted-foreground">
										{item.desc}
									</div>
								</Button>
							))}
						</div>
					</div>

					{/* Progress */}
					<div className="p-4 border-t border-border">
						<div className="flex justify-between text-sm mb-2">
							<span className="text-muted-foreground">Requirements met</span>
							<span
								className={
									configuredCount >= 3 ? 'text-success' : 'text-foreground'
								}
							>
								{configuredCount} / 3
							</span>
						</div>
					</div>
				</InstructionPanel>
			</LeftPanel>

			<CenterPanel>
				<LevelHeader
					actNumber={5}
					levelName="API Versioning"
					levelNumber={39}
					onComplete={handleComplete}
					onReset={() => {
						setConfig({
							strategy: null,
							deprecationHeaders: false,
							sunsetDate: false,
							v2Enabled: false,
						});
						setSimulations([]);
					}}
					onValidate={validateSolution}
				/>

				<div className="flex-1 relative bg-background p-6 overflow-auto">
					<div className="max-w-4xl mx-auto">
						{/* Side-by-side Endpoint Comparison */}
						<div className="grid grid-cols-2 gap-4 mb-6">
							{/* V1 Endpoint */}
							<div className="bg-card rounded-xl border border-border overflow-hidden">
								<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Tag className="w-4 h-4 text-warning" />
										<span className="text-foreground font-semibold text-sm">
											v1 Endpoint
										</span>
									</div>
									<span className="text-xs px-2 py-0.5 rounded bg-warning/20 text-warning">
										Deprecated
									</span>
								</div>
								<div className="p-4 space-y-3">
									{/* Request */}
									<div>
										<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
											Request
										</div>
										<div className="bg-background rounded-lg p-3 font-mono text-xs">
											<div className="text-primary">
												GET {getEndpointPath('v1')}
											</div>
											{getRequestHeader('v1') && (
												<div className="text-muted-foreground mt-1">
													{getRequestHeader('v1')}
												</div>
											)}
										</div>
									</div>

									{/* Response */}
									<div>
										<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
											Response
										</div>
										<div className="bg-background rounded-lg p-3 font-mono text-xs">
											<div className="text-success mb-1">200 OK</div>
											{config.deprecationHeaders && (
												<>
													<div className="text-warning">Deprecation: true</div>
													<div className="text-warning">
														Link: &lt;/api/v2/orders&gt;;
														rel="successor-version"
													</div>
												</>
											)}
											{config.sunsetDate && (
												<div className="text-warning">
													Sunset: Sat, 01 Jun 2026 00:00:00 GMT
												</div>
											)}
											<div className="mt-2 text-foreground whitespace-pre">
												{V1_RESPONSE_BODY}
											</div>
										</div>
									</div>

									<Button
										className="w-full"
										onClick={() => simulateRequest('v1')}
										size="sm"
										variant="outline"
									>
										<Send className="w-3.5 h-3.5 mr-2" />
										Send v1 Request
									</Button>
								</div>
							</div>

							{/* V2 Endpoint */}
							<div
								className={`bg-card rounded-xl border overflow-hidden ${
									config.v2Enabled
										? 'border-success/50'
										: 'border-border opacity-60'
								}`}
							>
								<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Tag className="w-4 h-4 text-success" />
										<span className="text-foreground font-semibold text-sm">
											v2 Endpoint
										</span>
									</div>
									<span
										className={`text-xs px-2 py-0.5 rounded ${
											config.v2Enabled
												? 'bg-success/20 text-success'
												: 'bg-secondary text-muted-foreground'
										}`}
									>
										{config.v2Enabled ? 'Active' : 'Not deployed'}
									</span>
								</div>
								<div className="p-4 space-y-3">
									{/* Request */}
									<div>
										<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
											Request
										</div>
										<div className="bg-background rounded-lg p-3 font-mono text-xs">
											<div className="text-primary">
												GET {getEndpointPath('v2')}
											</div>
											{getRequestHeader('v2') && (
												<div className="text-muted-foreground mt-1">
													{getRequestHeader('v2')}
												</div>
											)}
										</div>
									</div>

									{/* Response */}
									<div>
										<div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
											Response
										</div>
										<div className="bg-background rounded-lg p-3 font-mono text-xs">
											{config.v2Enabled ? (
												<>
													<div className="text-success mb-1">200 OK</div>
													<div className="mt-2 text-foreground whitespace-pre">
														{V2_RESPONSE_BODY}
													</div>
												</>
											) : (
												<>
													<div className="text-destructive mb-1">
														404 Not Found
													</div>
													<div className="mt-2 text-muted-foreground">
														{JSON.stringify({ error: 'Not Found' }, null, 2)}
													</div>
												</>
											)}
										</div>
									</div>

									<Button
										className="w-full"
										onClick={() => simulateRequest('v2')}
										size="sm"
										variant="outline"
									>
										<Send className="w-3.5 h-3.5 mr-2" />
										Send v2 Request
									</Button>
								</div>
							</div>
						</div>

						{/* Version Flow Diagram */}
						<div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
							<div className="bg-secondary px-4 py-3 border-b border-border">
								<div className="flex items-center gap-2">
									<ArrowLeftRight className="w-4 h-4 text-primary" />
									<span className="text-foreground font-semibold">
										Routing Diagram
									</span>
								</div>
							</div>
							<div className="p-6">
								<div className="flex items-center justify-center gap-3">
									{/* Client */}
									<div className="text-center">
										<div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center mb-2">
											<Code className="w-6 h-6 text-white" />
										</div>
										<div className="text-xs text-muted-foreground">Client</div>
									</div>

									<ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />

									{/* Router */}
									<div className="text-center">
										<div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 border border-border">
											<GitBranch className="w-6 h-6 text-foreground" />
										</div>
										<div className="text-xs text-muted-foreground">
											{config.strategy === 'url-path'
												? 'Namespace Router'
												: config.strategy === 'header'
													? 'Header Router'
													: config.strategy === 'query-param'
														? 'Param Router'
														: 'Router'}
										</div>
									</div>

									<div className="flex flex-col gap-3">
										{/* V1 path */}
										<div className="flex items-center gap-3">
											<ArrowRight className="w-4 h-4 text-warning flex-shrink-0" />
											<div
												className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
													config.deprecationHeaders
														? 'border-warning bg-warning/10'
														: 'border-border bg-secondary'
												}`}
											>
												<Tag className="w-4 h-4 text-warning" />
												<span className="text-sm text-foreground">
													Api::V1::OrdersController
												</span>
												{config.deprecationHeaders && (
													<Clock className="w-3.5 h-3.5 text-warning" />
												)}
											</div>
										</div>

										{/* V2 path */}
										<div className="flex items-center gap-3">
											<ArrowRight className="w-4 h-4 text-success flex-shrink-0" />
											<div
												className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
													config.v2Enabled
														? 'border-success bg-success/10'
														: 'border-border bg-secondary opacity-40'
												}`}
											>
												<Tag className="w-4 h-4 text-success" />
												<span className="text-sm text-foreground">
													Api::V2::OrdersController
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Simulation Log */}
						<div className="bg-card rounded-xl border border-border overflow-hidden">
							<div className="bg-secondary px-4 py-3 border-b border-border flex items-center justify-between">
								<div className="flex items-center gap-2">
									<FileCode className="w-4 h-4 text-primary" />
									<span className="text-foreground font-semibold">
										Request Log
									</span>
								</div>
								{simulations.length > 0 && (
									<span className="text-xs text-muted-foreground">
										{simulations.length} request
										{simulations.length !== 1 ? 's' : ''}
									</span>
								)}
							</div>
							<div className="p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-2">
								{simulations.length === 0 ? (
									<div className="text-muted-foreground text-center py-6">
										Send requests above to see responses here
									</div>
								) : (
									simulations.map((sim) => (
										<div
											className={`p-3 rounded-lg border ${
												sim.status === 200
													? 'border-border'
													: 'border-destructive'
											}`}
											key={sim.timestamp}
										>
											<div className="flex items-center justify-between mb-1">
												<span className="text-primary">
													GET {getEndpointPath(sim.version)}
												</span>
												<span
													className={`px-1.5 py-0.5 rounded text-xs ${
														sim.status === 200
															? 'bg-success/10 text-success'
															: 'bg-destructive/10 text-destructive'
													}`}
												>
													{sim.status}
												</span>
											</div>
											{Object.keys(sim.headers).length > 1 && (
												<div className="text-warning space-y-0.5 mb-1">
													{Object.entries(sim.headers)
														.filter(([k]) => k !== 'Content-Type')
														.map(([key, value]) => (
															<div key={key}>
																{key}: {value}
															</div>
														))}
												</div>
											)}
											<div className="text-muted-foreground whitespace-pre">
												{sim.body}
											</div>
										</div>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			</CenterPanel>

			<RightPanel>
				<CodePreviewPanel
					files={[
						{
							filename: 'config/routes.rb',
							language: 'ruby',
							code: `# config/routes.rb
namespace :api do
  namespace :v1 do
    resources :orders, only: [:index, :show]
  end
  namespace :v2 do
    resources :orders, only: [:index, :show]
  end
end`,
							highlight: config.v2Enabled ? [6, 7, 8] : [],
						},
						{
							filename: 'app/controllers/api/v1/orders_controller.rb',
							language: 'ruby',
							code: `# V1 controller (frozen)
module Api::V1
  class OrdersController < Api::BaseController
    before_action :add_deprecation_headers

    def show
      render json: { id: order.id, total: order.total_cents }
    end

    private
    def add_deprecation_headers
      response.headers['Deprecation'] = 'true'
      response.headers['Sunset'] = 'Sat, 01 Jun 2026 00:00:00 GMT'
    end
  end
end`,
							highlight: config.deprecationHeaders ? [4, 11, 12, 13] : [],
						},
						{
							filename: 'app/controllers/api/v2/orders_controller.rb',
							language: 'ruby',
							code: `# V2 controller (new features)
module Api::V2
  class OrdersController < Api::BaseController
    def show
      render json: {
        id: order.id,
        total: { amount: "19.99", currency: "USD" }
      }
    end
  end
end`,
							highlight: config.v2Enabled ? [5, 6, 7] : [],
						},
					]}
					learningGoal="API versioning with namespaced routes lets v1 and v2 coexist. Add Deprecation and Sunset headers to guide client migration."
				>
					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Key Concepts
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>
								<span className="text-foreground">Namespace routing</span> --
								separate controllers per version
							</li>
							<li>
								<span className="text-foreground">Deprecation header</span> --
								tells clients v1 is outdated
							</li>
							<li>
								<span className="text-foreground">Sunset header</span> --
								announces v1 retirement date
							</li>
							<li>
								<span className="text-foreground">Frozen v1</span> -- no new
								features, only bug fixes
							</li>
						</ul>
					</div>

					<div className="p-4 border-t border-border">
						<div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
							Migration Strategy
						</div>
						<ul className="text-xs text-muted-foreground space-y-1">
							<li>1. Deploy v2 alongside v1</li>
							<li>2. Add deprecation headers to v1</li>
							<li>3. Notify partners of sunset date</li>
							<li>4. Monitor v1 traffic until zero</li>
							<li>5. Remove v1 after sunset</li>
						</ul>
					</div>
				</CodePreviewPanel>
			</RightPanel>
		</LevelLayout>
	);
}

export default Level39APIVersioning;
