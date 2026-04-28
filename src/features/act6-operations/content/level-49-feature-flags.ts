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

This is one of the highest-leverage operational patterns in modern web engineering. Once you have it, you stop being scared of deploys.

(Full concept treatment lands in this level's body. This is the briefing-screen summary.)`,
		railsCodeExample: `# (Full code example to be filled in.)
# Wrapping a feature behind a flag:
if Flipper.enabled?(:new_payment_processor, current_user)
  NewPaymentProcessor.charge(...)
else
  LegacyPaymentProcessor.charge(...)
end`,
		commonMistakes: [
			'Coupling deploy and release: every release means a deploy, every rollback means a deploy',
			'No kill switch for third-party integrations (only fix is revert+redeploy)',
			'Always-on rollouts (5% canary not possible)',
			'Flag debt: flags that linger long after the feature is fully launched',
		],
		whenToUse:
			'Any feature where you want to ship code now and release it later, ramp it gradually, or kill it during an incident without a redeploy.',
		furtherReading: [
			{
				title: 'Flipper (Ruby gem)',
				url: 'https://github.com/jnunemaker/flipper',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'Wrap the new feature behind a runtime check. Add an admin UI to flip it without redeploying.',
	},
};
