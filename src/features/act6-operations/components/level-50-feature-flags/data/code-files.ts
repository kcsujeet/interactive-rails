import { registerLevelCode } from '@/lib/codebase-registry';
import type { Phase } from '../types';
import { STEP_DEFS } from './build-steps';

interface CodeFile {
	filename: string;
	language: string;
	code: string;
	highlight?: number[];
}

const CONTROLLER_BROKEN = `class PaymentsController < ApplicationController
  def create
    # Hardcoded. No flag, no toggle, no rollback path.
    NewPaymentProcessor.charge(
      amount_cents: params[:amount_cents],
      user: Current.user
    )
  end
end`;

const CONTROLLER_AFTER_WRAP = `class PaymentsController < ApplicationController
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
end`;

const FLIPPER_INITIALIZER = `# config/initializers/flipper.rb
Flipper.configure do |config|
  config.adapter { Flipper::Adapters::ActiveRecord.new }
end

# Flag flips emit ActiveSupport::Notifications.
# Pipe them to your structured logger so the audit trail
# correlates with incident timelines.
ActiveSupport::Notifications.subscribe(/flipper/) do |name, _s, _f, _id, payload|
  Rails.logger.info(
    event: "flipper.#{name}",
    feature: payload[:feature_name],
    operation: payload[:operation]
  )
end`;

const ROLLOUT_CONSOLE = `# Operations runbook (Rails console or Flipper UI)

# Hard kill switch:
Flipper.disable(:new_payment_processor)

# 5% rollout (stable per actor):
Flipper.enable_percentage_of_actors(:new_payment_processor, 5)

# Beta opt-in for a specific user:
Flipper.enable_actor(:new_payment_processor, beta_user)

# Full launch:
Flipper.enable(:new_payment_processor)`;

const ROUTES_WITH_ADMIN_UI = `Rails.application.routes.draw do
  authenticate :user, ->(user) { user.admin? } do
    mount Flipper::UI.app(Flipper) => "/flipper"
  end

  resources :payments, only: [:create]
  # ...
end`;

// `furthestStep` here is the count of completed steps. While the player is
// WORKING on step k (not yet completed), furthestStep === k. After the player
// completes step k, furthestStep === k + 1.
//
// Boundary table:
//   furthestStep <= 2  -> controller still broken (gem install + migration
//                         done, but the wrap is still ahead)
//   furthestStep >= 3  -> controller wrapped (Flipper.enabled? in place)
//   furthestStep >= 4  -> rollout console artifact appears
//   furthestStep >= 5  -> admin UI route mounted
export function getCodeFiles(phase: Phase, furthestStep: number): CodeFile[] {
	if (phase === 'observe') {
		return [
			{
				filename: 'app/controllers/payments_controller.rb',
				language: 'ruby',
				code: CONTROLLER_BROKEN,
				highlight: [3, 4, 5, 6, 7],
			},
		];
	}

	const files: CodeFile[] = [];

	// Controller: broken until step 2 (wrap feature) is completed.
	if (furthestStep <= 2) {
		files.push({
			filename: 'app/controllers/payments_controller.rb',
			language: 'ruby',
			code: CONTROLLER_BROKEN,
			highlight: [3, 4, 5, 6, 7],
		});
	} else {
		files.push({
			filename: 'app/controllers/payments_controller.rb',
			language: 'ruby',
			code: CONTROLLER_AFTER_WRAP,
			highlight: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
		});
		files.push({
			filename: 'config/initializers/flipper.rb',
			language: 'ruby',
			code: FLIPPER_INITIALIZER,
		});
	}

	// Step 3 done (rollout strategy chosen)
	if (furthestStep >= 4) {
		files.push({
			filename: 'docs/operations/feature_flags.md',
			language: 'ruby',
			code: ROLLOUT_CONSOLE,
		});
	}

	// Step 4 done (admin UI mounted)
	if (furthestStep >= 5) {
		files.push({
			filename: 'config/routes.rb',
			language: 'ruby',
			code: ROUTES_WITH_ADMIN_UI,
			highlight: [2, 3, 4],
		});
	}

	return files;
}

registerLevelCode('act6-level50-feature-flags', () =>
	getCodeFiles('reward', STEP_DEFS.length),
);
