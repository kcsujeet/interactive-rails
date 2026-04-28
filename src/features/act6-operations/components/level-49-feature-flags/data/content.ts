import type { Level } from '@/types';

export const level49FeatureFlags: Level = {
	id: 'act6-level49-feature-flags',
	actId: 6,
	levelNumber: 49,
	name: 'Feature Flags & Staged Rollouts',
	requiresTests: true,
	trigger: {
		type: 'new_feature',
		description:
			'A new payment processor is half-built. Marketing wants the launch next Tuesday at 9am sharp; engineering needs to ship the code now and turn it on then. And a third-party integration occasionally goes flaky and needs a kill switch faster than a redeploy.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'Every release is a deploy. Toggling a feature off means redeploying the previous version, ~30 minutes of downtime per cycle. Marketing cannot pin a feature to a launch time. There is no kill switch for a misbehaving vendor integration.',
		rootCause:
			'Deploy and release are coupled. The only way to change what users see is to ship code. There is no runtime toggle.',
		codeExample: `# Current: deploy = release. There is no toggle.
class PaymentsController < ApplicationController
  def create
    # New processor is half-built; behind no flag.
    # Shipping this branch means launching to everyone.
    NewPaymentProcessor.charge(...)
  end
end

# Vendor integration starts misbehaving in production.
# Only fix: revert the commit, redeploy. ~30 min of impact.

# Marketing schedules launch for Tuesday 9:00am.
# Engineering can land the code Monday but has no way to
# release it at the agreed time.`,
		goal: 'Decouple deploy from release. Add a runtime toggle so a feature can ship in one state (off) and be turned on later, gradually, or for a subset of users. Build a kill switch that does not require a redeploy.',
		thresholds: {},
	},
	successConditions: [{ type: 'feature_flags_configured' }],
	availableNodes: [],
	unlockedNodes: [],
	learningContent: {
		title: 'Feature Flags & Staged Rollouts',
		goal: `In this level, you'll:\n- decouple deploy time from release time so engineering and marketing can work to different schedules.\n- wrap a feature behind a runtime toggle so it ships off and can be turned on later.\n- ramp a rollout from 5% to 100% so an issue affects 5% of traffic, not all of it.\n- build a kill switch you can flip in seconds during an incident.`,
		conceptExplanation: `Feature flags decouple two things that traditionally happen together: shipping the code and turning the feature on. With flags, you ship the code in the off state, deploy it like normal, and then flip the flag at the moment you actually want users to see the change.

Once you have flags in place, you stop being scared of deploys. Three concrete capabilities they buy you:

**1. Time-shifted release.** Engineering ships Monday; marketing flips it on Tuesday at 9am sharp. Without flags, those two need to coordinate a deploy window. With flags, they don't.

**2. Gradual rollout.** Turn the new feature on for 5% of users. Wait an hour. If error rates and latency look fine, ramp to 25%. Then 50%. Then 100%. If something breaks at 5%, only 5% of users are affected, not 100%, and the fix is a flag flip, not a redeploy.

**3. Kill switch.** A third-party vendor starts returning 500s. With flags, you flip the gate to off and the request immediately routes to the legacy code path that does not call the vendor. Mean time to recovery is seconds, not the 20 to 30 minutes a Kamal redeploy takes.

**Flipper (the de facto Ruby gem):**

\`Flipper\` (gem \`flipper-active_record\`) is the standard. Stores flags in your existing database, gives you a runtime API and an admin UI, supports actor-scoped flags, percentage rollouts, group-based flags, and individual flag enables.

The core API:

\`\`\`ruby
Flipper.enabled?(:new_payment_processor)              # boolean global
Flipper.enabled?(:new_payment_processor, current_user) # actor-scoped
Flipper.enable(:new_payment_processor)                # turn on globally
Flipper.disable(:new_payment_processor)               # kill switch
Flipper.enable_percentage_of_actors(:my_feature, 5)   # 5% rollout
Flipper.enable_actor(:beta_feature, current_user)     # only this user
\`\`\`

**Percentage of actors vs percentage of time:**

These are not the same thing.

- \`enable_percentage_of_actors\` hashes the actor id, so the same user always lands in the same bucket. User 42 either sees the feature on every visit or never. Stable. Use this for rollouts.
- \`enable_percentage_of_time\` flips a coin per *call*. The same user might see the feature on one click and not the next. Useful for shadow traffic; nearly always wrong for user-facing rollouts.

**The admin UI gotcha:**

Flipper ships an admin UI you can mount at \`/flipper\`. It is the operational tool your oncall uses during an incident. Two things to get right:

1. **Auth.** Mount it inside an \`authenticate\` block that gates on \`current_user.admin?\`. An unauthenticated \`/flipper\` route is the same as printing your kill switches on a billboard.
2. **Audit log.** Every flag flip should produce a log line you can correlate with incident timelines: who flipped what, when. The default Flipper instrumentation hooks into ActiveSupport::Notifications and you can pipe that to your APM (L52) or your structured error monitoring (L48).

**Flag debt:**

A flag that has been at 100% for six months is a fork in your codebase that nobody is reading. It accumulates conditional branches that no longer matter, makes the code harder to follow, and one day someone forgets which branch is the live one.

Treat flags like locks: every flag you add gets a TODO with the date you expect it to be at 100% and removed. Sweep flags older than two months. Most engineering teams that adopt flags successfully also adopt a flag-cleanup ritual (weekly, or quarterly) to keep the count down.

**What flags are NOT for:**

Flags are for releasing CODE, not for permanent product behavior. If you are reaching for a flag to gate "this customer pays for premium," that is a *plan* or *entitlement*, not a flag, and it belongs in your billing/subscriptions model. Flag debt is bad enough; permanent flags masquerading as configuration are worse because they never get cleaned up.`,
		railsCodeExample: `# Gemfile
gem "flipper"
gem "flipper-active_record"
gem "flipper-ui"  # for the admin UI

# After bundle: bin/rails generate flipper:setup && bin/rails db:migrate

# config/initializers/flipper.rb
Flipper.configure do |config|
  config.adapter { Flipper::Adapters::ActiveRecord.new }
end

# app/controllers/payments_controller.rb
class PaymentsController < ApplicationController
  def create
    if Flipper.enabled?(:new_payment_processor, Current.user)
      NewPaymentProcessor.charge(
        amount_cents: params[:amount_cents],
        user: Current.user
      )
    else
      LegacyPaymentProcessor.charge(
        amount_cents: params[:amount_cents],
        user: Current.user
      )
    end
  end
end

# config/routes.rb
Rails.application.routes.draw do
  authenticate :user, ->(user) { user.admin? } do
    mount Flipper::UI.app(Flipper) => "/flipper"
  end

  # ... your other routes
end

# Operational examples (Rails console or Flipper UI):

# Turn on for everyone (full launch):
Flipper.enable(:new_payment_processor)

# Kill switch (during incident):
Flipper.disable(:new_payment_processor)

# 5 percent gradual rollout:
Flipper.enable_percentage_of_actors(:new_payment_processor, 5)

# Beta opt-in for specific users:
Flipper.enable_actor(:new_payment_processor, beta_user)

# Group-based (employees only):
Flipper.register(:employees) { |actor| actor.email.ends_with?("@yourco.com") }
Flipper.enable_group(:new_payment_processor, :employees)

# Audit instrumentation (so flag flips show up in your logs / APM):
ActiveSupport::Notifications.subscribe(/flipper/) do |name, _start, _finish, _id, payload|
  Rails.logger.info(
    event: "flipper.#{name}",
    feature: payload[:feature_name],
    operation: payload[:operation],
    user_id: payload[:thing]&.respond_to?(:id) ? payload[:thing].id : nil
  )
end`,
		commonMistakes: [
			'Coupling deploy and release: every release means a deploy, every rollback means a deploy',
			'Mounting the Flipper admin UI without admin auth (anyone with the URL can flip your kill switches)',
			'Using `enable_percentage_of_time` for user-facing rollouts (the same user sees the feature flip on and off across requests)',
			'Always-on rollouts (5% canary not possible without per-actor percentage)',
			'No audit log on flag flips (no way to correlate "the incident started after this flag flipped")',
			'Flag debt: flags that linger long after the feature is fully launched, accumulating dead conditional branches',
			'Using flags for permanent product configuration (entitlements, plans). Those belong in your billing model, not Flipper',
		],
		whenToUse:
			'Any feature where you want to ship code now and release it later, ramp it gradually, or kill it during an incident without a redeploy. The bar for adding a flag is low; the bar for keeping one past two months is high.',
		furtherReading: [
			{
				title: 'Flipper (Ruby gem)',
				url: 'https://github.com/jnunemaker/flipper',
			},
			{
				title: 'Flipper UI (admin interface)',
				url: 'https://github.com/jnunemaker/flipper/tree/main/lib/flipper/ui',
			},
			{
				title: 'GitHub: How we ship features',
				url: 'https://github.blog/engineering/scaling-the-github-api-with-a-sharded-replicated-rate-limiter-in-redis/',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Wrap the new feature behind a runtime check. Then add an admin UI behind admin auth so you can flip it without redeploying.',
	},
};
