import type { Level } from '@/types';
import { standardPipeline } from '@/utils/pipelineTemplates';

export const level43SafeMigrations: Level = {
	id: 'act6-level43-safe-migrations',
	actId: 6,
	levelNumber: 43,
	name: 'Safe Migrations',
	trigger: {
		type: 'outage',
		description:
			'Deploy changes a column type on a large table. Locks the table for 30 seconds while rewriting every row. API returns 500s. 100K users affected.',
	},
	startingPipeline: standardPipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'Deploy ran a migration that changed a column type on a 5M row table. The table was locked for 30 seconds while every row was rewritten. All API requests to that table returned 500. Monitoring lit up.',
		rootCause:
			'Unsafe migration patterns that acquire exclusive locks on large tables during production traffic.',
		codeExample: `# The migration that caused the outage:
class ChangeViewsToBigint < ActiveRecord::Migration[8.0]
  def change
    # This locks the entire table while rewriting every row!
    change_column :products, :views, :bigint
  end
end

# PostgreSQL acquires an ACCESS EXCLUSIVE lock:
# - No reads or writes while ALTER TABLE runs
# - 5M rows rewritten to change column type = ~30 seconds of downtime
# - All queries queue up, connections exhaust, 500s everywhere

# Other dangerous patterns:
add_index :users, :email                    # Locks table during index build
rename_column :users, :name, :full_name     # Breaks running app code
remove_column :users, :legacy_field         # Breaks running app code
# Note: add_column with a constant default is instant on PG 11+,
# but change_column type always rewrites the table.`,
		goal: 'Catch dangerous migration patterns before they reach production and apply zero-downtime alternatives.',
		thresholds: {},
	},
	successConditions: [{ type: 'safe_migrations_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Safe Migrations with strong_migrations',
		goal: `In this level, you'll:
- learn how to run database migrations safely in production without causing downtime.
- use automated checks to catch dangerous migration patterns before they reach production.
- split risky operations like column renames into multiple deploys.
- test migrations against production-sized datasets.`,
		conceptExplanation: `**The problem:** Many common migration operations lock tables in production, causing downtime.

**strong_migrations** catches dangerous migrations at development time and suggests safe alternatives.

**Key zero-downtime patterns:**

1. **Change column type:** Add new column with new type, backfill, swap (always rewrites the table)
2. **Add index:** Use \`algorithm: :concurrently\` (PostgreSQL) with \`disable_ddl_transaction!\`
3. **Remove column:** First deploy ignoring the column, then remove in a separate migration
4. **Rename column:** Add new column, backfill, update code, drop old column
5. **Add column with default (pre-PG 11):** Add column (no default) -> backfill -> change default. On PG 11+ with constant defaults, this is instant and safe.

**Rule of thumb:** If a migration touches a table with >100K rows, think twice.`,
		railsCodeExample: `# Gemfile
gem "strong_migrations"

# config/initializers/strong_migrations.rb
StrongMigrations.start_after = 20240101000000
StrongMigrations.target_postgresql_version = "16"

# ============================
# UNSAFE -> SAFE: change_column type
# ============================

# UNSAFE: Rewrites the entire table (locks it for duration)
class ChangeViewsToBigint < ActiveRecord::Migration[8.0]
  def change
    change_column :products, :views, :bigint  # REWRITES ALL ROWS!
  end
end

# SAFE: Add new column, backfill, swap

# Step 1: Add new column (instant, no lock)
class AddViewsBigintToProducts < ActiveRecord::Migration[8.0]
  def change
    add_column :products, :views_bigint, :bigint
  end
end

# Step 2: Backfill in batches (no lock, controlled DB load)
class BackfillViewsBigintOnProducts < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    Product.in_batches(of: 10_000) do |batch|
      batch.update_all("views_bigint = views")
      sleep(0.1)  # Reduce DB load between batches
    end
  end
end

# Step 3: Swap columns (rename old, rename new)
class SwapViewsColumns < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      rename_column :products, :views, :views_old
      rename_column :products, :views_bigint, :views
    end
  end
end

# ============================
# UNSAFE -> SAFE: add_index
# ============================

# UNSAFE: Locks table during entire index build
class AddIndexToUsersEmail < ActiveRecord::Migration[8.0]
  def change
    add_index :users, :email  # LOCKS TABLE!
  end
end

# SAFE: Concurrent index (no lock, allows reads/writes)
class AddIndexToUsersEmail < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :users, :email, algorithm: :concurrently
  end
end

# ============================
# UNSAFE -> SAFE: remove_column
# ============================

# UNSAFE: Breaks running app code that references the column
class RemoveLegacyFieldFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :legacy_field  # Running code still references it!
  end
end

# SAFE: Two deploys
# Deploy 1: Tell Rails to ignore the column
class User < ApplicationRecord
  self.ignored_columns += ["legacy_field"]
end

# Deploy 2: After Deploy 1 is running on all servers
class RemoveLegacyFieldFromUsers < ActiveRecord::Migration[8.0]
  def change
    safety_assured { remove_column :users, :legacy_field }
  end
end

# ============================
# UNSAFE -> SAFE: rename_column
# ============================

# UNSAFE: Breaks running app code instantly
class RenameNameToFullName < ActiveRecord::Migration[8.0]
  def change
    rename_column :users, :name, :full_name  # Old code crashes!
  end
end

# SAFE: Four deploys
# Deploy 1: Add new column
class AddFullNameToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :full_name, :string
  end
end
# Deploy 2: Backfill + write to both columns
# Deploy 3: Switch reads to new column
# Deploy 4: Drop old column

# ============================
# Verify strong_migrations catches issues
# ============================

# Run migrations in development:
# $ bin/rails db:migrate
#
# === Dangerous migration detected ===
# Adding a column with a volatile default value (like gen_random_uuid())
# rewrites the entire table. Reads and writes are blocked while it runs.
# (A CONSTANT default such as false is metadata-only and safe on
#  PostgreSQL 11+, so strong_migrations does not flag it.)
#
# Instead, add the column without a default, then change the default.
#
# class AddReferenceCodeToOrders < ActiveRecord::Migration[8.0]
#   def up
#     add_column :orders, :reference_code, :uuid
#     change_column_default :orders, :reference_code, -> { "gen_random_uuid()" }
#   end
#
#   def down
#     remove_column :orders, :reference_code
#   end
# end`,
		commonMistakes: [
			'Running change_column type on large tables in production (rewrites every row)',
			'Adding indexes without CONCURRENTLY on tables with active traffic',
			'Removing columns before the app stops referencing them',
			'Not using disable_ddl_transaction! with concurrent operations',
			'Backfilling in one giant UPDATE instead of batches',
			'Forgetting to set ignored_columns before dropping a column',
		],
		whenToUse:
			'Every production Rails app with users. Install strong_migrations from day one. Apply zero-downtime patterns for any table over 10K rows.',
		furtherReading: [
			{
				title: 'strong_migrations',
				url: 'https://github.com/ankane/strong_migrations',
			},
			{
				title: 'Zero-Downtime Migrations',
				url: 'https://blog.codeship.com/zero-downtime-database-migrations/',
			},
		],
		homework: [
			{
				task: 'Install the migration safety net in your companion project and confirm it hooks into every future migration.',
				commands: [
					'bundle add strong_migrations',
					'bin/rails generate strong_migrations:install',
				],
				verify:
					'config/initializers/strong_migrations.rb exists with a start_after timestamp, so old migrations are grandfathered and every new one gets checked.',
			},
			{
				task: 'Trip the net on purpose: generate a migration that renames a column on your products table and try to run it.',
				commands: [
					'bin/rails generate migration RenameProductsNameToTitle',
					'bin/rails db:migrate',
				],
				verify:
					'db:migrate refuses with a dangerous-migration error explaining that renaming breaks running app code and showing the multi-deploy safe alternative. Delete the migration file afterwards.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Some migration operations lock the table for the whole runtime of the deploy. The fix is mechanical (split into smaller steps) but easy to forget; a Rubygem catches the unsafe patterns at code-review time and refuses to run them.',
	},
};
