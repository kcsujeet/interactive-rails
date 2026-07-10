import type { Level } from '@/types';

export const level41CORS: Level = {
	id: 'act6-level41-cors',
	actId: 6,
	levelNumber: 41,
	name: 'CORS',
	startingPipeline: { nodes: [], connections: [] },
	successConditions: [],
	availableNodes: [],
	unlockedNodes: [],
	trigger: {
		type: 'security_audit',
		description:
			'The storefront moved onto its own origin this morning, and now every page is blank. The API is healthy: requests arrive, queries run, responses return 200. The browser just refuses to hand any of it to the page. Find out where the enforcement actually lives, then grant permission deliberately.',
	},
	problem: {
		observation:
			"Customers see an empty storefront while the Rails log shows nothing but 200s. The browser console explains: responses from the API carry no Access-Control-Allow-Origin header, so the browser discards them before the page's script can read a byte. Deletes are worse: the browser asks permission first with an OPTIONS preflight, gets no answer, and never sends the DELETE at all. Meanwhile curl reads the same endpoint perfectly.",
		rootCause:
			"Browsers protect their users with the Same-Origin Policy: a script from one origin cannot read another origin's responses unless that server grants permission via response headers. The enforcement is entirely browser-side. Requests still reach Rails and Rails still does the work; the browser withholds the result. The API has never granted permission to anyone, because until today everything shared one origin and the question never came up.",
		codeExample: `# Rails log (the server is fine):
#   Started GET "/api/products" for 127.0.0.1
#   Completed 200 OK in 12ms

# Browser console (the user sees none of it):
#   Access to fetch at 'http://localhost:3000/api/products'
#   from origin 'http://localhost:3001' has been blocked
#   by CORS policy: No 'Access-Control-Allow-Origin' header
#   is present on the requested resource.

# Same endpoint from curl: 200 OK, full JSON.
# No browser, no Same-Origin Policy, no check.

# The gap is a missing RESPONSE HEADER, not broken
# request handling. Only the server can grant the
# permission; only the browser enforces it.`,
		goal: 'Grant the storefront origin permission to read API responses, answer preflight checks so riskier requests can go out, and keep every other origin locked out, without affecting non-browser clients.',
		thresholds: {},
	},
	learningContent: {
		title: 'Cross-Origin Resource Sharing (CORS)',
		goal: `In this level, you'll:\n- learn where CORS is actually enforced (the browser, not the server) and who it protects (the browser's user).\n- see why a cross-origin GET still reaches Rails and still runs, even while the page shows nothing.\n- learn what a preflight is, which requests trigger one, and what happens when it fails.\n- configure allowed origins and methods, and understand why wildcards defeat the point.`,
		conceptExplanation: `CORS (Cross-Origin Resource Sharing) is how a server grants browsers permission to share its responses with pages from other origins. The enforcement lives entirely in the browser; the protection is for the browser's user.

**The mechanism, precisely (per MDN's CORS guide):**
- **Simple requests (like GET) are sent normally.** The request reaches Rails, Rails runs it, and the response travels back. The browser then checks for an Access-Control-Allow-Origin header; if it is missing, the browser withholds the response from the page's script. The server did the work; the script gets nothing. Nothing was "blocked before reaching the server".
- **Riskier requests (DELETE, PUT, custom headers) are preflighted.** The browser first sends an OPTIONS request asking "may I send DELETE from this origin?". Only if that preflight comes back with permission does the actual request go out. A failed preflight means the real request is NEVER sent.
- **Only browsers enforce any of this.** curl, mobile apps, and server-to-server calls read cross-origin responses freely. CORS is not a wall around your API; it is a rule browsers follow to stop one website's script from reading another site's data through a visitor's browser.

**The fix in Rails: rack-cors.** A Rack middleware (from the gem rack-cors) that sits in front of routing. Per its source: it answers preflight OPTIONS requests itself, directly, without ever calling the app; and for actual requests it never blocks anything, it just adds the permission headers when the origin is on your list. A disallowed origin's request still runs; its response simply carries no permission header, and the visitor's browser withholds it.

**Rails ships the starting point.** An API-mode Rails app generates config/initializers/cors.rb with a commented-out example and a commented gem line, because the framework cannot guess which origins you trust. Naming them is your call, and this level's build.

**Why never a wildcard:** origins "*" tells every browser on earth that any website may read your API's responses from its visitors' browsers. The value of the list is that it is short and deliberate.`,
		railsCodeExample: `# Gemfile
gem "rack-cors"

# config/initializers/cors.rb
# (rails new --api generates this file commented out;
#  the build fills it in)
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "http://localhost:3001"

    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end

# What each piece does:
# insert_before 0 - runs before everything, so preflights
#                   are answered without touching routing
# origins         - who may READ responses (the callers'
#                   origins, never the API's own address)
# resource        - which API paths this permission covers
# headers: :any   - which request headers callers may send
# methods         - which verbs a permitted origin may use
#                   (matches the Rails-generated template)`,
		commonMistakes: [
			'Believing CORS blocks requests from reaching the server (simple requests reach Rails and run; the browser withholds the response from the script)',
			'Treating CORS as server security (an attacker with curl is not affected; CORS protects browser users, and server-side auth is still on you)',
			'Setting origins to "*" (any website may then read your API responses through its visitors\' browsers)',
			"Listing the API's own address as an origin (the list names where calls come FROM)",
			'Forgetting that DELETE and PUT preflight first (a failed OPTIONS means the real request is never sent, which looks like a dead button)',
		],
		whenToUse:
			'The moment a browser frontend is served from a different origin than the API (different port counts). curl, mobile apps, and server-to-server calls never need it. Set it up deliberately with named origins; revisit the list at deploy time when the real domain exists.',
		furtherReading: [
			{
				title: 'MDN: Cross-Origin Resource Sharing',
				url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS',
			},
			{
				title: 'rack-cors',
				url: 'https://github.com/cyu/rack-cors',
			},
			{
				title: 'Rails Security Guide',
				url: 'https://guides.rubyonrails.org/security.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'The server is fine; the browser is waiting for a response header that grants permission. Rails cannot guess which origins you trust, so an API-mode app ships a commented-out starting point in config/initializers. Name the exact origin the storefront is served from; a wildcard would grant everyone.',
	},
};
