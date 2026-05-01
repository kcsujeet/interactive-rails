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
			'Your API is secured, tested, and ready. Now a React frontend needs to call it from the browser, but cross-origin requests are blocked by default. Configure CORS to open the gate.',
	},
	problem: {
		observation:
			'You have been testing with curl, which bypasses browser security. But when the React frontend at localhost:3001 tries to call the API at localhost:3000, the browser blocks it: "Access to XMLHttpRequest has been blocked by CORS policy."',
		rootCause:
			'curl sends requests directly, so CORS never mattered until now. Browsers enforce the Same-Origin Policy, blocking requests between different origins (ports count). The API must explicitly allow the frontend origin with CORS headers.',
		codeExample: `# Browser console:
# "Access to XMLHttpRequest at 'http://localhost:3000/api/v1/products'
#  from origin 'http://localhost:3001' has been blocked by CORS policy"

# The React frontend runs on port 3001
# The Rails API runs on port 3000
# Different ports = different origins = blocked by default

# Rails does not configure CORS out of the box.
# You need the rack-cors gem to add CORS middleware.`,
		goal: 'Configure cross-origin resource sharing so a separate frontend can call your API, lock down allowed origins, and whitelist specific HTTP methods.',
		thresholds: {},
	},
	learningContent: {
		title: 'Cross-Origin Resource Sharing (CORS)',
		goal: `In this level, you'll:\n- understand why browsers block cross-origin requests by default.\n- install a CORS middleware gem and configure allowed origins.\n- learn why wildcard origins are dangerous in production.\n- whitelist specific HTTP methods for your API.`,
		conceptExplanation: `CORS (Cross-Origin Resource Sharing) is a browser security feature that blocks requests from one origin to another unless the server explicitly allows it.

**Why CORS exists:**
- Without CORS, any website could make API calls to your server using the user's cookies
- CORS forces the server to declare which origins are trusted
- The browser checks the CORS headers before allowing the response through

**How it works:**
- Browser sends a "preflight" OPTIONS request to check permissions
- Server responds with Access-Control-Allow-Origin, Allow-Methods, etc.
- If the origin matches, the browser allows the actual request
- If not, the browser blocks it (the request never reaches your code)

**rack-cors gem:**
- Adds CORS middleware at the Rack level (before Rails routing)
- Configure allowed origins, methods, and headers in an initializer
- Never use wildcard (\`"*"\`) in production`,
		railsCodeExample: `# Gemfile
gem "rack-cors"

# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "https://yourdomain.com", "http://localhost:3001"
    resource "/api/*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      expose: ["Authorization"],
      max_age: 600
  end
end

# What each option does:
# origins   - which domains can call your API
# resource  - which URL paths the CORS config applies to
# headers   - which request headers are allowed (:any = all)
# methods   - which HTTP methods are allowed
# expose    - which response headers the browser can read
# max_age   - how long (seconds) the browser caches preflight results`,
		commonMistakes: [
			'Setting origins to "*" in production (allows any website to call your API)',
			'Forgetting to include :options in allowed methods (breaks preflight requests)',
			'Not installing rack-cors and trying to set headers manually',
			'Using methods: :any instead of whitelisting specific methods',
		],
		whenToUse:
			'Every Rails API that serves a browser-based frontend (React, Vue, Next.js) needs CORS configuration. curl and mobile apps are not affected by CORS. Set it up when you connect your first browser frontend.',
		furtherReading: [
			{
				title: 'rack-cors',
				url: 'https://github.com/cyu/rack-cors',
			},
			{
				title: 'MDN: Cross-Origin Resource Sharing',
				url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
			},
			{
				title: 'Rails Security Guide',
				url: 'https://guides.rubyonrails.org/security.html',
			},
		],
	},
	hint: {
		delay: 20,
		text: 'A browser blocks JavaScript from loading data across origins by default. Your Rails app needs to opt-in by sending the right response headers; the standard Rack middleware for that lives in a well-known gem. Production config never uses a wildcard origin -- list the exact origins that should be allowed and reject everything else.',
	},
};
