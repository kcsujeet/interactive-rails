import type { Level } from '@/types';

export const level57APIGateway: Level = {
	id: 'act7-level57-api-gateway',
	actId: 7,
	levelNumber: 57,
	name: 'API Gateway',
	trigger: {
		type: 'architecture',
		description:
			'Every screen of the mobile app stitches itself together from separate API calls. The dashboard alone makes six sequential round trips, downloads whole resources for slivers of screen, and has six internal paths baked into every shipped version: the backend cannot move anything without breaking customers.',
	},
	startingPipeline: { nodes: [], connections: [] },
	problem: {
		observation:
			'One dashboard screen costs six round trips (2.4s on 4G), 480KB of payload for 6KB of pixels, and a blank screen if any single call fails. Renaming one internal route 404s every installed app until an app-store release lands.',
		rootCause:
			'There is no entry point that belongs to the screen. Clients talk to six resource endpoints directly, so latency, payload shape, failure handling, and URL stability are all the client app’s problem, and the client is the one thing you cannot redeploy quickly.',
		codeExample: `# How the shipped app renders the dashboard today:
#
#   GET /api/v1/users/me          (full profile: 44KB)
#   GET /api/v1/orders            (full orders: 120KB)
#   GET /api/v1/stock             (every row: 96KB)
#   GET /api/v1/notifications     (52KB)
#   GET /api/v1/billing/summary   (line items: 88KB)
#   GET /api/v1/metrics           (every datapoint: 80KB)
#
# Six sequential 4G round trips (~400ms each) = 2.4s spinner.
# 480KB downloaded; the screen displays about 6KB.
# One failed call = blank dashboard (no per-section handling).
# Six paths hardcoded in the shipped binary = the backend
# cannot rename or reorganize anything without an app release.`,
		goal: 'Serve each client screen from a single, stable entry point: authenticate once, return exactly what the screen needs, degrade gracefully when one section fails, and leave the backend free to reorganize behind the stable URL.',
		thresholds: {
			maxLatency: 400,
		},
	},
	successConditions: [{ type: 'api_gateway_configured' }],
	availableNodes: ['api_gateway', 'rate_limiter'],
	unlockedNodes: ['api_gateway'],
	learningContent: {
		title: 'API Gateway Pattern',
		goal: `In this level, you'll:\n- learn why client-stitched screens are slow, fragile, and freeze your backend's internal structure.\n- build a single entry point that authenticates once and serves a whole screen in one round trip.\n- shape responses to what the screen shows instead of returning whole resources.\n- degrade gracefully per section so one failure never blanks a screen.`,
		conceptExplanation: `An API gateway is a single entry point that owns the conversation with clients, so the rest of the backend does not have to.

**The core trade it makes:**
Six client-side calls become one. Round trips over the phone network are the expensive part (hundreds of milliseconds each); calls inside your own app are microseconds. Moving the stitching from the client to the server converts five slow network hops into five cheap method calls.

**What lives at the gateway:**
- **One auth check per screen:** identity is established once at the entry point, then passed to each section.
- **Payload shaping:** the response contains what the screen shows: a count, a total, a top-three list, not whole resources. (When the aggregation is tailored to one client's screens like this, the pattern is often called Backend for Frontend.)
- **Per-section fallbacks:** a failing section becomes an "unavailable" marker in the response; the screen renders everything else.
- **Edge protections:** one rate limit at the door covers everything behind it.

**The seam it creates:**
Clients know ONE stable URL. Behind it, the backend calls each package's public reader. That indirection is what lets the backend reorganize freely: rename routes, restructure packages, and later, when a package outgrows the app entirely and becomes its own service, clients keep calling the same URL and never notice the move. A gateway is the precondition for restructuring the backend without breaking shipped apps.

**Gateway inside the app vs. gateway infrastructure:**
At this stage the gateway is a controller in the monolith: full control, no new moving parts. Dedicated gateway infrastructure (Kong, AWS API Gateway) earns its place when there are many separate backends to front, which is exactly the future the capstone designs toward.`,
		railsCodeExample: `# app/controllers/api/v1/gateway_controller.rb
class Api::V1::GatewayController < ApplicationController
  # Authentication concern (L9) already verifies the session
  # once per request; Current.user is set for all sections.

  rate_limit to: 60, within: 1.minute,
    by: -> { request.remote_ip },
    with: -> {
      render json: { error: "Rate limit exceeded" },
        status: :too_many_requests
    }

  # Each section maps to a package's PUBLIC reader (L55
  # boundaries): the gateway never touches package internals.
  SECTIONS = {
    orders: Orders::Public::DashboardSummary,
    inventory: Inventory::Public::LowStock,
    notifications: Notifications::Public::UnreadCount,
    billing: Billing::Public::MonthSummary,
    analytics: Analytics::Public::TopProducts,
  }

  # GET /api/v1/dashboard: the whole screen, one round trip
  def dashboard
    render json: {
      orders: section(:orders),
      inventory: section(:inventory),
      notifications: section(:notifications),
      billing: section(:billing),
      analytics: section(:analytics),
    }
  end

  private

  # One failing section degrades to a marker instead of
  # blanking the screen; the error still gets reported (L46).
  def section(key)
    SECTIONS.fetch(key).call(user: Current.user)
  rescue StandardError => e
    Rails.error.report(e)
    { status: "unavailable" }
  end
end

# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      get "dashboard", to: "gateway#dashboard"
    end
  end
end`,
		commonMistakes: [
			'Calling your own app over HTTP from the gateway (recreates the round-trip cost you just removed; use in-process readers)',
			'Returning full serializers from the gateway (same 480KB in one envelope; shape the payload to the screen)',
			'Letting one section’s exception bubble into a 500 for the whole screen (rescue per section, render the rest)',
			'Reaching past package boundaries into private models instead of public readers (the boundary check fails and refactors start breaking the dashboard)',
			'Putting business logic in the gateway (it composes and shapes; the packages own the rules)',
		],
		whenToUse:
			'When clients assemble screens from several API calls, especially mobile clients on slow networks, or when shipped clients are coupled to internal URLs you need the freedom to change.',
		furtherReading: [
			{
				title: 'API Gateway Pattern',
				url: 'https://microservices.io/patterns/apigateway.html',
			},
			{
				title: 'Backends For Frontends',
				url: 'https://samnewman.io/patterns/architectural/bff/',
			},
		],
		homework: [
			{
				task: 'Build a screen endpoint: a GatewayController#dashboard that serves one screen in one round trip, calling two or three in-process readers (orders summary, product count, unread notifications) and shaping the payload to exactly what the screen shows.',
				commands: ['curl -s http://localhost:3000/api/v1/dashboard'],
				verify:
					'One request returns one JSON object with every section present, replacing what previously took a separate call per section.',
			},
			{
				task: 'Degrade per section: rescue each section individually, report the error through Rails.error, and render a status unavailable marker for just that section. Test it by making one reader raise.',
				commands: ['curl -s http://localhost:3000/api/v1/dashboard'],
				verify:
					'With one section deliberately raising, the response is still 200: the broken section shows status unavailable while every other section renders its real data.',
			},
		],
	},
	hint: {
		delay: 25,
		text: 'The screen needs one door, not six. Authenticate at that door once, gather each section from the package that owns it, and hand back exactly what the screen renders.',
	},
};
