Rails Expert: Game Design Document (The "Unicorn" Edition)
This is the definitive design document for Rails Expert. It outlines the 25-level progression from rails new to High-Scale Architecture.

Core Philosophy: Earned Mastery We do not tell the player what to do. We present a symptom (e.g., "The server is slow"), and the player must diagnose and fix it using standard Rails patterns.

🛠️ ACT I: The Foundation (Levels 1-5)
Theme: "Getting it Running." Focus: Project Setup, MVC, Associations, Persistence.

Level 1: The Stack Choice
Scenario: "Day 1. You are initializing the repository. Your architectural choices today will determine your scaling limits in Act IV." Learning Goal: Understanding rails new flags and database trade-offs. Starting State: A dark canvas with a blinking Terminal node. Two empty infrastructure slots: Database System and Frontend Architecture. Player Actions:

Drag PostgreSQL OR SQLite from the palette to the Database slot.
Trade-off: SQLite is simple (no config) but cannot support Sharding (Level 22).
Drag React OR Hotwire/ERB to the Frontend slot.
Trade-off: React requires a separate API layer. Hotwire is monolithic.
Click "Generate App". Mechanic - The Dependency Graph: The game remembers these choices. Choosing React adds a permanent APIOnly constraint for future levels. Rails Code: rails new myapp --database=postgresql --api
Level 2: The First Request (MVC)
Scenario: "The server is booting, but localhost:3000 is hitting a 404 Error." Learning Goal: The Request/Response Cycle. Starting State: A 
Request
 node firing red particles into the void. Router, Controller, View nodes are in the palette. Player Actions:

Place a Router node. Connect 
Request
 → Router.
Place a Controller node. Connect Router → Controller.
Place a View node. Connect Controller → View → Response. Mechanic - Ghost Particles: When the connection is incomplete, particles flow to the end of the line and "poof" into a red cloud. Rails Code: config/routes.rb → ApplicationController → views/home/index.html.erb
Level 3: Semantic Associations
Scenario: "We have a Blog, but we can't show Comments. The data isn't linking." Learning Goal: has_many vs belongs_to. Starting State: Locked MVC pipeline. Post Model is present (Locked). Router is dimmed. Player Actions:

Drag Comment Model to canvas.
Draw connection from Post → Comment.
Decision Modal: "Relationship Type?" Options: has_one, has_many, has_and_belongs_to_many.
Select has_many. Mechanic - Logic Check: If player selects has_one, the visual preview shows only one comment appearing on the blog post, triggering a "Requirement Failed" error. Rails Code: has_many :comments
Level 4: Persistence Layer
Scenario: "Users are complaining their posts vanish when the Dyno restarts." Learning Goal: Memory vs Disk persistence. Starting State: Working pipeline, but Models are glowing Blue (Transient). Player Actions:

Click "Simulate Restart". Watch data counter drop to 0.
Drag your chosen Database (from Level 1) to the canvas.
Connect Post & Comment nodes to Database.
Connect Database → View (Read path). Mechanic - Persistence Viz: Data particles turn Green (Persisted) after touching the DB node. They survive the "Restart" button. Rails Code: database.yml configuration.
Level 5: Environment Security
Scenario: "The build failed. CI/CD cannot connect to the database." Learning Goal: Secrets management. Starting State: Database node shows "Access Denied" lock icon. Player Actions:

Drag ENV node to canvas.
Inspect ENV node: Add DB_PASSWORD.
Connect ENV → Database. Review Step: If user leaves the ENV node "Publicly Visible" (toggle), a "Leak" event occurs. They must toggle "Encrypted". Rails Code: credentials.yml.enc vs .env files.
💎 ACT II: The Domain Layer (Levels 6-12)
Theme: "Clean Code." Focus: Refactoring, Patterns, Robustness.

Level 6: The Fat Controller
Scenario: "The CreateOrder controller is 300 lines long. It's handling payment, inventory, and emails. It is brittle." Learning Goal: Refactoring Logic to Models. Starting State: A Controller node pulsing Red (Complexity limits exceeded). Player Actions:

Click Controller to inspect "Logic Blocks": Validate, Charge, Email, Save.
Drag Validate and Save blocks to the Order Model. Mechanic - Complexity Meter: The Controller turns Green. The Model turns Yellow (getting fat, but improved). Rails Code: Order.create(params) (Moving logic into model callbacks).
Level 7: Service Objects
Scenario: "The Order Model is now too fat. It shouldn't know about Emailing." Learning Goal: Single Responsibility Principle (SRP). Starting State: Order Model pulsing Red. Player Actions:

