# Reference Implementations

## PipelineFlow-based (request lifecycle concepts)

Read Level 12 (Authorization) as the canonical example:
`frontend/src/features/act2-users-security/components/Level12Authorization.tsx`

## Custom visualization (non-pipeline concepts)

Each custom visualization level is a reference for how to tailor the visualization to the concept being taught. No two should look the same.

- **Level 10 (Validations):** "Data Gate" with vertical zones (Input -> Model Gate -> Database), because validations are about filtering data at the model layer before it reaches storage.
  `frontend/src/features/act2-users-security/components/Level10Validations.tsx`
- **Level 15 (CORS):** 3-zone horizontal flow (Client -> CORS Middleware Gate -> Rails API) with 2 FlowConnectors, because CORS is about a request crossing the network, hitting a middleware gate first, and only reaching the API if allowed. The client zone switches between browser chrome and terminal style depending on the probe (curl vs fetch).
  `frontend/src/features/act2-users-security/components/Level15CORS.tsx`
- **Level 26 (Database Indexing):** "Table Row Grid" with 100 blocks per table + IndexLookupCard, because indexing is about how the database searches rows. Seq Scan = red wave sweeps through all blocks. Index Scan = B-tree index card points directly to the match (green block). The visualization shows the mechanism (scanning vs looking up), not just the metric (820ms vs 0.05ms).
  `frontend/src/features/act4-performance/components/Level26Indexing.tsx`
- **Level 27 (Counter Caches):** "Database Table View" showing the actual posts schema (id, title, user_id) where the ABSENCE of the `comments_count` column is the teaching moment. Firing the probe triggers a cascade animation: each post row turns red sequentially as it fires a separate COUNT(*) query to the comments table. The reward phase adds the `comments_count` column to the table, and cached loads show all rows green instantly (no cross-table queries). Single probe design: one probe teaches the N+1 COUNT mechanism; multiple probes with different row counts would be metric repetition.
  `frontend/src/features/act4-performance/components/Level27CounterCaches.tsx`
- **Level 28 (Pagination):** "Page Stack" with 20 horizontal bars stacked vertically (each bar = 2,500 records out of 50K). Problem: all 20 bars cascade red top-to-bottom (loading everything). Solution: only 1 bar glows green (the page chunk requested), rest stay dim. Visually distinct from L26's block grid and L29's document grid because bars are wide horizontal slices that communicate "cutting data into pages."
  `frontend/src/features/act4-performance/components/Level28Pagination.tsx`
- **Level 29 (Search):** "Document Search Grid" with a 100-block grid (20x5). Problem: red wave sweeps ALL blocks (sequential scan with LIKE). Solution: GIN Index Card appears showing stemmed terms -> row IDs, matching blocks go green instantly. Visually distinct from L28's page stack because the grid represents database rows being scanned, not pages being sliced.
  `frontend/src/features/act4-performance/components/Level29Search.tsx`

## Design principles

The visualization shape, direction, and structure should emerge from the concept itself. L10 flows top-to-bottom because data moves through layers. L15 flows left-to-right because a request travels from client through a gate to the API. L26 shows a grid of row blocks because indexing is about how many rows the database touches. L27 shows a database table with schema columns because counter caches are about adding a column to avoid cross-table queries. Don't copy one level's layout onto another.

**Visualization uniqueness is non-negotiable.** Before designing or approving a visualization, check adjacent levels (N-2 to N+2) for visual similarity. If two levels use the same shape, redesign one. Ask: "If I showed a player screenshots of levels N-1, N, and N+1 side by side, could they tell which is which without reading the title?"
