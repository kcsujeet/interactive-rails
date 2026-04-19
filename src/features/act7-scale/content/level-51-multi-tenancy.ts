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
		conceptExplanation: `Multi-tenancy strategies:

**Row-level isolation (ActsAsTenant):**
- All tenants share tables, scoped by tenant_id
- Simplest to implement, easiest to scale horizontally
- Default scopes automatically filter every query

**Schema-based isolation (Apartment):**
- Each tenant gets their own PostgreSQL schema
- Stronger isolation, but harder to manage migrations
- Better for compliance requirements

**Database-per-tenant:**
- Strongest isolation, most expensive
- Each tenant has a separate database
- Used for enterprise customers with strict data sovereignty

ActsAsTenant is the most common Rails approach for SaaS.`,
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
			'Not adding a unique index scoped to tenant_id',
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
		],
	},
	hint: {
		delay: 20,
		text: 'Use ActsAsTenant to automatically scope every query to the current tenant.',
	},
};