Unlock Service node type.
Create OrderProcessorService.
Move Charge and Email logic blocks from Model to Service.
Rewire: Controller → Service → Model. Rails Code: app/services/order_processor.rb (PORO).
Level 8: The Command Pattern
Scenario: "Payment succeeded, but Email failed. Now the data is inconsistent." Learning Goal: Atomic Transactions / Command Chains. Starting State: A Service node doing too much. Player Actions:

Break Service into 3 atomic Commands: ChargeCard, DecrementInventory, SendEmail.
Chain them: Charge → Inventory → Email.
Wrap in Transaction block. Mechanic - Failure Sim: Simulate "Email Fail". Watch the Transaction block "Rollback" the previous steps (particles travel backwards). Rails Code: Rectify::Command or Iteraction pattern.
Level 9: Data Contracts (dry-validation)
Scenario: "Mobile app is sending garbage data. It's crashing the backend with 500s." Learning Goal: Input Validation at the boundary. Starting State: Jagged "Dirty" particles entering the Controller. Player Actions:

Place Contract node (dry-validation).
Place it before the Service/Model.
Define Schema: required(:email).filled(:string). Mechanic - Sanitizer: Jagged particles hit the Contract. Bad ones bounce off (422 Error). Smooth ones pass through. Rails Code: dry-validation schemas.
Level 10: Form Objects
Scenario: "Signup requires creating a User AND a Company. The Controller is hacking it." Learning Goal: Multi-model forms. Starting State: Controller trying to save two models. Fails validation often. Player Actions:

Create Form node (RegistrationForm).
Route Controller → Form.
Connect Form → User Model AND Company Model. Mechanic - Wrapper: The Form node aggregates errors from both models into one response. Rails Code: include ActiveModel::Model.
Level 11: Authorization (Pundit)
Scenario: "A Hacker found they can delete other users' posts if they guess the ID." Learning Goal: Resource Authorization. Starting State: Red "Hacker" particles successfully deleting data. Player Actions:

Attach Policy node (PostPolicy) to the Controller.
Config: def destroy? user.admin? end. Mechanic - Gatekeeper: Hacker particles are blocked at the Controller level (403 Forbidden). Rails Code: authorize @post (Pundit).
Level 12: ViewComponents
Scenario: "The 'User Card' UI logic is duplicated across 15 views. Changing it is a nightmare." Learning Goal: Encapsulated UI components. Starting State: 15 View nodes, all with identical internal red blocks. Player Actions:

Create Component node.
Extract the Red Block to the Component.
Wire Views to inherit/render the Component. Rails Code: ViewComponent::Base.
⚡ ACT III: The Ecosystem (Levels 13-18)
Theme: "Async & Integration." Focus: Performance, Resiliency, External Tools.

Level 13: 3rd Party APIs & Timeouts
Scenario: "The GitHub API is down. It's taking down our entire homepage." Learning Goal: Failing gracefully. Starting State: Homepage loading spins forever because of one widget. Player Actions:

Inspect connection to GitHub API.
Add Timeout Wrapper (e.g., 200ms).
Define "Fallback UI" (empty state). Mechanic - Fast Failure: The API request dies quickly, allowing the rest of the page to load. Rails Code: faraday timeouts.
Level 14: Background Jobs (Sidekiq)
Scenario: "Generating a PDF Report takes 10 seconds. The browser times out." Learning Goal: Asynchronous Processing. Starting State: Browser request hanging. Player Actions:

Place Redis node.
Place Worker node (ReportWorker).
Rewire: Controller → Redis (Enqueue).
Connect Redis → Worker (Process). Mechanic - The Queue: Request returns instantly "202 Accepted". Jobs pile up in Redis and drain slowly. Rails Code: ReportWorker.perform_async.
Level 15: Idempotency
Scenario: "The Worker retried the 'Charge' job twice because of a network blip. Customer charged twice!" Learning Goal: Idempotent operations. Starting State: Worker processing the same red particle twice. Player Actions:

Add 
Lock
 logic to Worker using Redis.
Config: unique_until: :success. Mechanic - The Merge: Two identical particles enter the Worker; only one executes. The second is discarded harmlessly. Rails Code: sidekiq-unique-jobs gem.
Level 16: Caching Strategy
Scenario: "The 'Trending Posts' query is hammering the DB. 99% Read traffic." Learning Goal: Read-Through Caching. Starting State: DB Load 100%. Latency High. Player Actions:

