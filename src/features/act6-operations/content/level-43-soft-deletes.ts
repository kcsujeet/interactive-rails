import type { Level } from '@/types';
import { middlewarePipeline } from '@/utils/pipelineTemplates';

export const level43SoftDeletes: Level = {
	id: 'act6-level43-soft-deletes',
	actId: 6,
	levelNumber: 43,
	name: 'Soft Deletes & Audit Trails',
	requiresTests: true,
	trigger: {
		type: 'incident',
		description:
			'Admin accidentally deletes a user. No undo. No record of who changed what. Customer data is gone forever.',
	},
	startingPipeline: middlewarePipeline({ modelLabel: 'User' }),
	problem: {
		observation:
			'A support admin ran User.find(42).destroy and the user is gone. No way to recover the data. No log of who did it or when. This is the third time this month.',
		rootCause:
			'Hard deletes permanently remove records. No audit trail tracks changes or who made them.',
		codeExample: `# Current code: hard delete via service
class DestroyUser < ApplicationService
  Result = Data.define(:success?, :resource, :errors)

  def call
    user = User.find(@params[:id])
    user.destroy  # GONE FOREVER
    Result.new(success?: true, resource: nil, errors: {})
  end
end

# Admin controller delegates to service (L16+)
module Admin
  class UsersController < ApplicationController
    def destroy
      result = DestroyUser.call(id: params[:id])
      head :no_content
    end
  end
end

# Questions we can't answer:
# - Who deleted this user?
# - When was it deleted?
# - Can we undo it?

# All answers: "We don't know" and "No"`,
		goal: 'Implement soft deletes so records can be recovered, with an audit trail tracking every change.',
		thresholds: {},
	},
	successConditions: [{ type: 'soft_deletes_configured' }],
	availableNodes: ['soft_delete', 'audit_trail'],
	unlockedNodes: ['audit_trail'],
	learningContent: {
		title: 'Soft Deletes & Audit Trails',
		goal: `In this level, you'll:
- learn how to "delete" records without actually removing them from the database.
- implement soft deletes using a timestamp column that marks records as discarded.
- filter soft-deleted records transparently so they stay hidden from normal queries.
- set up an audit trail that tracks who changed what and when for compliance and debugging.`,
		conceptExplanation: `**Soft deletes** mark records as deleted without removing them from the database. The record stays in the table with a \`discarded_at\` timestamp.

**Why soft deletes?**
- Undo accidental deletions
- Maintain referential integrity (foreign keys still work)
- Compliance requirements (data retention)
- Analytics on churned/deleted entities

**Audit trails** record every change to a model: who changed it, when, what changed, and the previous values.

**Why audit trails?**
- Regulatory compliance (SOX, HIPAA, GDPR)
- Debugging: "Who changed this setting?"
- Accountability: "Which admin deleted this?"
- Recovery: Restore to any previous state

**Gems:**
- \`discard\` for soft deletes (lightweight, provides explicit scopes like \`kept\` and \`with_discarded\`)
- \`paper_trail\` for audit trails (versioning with full change history)`,
		railsCodeExample: `# ============================
# Soft Deletes with Discard
# ============================

# Gemfile
gem "discard", "~> 1.3"
gem "paper_trail", "~> 15.0"

# Migration: add discarded_at column
class AddDiscardedAtToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :discarded_at, :datetime
    add_index :users, :discarded_at
  end
end

# app/models/user.rb
class User < ApplicationRecord
  include Discard::Model

  has_paper_trail

  # Discard does NOT add a default scope.
  # Use explicit scopes to filter:
  # User.kept returns non-discarded users
  # User.discarded returns only discarded users
  # User.with_discarded returns ALL users
end

# Usage:
user = User.find(42)
user.discard          # Sets discarded_at = Time.current
user.discarded?       # => true
user.undiscard        # Sets discarded_at = nil (undo!)

# Queries automatically exclude discarded:
User.count            # Only active users
User.with_discarded.count  # All users including discarded

# ============================
# Audit Trails with PaperTrail
# ============================

# Track who made the change (set in ApplicationController)
class ApplicationController < ActionController::API
  before_action :set_paper_trail_whodunnit

  private

  def user_for_paper_trail
    current_user&.id || "system"
  end
end

# PaperTrail tracks:
# - item_type, item_id (which record)
# - event (create, update, destroy/discard)
# - whodunnit (who did it)
# - object (previous version as YAML/JSON)
# - object_changes (what changed)
# - created_at (when)

# Usage:
user.versions                    # All changes
user.versions.last.whodunnit     # "admin_42"
user.versions.last.changeset     # { "email" => ["old@x.com", "new@x.com"] }

# Restore previous version:
user.paper_trail.previous_version.save!

# Travel to any point in time:
user.paper_trail.version_at(1.day.ago)

# ============================
# Admin Controller with Soft Delete + Audit
# ============================

class Admin::UsersController < ApplicationController
  def destroy
    user = User.find(params[:id])
    user.discard  # Soft delete (not destroy!)
    # PaperTrail records the change with whodunnit
    head :no_content
  end

  def restore
    user = User.with_discarded.find(params[:id])
    user.undiscard
    render json: UserSerializer.new(user).serializable_hash.to_json
  end

  def audit_log
    user = User.with_discarded.find(params[:id])
    versions = user.versions.map do |v|
      {
        event: v.event,
        who: v.whodunnit,
        when: v.created_at,
        changes: v.changeset
      }
    end
    render json: versions
  end
end

# config/routes.rb
namespace :admin do
  resources :users, only: [:index, :show, :destroy] do
    member do
      post :restore
      get :audit_log
    end
  end
end

# ============================
# Tests
# ============================

# test/models/user_test.rb
class UserTest < ActiveSupport::TestCase
  test "soft delete sets discarded_at instead of destroying" do
    user = users(:alice)
    user.discard

    assert user.discarded?
    assert_not_nil user.discarded_at
    assert User.with_discarded.exists?(user.id)
    assert_not User.kept.exists?(user.id)
  end

  test "undiscard restores a soft-deleted user" do
    user = users(:alice)
    user.discard
    user.undiscard

    assert_not user.discarded?
    assert_nil user.discarded_at
    assert User.kept.exists?(user.id)
  end

  test "paper_trail records who changed the user" do
    PaperTrail.request.whodunnit = "admin_1"
    user = users(:alice)
    user.update!(name: "Alice Updated")

    assert_equal "admin_1", user.versions.last.whodunnit
    assert_includes user.versions.last.changeset.keys, "name"
  end
end`,
		commonMistakes: [
			'Using destroy instead of discard (bypasses soft delete)',
			'Not adding an index on discarded_at (slow queries)',
			'Forgetting to scope associations with .kept (showing discarded records in has_many)',
			'Not setting whodunnit in PaperTrail (no accountability)',
			'Storing PaperTrail versions in the same database (bloats main DB over time)',
			'Not cleaning up old versions periodically',
		],
		whenToUse:
			'Soft deletes: Any user-facing data that might need recovery. Audit trails: Any data with compliance, accountability, or debugging requirements.',
		furtherReading: [
			{
				title: 'Discard Gem',
				url: 'https://github.com/jhawthorn/discard',
			},
			{
				title: 'PaperTrail Gem',
				url: 'https://github.com/paper-trail-gem/paper_trail',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'Add Soft Delete and Audit Trail nodes to the pipeline. Use discard for safe deletion and PaperTrail for change tracking. Write tests for both.',
	},
};
