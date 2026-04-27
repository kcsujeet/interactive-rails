import type { Level } from '@/types';

export const level51MultiTenancy: Level = {
	id: 'act7-level51-multi-tenancy',
	actId: 7,
	levelNumber: 51,
	name: 'Multi-Tenancy',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			"B2B SaaS launch: each company must only see their own data. One codebase, many tenants. A single leaked query could expose another company's data.",
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			"Company A can see Company B's records. Every query must be scoped to the current tenant, but developers keep forgetting.",
		rootCause:
			'No tenant isolation. Queries are unscoped and return all records across all tenants.',
		codeExample: `# Current: No tenant scoping, data leaks!
class Project < ApplicationRecord
  belongs_to :company
end

# In controller:
def index
  @projects = Project.all  # Returns ALL projects across ALL companies!
end

# A developer forgets the where clause:
Project.where(status: 'active')  # Leaks other tenants' data

# Even with manual scoping, one mistake = data breach:
Project.where(company_id: current_company.id, status: 'active')
# Easy to forget company_id in complex queries`,
		goal: 'Implement automatic tenant isolation so every query is scoped by default.',
		thresholds: {},
	},
	successConditions: [{ type: 'multi_tenancy_configured' }],
	availableNodes: ['tenant_scope'],
	unlockedNodes: ['tenant_scope'],
	learningContent: {
		title: 'Multi-Tenancy with ActsAsTenant',
		goal: `In this level, you'll:\n- learn how to build a multi-tenant application where multiple companies share the same database without seeing each other's data.\n- use automatic tenant scoping so every query is filtered by the current tenant.\n- add tenant_id columns and prevent data leaks between organizations.`,
		conceptExplanation: `Multi-tenancy strategies fall on a sliding scale: each tier moves the isolation boundary closer to the database itself, and each tier costs more to operate. Picking the wrong tier is one of the most expensive mistakes a SaaS architect can make: too lax and you eventually leak data; too strict and your operations team buckles under the weight of N databases to back up.

**Row-level isolation (\`acts_as_tenant\` or similar):**
- All tenants share the same tables; rows carry a \`tenant_id\` (often \`company_id\`) column.
- The application layer enforces the scope: every query gets a \`WHERE tenant_id = ?\` automatically.
- Cheapest to operate (one DB, one schema, one set of migrations). Scales horizontally to millions of tenants.
- The risk: a single forgotten scope or a raw SQL string, and you leak across tenants. Mitigated with belt-and-suspenders tools (see PostgreSQL RLS below).
- Best fit: SaaS with hundreds to millions of tenants, application-tier security review acceptable.

**Schema-per-tenant (e.g. Apartment, or hand-rolled \`SET search_path\`):**
- One database, but each tenant gets their own PostgreSQL schema with full table copies.
- Cross-tenant leaks become harder: even a forgotten \`WHERE\` clause only sees the current schema's rows.
- Migrations now run N times (one per schema). You need a tenants table that records which schema each tenant lives in, and tooling to keep all schemas in sync.
- Best fit: tens to low hundreds of tenants, mid-market enterprise customers who want auditor-friendly isolation but cannot justify a dedicated database each.

**Database-per-tenant:**
- Each tenant has its own database, often in their preferred region.
- Cross-tenant leaks at the SQL layer are essentially impossible.
- You now have N databases to back up, patch, monitor, scale, and pay for. A connection-pool per tenant, often 1.5x the infra spend of row-level.
- Best fit: regulated industries (HIPAA, FedRAMP), data sovereignty (GDPR cross-border restrictions), or your largest enterprise customers paying a premium for isolation.

**The decision matrix (rough):**

| Concern | Row-level | Schema-per | DB-per |
|---|---|---|---|
| Tenants supported | unlimited | hundreds | tens to hundreds |
| Cross-tenant leak surface | application bug | search_path bug | wrong DSN |
| Migrations | once | N times | N times |
| Backups/monitoring/failover | one DB | one DB | N DBs |
| Approx infra cost | 1x | 1.2x | 1.5x to 3x |
| Compliance burden | proves nothing automatically | passes most audits | passes any audit |

**PostgreSQL Row Level Security (belt and suspenders for row-level):**

Even with \`acts_as_tenant\`, a forgotten scope on an unscoped query is a leak. RLS lets the database enforce the scope, regardless of whether the application remembered it:

\`\`\`sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (company_id = current_setting('app.current_tenant')::int);
\`\`\`

Then in Rails, set the tenant on the connection at the start of each request:

\`\`\`ruby
class ApplicationController < ActionController::API
  before_action :set_tenant_on_connection

  private

  def set_tenant_on_connection
    ActiveRecord::Base.connection.execute(
      "SET app.current_tenant = #{current_user.company_id.to_i}"
    )
  end
end
\`\`\`

Now even a raw \`Project.find_by_sql("SELECT * FROM projects")\` returns only the current tenant's rows. The application layer can have a bug; the database is still right. RLS is what turns row-level isolation from "we promise" to "the DB will not let it happen."

**\`connects_to\` for database-per-tenant:**

Rails 6+ ships connection switching at the model level. For a DB-per-tenant deployment, you read each tenant's DSN from a registry table and switch the connection per request:

\`\`\`ruby
class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true
end

# Switch the connection per-request based on the tenant
class ApplicationController < ActionController::API
  around_action :switch_tenant_database

  private

  def switch_tenant_database
    tenant = Tenant.find(request.headers["X-Tenant-Id"])
    ActiveRecord::Base.connected_to(database: tenant.db_name) do
      yield
    end
  end
end
\`\`\`

Pair with \`config/database.yml\` entries (or runtime configuration) so each tenant has \`primary\` and \`primary_replica\` connections. Background jobs need the tenant set the same way before \`perform\` runs (jobs do not inherit the request's connection scope).

**Noisy neighbors (the row-level pain point):**

In a row-level deployment, one tenant's giant query slows everyone else down because they share the same connection pool, the same buffer cache, and the same query planner statistics. Mitigations:

- Per-session \`statement_timeout\` so a runaway query gets killed before it starves the pool.
- Per-tenant rate limits at the app layer (\`rack-attack\` keyed on \`tenant_id\`).
- Graduate the noisiest tenant to a read replica (or to its own DB) before they take down everyone.
- Track per-tenant query latency in your APM (L52). Tenants that breach a threshold get an automatic ticket.

**Tenant-aware caching:**

A single bug here turns cache hits into cross-tenant data leaks. Always include \`tenant_id\` in the cache key:

\`\`\`ruby
Rails.cache.fetch(
  ["tenant", Current.tenant.id, "trending_products",
   Product.maximum(:updated_at).to_i],
  expires_in: 5.minutes,
  race_condition_ttl: 10.seconds
) { ... }
\`\`\`

Same rule for fragment caches, response caches, and any memoized values that survive the request. Background jobs hit the same trap: they have no \`current_tenant\` until you set it explicitly.

\`\`\`ruby
class TenantAwareJob < ApplicationJob
  before_perform do |job|
    tenant_id = job.arguments.first  # convention: first arg is tenant_id
    ActsAsTenant.current_tenant = Tenant.find(tenant_id)
  end
end
\`\`\`

**Compliance posture (what your customer's lawyer asks):**

- HIPAA / FedRAMP / SOC 2 Type II auditors usually want database-enforced isolation, not "we promise the application scopes every query." Row-level alone often does not pass; row-level + RLS frequently does; schema-per-tenant and DB-per-tenant pass routinely.
- GDPR data sovereignty (data must remain in EU, or in a customer-specified region) practically requires DB-per-tenant: a single shared database cannot satisfy "Customer A's data lives in Frankfurt, Customer B's in Sydney."
- Document which tier you are on and why. Every enterprise security review will ask, and "we use \`acts_as_tenant\`" is not the answer they want.

**Pragmatic default:**

Start with row-level + RLS. It scales further than you think, costs almost nothing operationally, and the RLS layer means an app-tier bug is not a breach. Graduate specific noisy or regulated tenants to schema-per-tenant or DB-per-tenant when the business justifies the operational cost. Going DB-per-tenant on day one for a 50-customer beta is the kind of premature scaling decision that shows up in YC pitch decks and slows you down for years.`,
		railsCodeExample: `# Gemfile
gem 'acts_as_tenant'

# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
end

# app/models/company.rb (the tenant)
class Company < ApplicationRecord
  has_many :users
  has_many :projects
end

# app/models/project.rb
class Project < ApplicationRecord
  acts_as_tenant :company  # Automatically scopes ALL queries

  belongs_to :company
  has_many :tasks
end

# app/models/task.rb
class Task < ApplicationRecord
  acts_as_tenant :company

  belongs_to :project
end

# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  set_current_tenant_through_filter
  before_action :set_tenant

  private

  def set_tenant
    set_current_tenant(current_user.company)
  end
end

# Now every query is automatically scoped:
Project.all
# SELECT * FROM projects WHERE company_id = 42

Project.where(status: 'active')
# SELECT * FROM projects WHERE company_id = 42 AND status = 'active'

Project.create!(name: "New Project")
# INSERT INTO projects (name, company_id) VALUES ('New Project', 42)

# Cross-tenant queries are impossible without explicitly bypassing:
ActsAsTenant.without_tenant do
  Project.count  # Admin-only: counts all projects
end

# Testing tenant isolation:
RSpec.describe Project do
  let(:company_a) { create(:company) }
  let(:company_b) { create(:company) }

  it 'isolates data between tenants' do
    ActsAsTenant.with_tenant(company_a) do
      create(:project, name: "A's Project")
    end

    ActsAsTenant.with_tenant(company_b) do
      expect(Project.count).to eq(0)  # Cannot see A's project
    end
  end
end`,
		commonMistakes: [
			'Forgetting acts_as_tenant on a model (data leak)',
			'Using unscoped or without_tenant carelessly in production code',
			'Not testing tenant isolation in your test suite',
			'Not adding a unique index scoped to tenant_id (e.g. unique slug per tenant, not globally unique)',
			'Cache keys that omit tenant_id (one cache hit serves another tenant their neighbor data)',
			'Background jobs that do not set the tenant before perform (jobs have no implicit current_tenant)',
			'Choosing DB-per-tenant on day one for a 50-customer beta (premature scaling, high ops cost, no leverage)',
			'Choosing row-level for a HIPAA workload without RLS (auditors will fail you on application-tier-only isolation)',
			'No per-tenant statement_timeout or rate limit (one noisy tenant starves the connection pool for everyone)',
			'No tenancy-tier review when onboarding enterprise customers (sovereignty/compliance requirements not surfaced until contract)',
		],
		whenToUse:
			'Any B2B SaaS where multiple companies share one codebase and database.',
		furtherReading: [
			{
				title: 'ActsAsTenant Gem',
				url: 'https://github.com/ErwinM/acts_as_tenant',
			},
			{
				title: 'Apartment Gem (Schema-based)',
				url: 'https://github.com/influitive/apartment',
			},
			{
				title: 'PostgreSQL Row Level Security',
				url: 'https://www.postgresql.org/docs/current/ddl-rowsecurity.html',
			},
			{
				title: 'Rails Multiple Databases (`connects_to`, `connected_to`)',
				url: 'https://guides.rubyonrails.org/active_record_multiple_databases.html',
			},
			{
				title: 'Stripe: How we built a multi-tenant SaaS',
				url: 'https://stripe.com/blog/online-migrations',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Use ActsAsTenant to automatically scope every query to the current tenant.',
	},
};