Place Redis (Cache Mode) before the DB.
Wrap the DB query in the Cache node. Mechanic - Cache Hits: First particle is Red (Miss), goes to DB, comes back. Subsequent particles are Green (Hit), return instantly from Redis. rails Code: Rails.cache.fetch.
Level 17: Webhooks (Incoming)
Scenario: "We handle payments, but we don't know when they succeed until the user refreshes." Learning Goal: Async Callbacks. Starting State: User staring at "Pending..." screen. Player Actions:

Create WebhookEndpoint.
Connect Stripe API → WebhookEndpoint.
Connect Webhook → Service → DB (Update Status). Rails Code: Stripe::Webhook.construct_event.
Level 18: File Storage (ActiveStorage)
Scenario: "Users are uploading 4k Images. App server RAM is exhausted buffering them." Learning Goal: Direct Uploads / Cloud Storage. Starting State: Server crashing on upload. Player Actions:

Add S3 Bucket node.
Config ActiveStorage mode: Direct Upload.
Route: Client Browser → S3. Mechanic - Bypass: Large data particles bypass the App Node entirely. Rails Code: has_one_attached :image, service: :s3.
🌐 ACT IV: Hyperscale Architecture (Levels 19-25)
Theme: "Unicorn Scale." Focus: Distributed Systems, Decoupling, Stability.

Level 19: Event Driven Architecture
Scenario: "The Checkout code knows too much (Email, Shipping, Inv, Analytics). It's a monolith." Learning Goal: Pub/Sub Pattern. Starting State: Checkout Service has 6 outgoing wires. Player Actions:

Add Event Bus (Kafka/RabbitMQ).
Delete wires.
Checkout publishes OrderPlaced.
Shipping/Email services Subscribe to OrderPlaced. Rails Code: karafka or event_bus gem.
Level 20: Feature Flags
Scenario: "We are deploying a risky new Checkout Flow. We can't afford to break it for everyone." Learning Goal: Progressive Delivery. Starting State: Connection to "New Checkout" node. Player Actions:

Insert FeatureFlag node (Flipper).
Config: percentage_of_actors: 10%. Mechanic - Rollout: 90% of particles go to Old Node. 10% go to New Node. Rails Code: Flipper.enabled?(:new_checkout).
Level 21: Read/Write Splitting
Scenario: "Database CPU is at 100%. It's mostly SELECT queries." Learning Goal: Database Replication. Starting State: Single DB Node catching fire. Player Actions:

Add Replica Node. Attach to Primary.
Update App Config: "Reads to Replica". Mechanic - Traffic Split: Blue particles (Reads) go to Replica. Orange (Writes) go to Primary. Rails Code: connects_to database: { writing: :primary, reading: :replica }.
Level 22: Database Sharding
Scenario: "The User table is 10TB. It won't fit on a single disk anymore." Learning Goal: Horizontal Sharding. Starting State: Disk Space Alarm. Player Actions:

Add 2 more DB nodes (Shard A, Shard B).
Define Shard Key: tenant_id.
Route traffic based on Key. Rails Code: Horizontal Sharding config.
Level 23: Circuit Breakers
Scenario: "The 'Recommendations' microservice is crashing. It's taking down the core Feed." Learning Goal: Blast Radius Containment. Starting State: Feed failing 100% because Recs are down. Player Actions:

Wrap Recs connection in CircuitBreaker.
Define "Open" state threshold (e.g., 5 errors). Mechanic - Circuit Open: After 5 errors, the connection "Snaps" open. Feed continues to load (without Recs). Rails Code: Stoplight gem.
Level 24: Observability
Scenario: "Requests are taking 2s. We have no idea which Service is the bottleneck." Learning Goal: Distributed Tracing. Starting State: A complex graph. Mystery latency. Player Actions:

Inject OpenTelemetry probes.
View Flame Graph.
Identify the "N+1" happening in the Billing Service (hidden deep in graph). Rails Code: OpenTelemetry::SDK.
Level 25: The Microservices Breakup
Scenario: "The Organization has scaled to 500 engineers. The Monolith deployment queue is 4 hours long." Learning Goal: Service Oriented Architecture (SOA). Starting State: One Giant App Node. Player Actions:

Use the Scalpel tool.
Carve out Billing domain into an independent Application Node.
Carve out Identity domain.
Establish HTTP/gRPC contracts between them.
Final Test: Deploy Billing while Identity is restarting. Success! Rails Code: Moving code to separate Repositories/Apps.