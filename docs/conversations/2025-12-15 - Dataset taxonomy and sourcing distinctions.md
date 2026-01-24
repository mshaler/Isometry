# Dataset taxonomy and sourcing distinctions

**Date:** 2025-12-15 02:38

## Summary

**Conversation Overview**

The user continued developing the taxonomic architecture for their CardBoard application, building on previous work with PAFV (Planes → Axes → Facets → Values) and LATCH (Location, Alphabet, Time, Category, Hierarchy) organizing principles. They sought to apply similar taxonomic rigor to data organization, questioning whether "dataset" was too coarse a term for their system that handles multiple data sources, unified file formats, SQLite database storage, and ETL capabilities. The user was particularly concerned about terminology clarity as CardBoard apps begin mixing and matching across datasets.

Through collaborative exploration, they identified that "dataset" suffered from semantic overload similar to how "dimension" had before PAFV clarification. The conversation revealed orthogonal concerns hiding within the dataset concept: provenance (ETL origin), domain (semantic meaning), lifecycle (sync behavior), and schema (structural shape). The user provided a concrete example involving a Contact Card that displays the top 10 messages from multiple sources (Mail, iMessage, Slack) as a materialized view, clarifying that end users don't need detailed provenance, domain, or lifecycle information, though Designer/Analyst personas might require schema visibility in certain modes.

This led to the development of a three-layer hierarchical model: Sources → Streams → Surfaces. Sources represent system-level ETL connections hidden from consumers, Streams are unified entity collections that abstract away provenance while maintaining conformant schemas, and Surfaces are PAFV-projected views that users actually interact with. The key insight established that CardBoard apps mix Streams rather than Sources, with provenance maintained at the system level while consumers see unified entities. The user demonstrated their preference for concrete examples to validate abstract architectural concepts and showed continued commitment to semantic precision in their system's taxonomy.

---

## Human

I am very grateful that we have achieved much greater clarity in the taxonomy enhancements made with PAFV and LATCH. Now I want to apply similar scrutiny to data sets: we have multiple data sources, a unified file format, a singular database with powerful DDL, and our ETL capability is looking very compelling. My question tonight is this: should we call each dataset just a dataset or should we make finer grade distinctions between datasets, especially once CardBoard apps start mixing and matching across datasets?

## Assistant

Michael is asking a really important architectural question about data organization terminology. He's achieved clarity with PAFV (Planes → Axes → Facets → Values) and LATCH (Location, Alphabet, Time, Category, Hierarchy) as organizing principles. Now he wants to apply similar taxonomic rigor to how CardBoard handles datasets.

The context from his memory and the architecture document suggests:
- Multiple data sources (Apple ecosystem, web apps, ETL imports)
- SQLite as the unified storage layer
- HyperFormula for spreadsheet functionality
- The concept of Cards as atomic units (both Nodes and Edges in LPG)
- Apps that will mix and match across datasets

This is a question about whether "dataset" is too coarse a term, similar to how "dimension" was semantically overloaded before PAFV clarified things.

Let me think about what distinctions might matter:

1. **Origin/Provenance** - Where did the data come from?
   - Native CardBoard data (created in the app)
   - ETL imports (Apple Notes, Reminders, etc.)
   - External APIs/web scraping
   - Manual imports (CSV, Excel)

2. **Schema/Structure** - What shape is the data?
   - Strongly typed (defined schema)
   - Loosely typed (JSON blobs)
   - Graph-structured (nodes + edges)
   - Tabular (rows + columns)

3. **Lifecycle/Sync** - How does it stay current?
   - Live (real-time sync)
   - Snapshot (point-in-time import)
   - Cached (read-only copy)
   - Derived (computed from other data)

4. **Ownership/Scope** - Who "owns" this data?
   - Personal (single user)
   - Shared (collaborative)
   - Public (reference data)
   - System (CardBoard internals)

5. **Cardinality** - How does it relate to other data?
   - Primary (source of truth)
   - Secondary (derived/linked)
   - Lookup/Reference (supporting data)

I see a potential hierarchical approach emerging that builds on existing organizational principles. The proposed taxonomy moves from broad conceptual containers to increasingly specific data representations. This approach allows flexible classification while maintaining a clear structural logic, similar to how PAFV provides semantic clarity. The hierarchy enables nuanced understanding of data relationships, provenance, and potential transformations within the CardBoard ecosystem.

The key insight reveals two fundamental perspectives on data organization:
1. Provenance tracking the origin and transformation pipeline
2. Domain representation capturing semantic meaning

A single data entity can simultaneously exist in multiple contexts - its technical import details and its business-relevant classification. This dual-lens approach suggests apps would interact differently based on their primary concern: ETL systems focusing on source tracking, while domain-specific applications concentrate on meaningful content.

Critical exploration questions emerge around data integration, tracking, and management:
- Defining the fundamental mixing unit across applications
- Maintaining provenance without complicating domain models
- Establishing appropriate granularity for access control
- Managing schema evolution across diverse sources

The conversation feels like a collaborative discovery process, inviting open-ended exploration rather than prescriptive solutions.This is exactly the right question at the right time. You've achieved taxonomic clarity for *organizing* data (PAFV) and *operating* on data (LATCH/GRAPH). Now you're asking about the taxonomy for *sourcing* data—and "dataset" does feel semantically overloaded in the same way "dimension" was before PAFV.

Let me surface what I think are the orthogonal concerns hiding inside "dataset":

**Provenance** (ETL concern): Where did this data originate?
- Apple Notes, Gmail, manual CSV import, native CardBoard creation

**Domain** (semantic concern): What does this data represent?
- People, Projects, Messages, Documents

**Lifecycle** (sync concern): How does it stay current?
- Live-sync, snapshot, derived/computed, cached

**Schema** (structural concern): What's its shape?
- Strongly typed table, flexible JSON, graph edges

A single Card might be:
- **Provenance**: Apple Notes ETL
- **Domain**: Project documentation  
- **Lifecycle**: Nightly sync
- **Schema**: Note (title, body, created, modified)

When CardBoard apps "mix and match," they're probably working at the **Domain** level while the system tracks **Provenance** for lineage. But the terminology isn't clear yet.

A few questions to probe this:

1. When you imagine an app mixing data, is it mixing across *sources* (Apple Notes + Gmail) or across *domains* (People + Projects)?

2. Should provenance be visible to apps, or is it system-level metadata they shouldn't care about?

3. Is there a hierarchical structure here (like PAFV) or a duality (like LATCH/GRAPH)?

## Human

Here’s an illustrative example: when I open a contact from Apple Contacts, I want to be able to see that Contact Card with Top 10 messages (perhaps a materialized view refreshed on opening?) which may span Mail, iMessage, Slack, etc. I don’t need and probably don’t want detailed Provenance nor Domain nor Lifecycle but perhaps Schema in Maker/Doer modes, but that’s different from Designer/Analyst personas. Does that clarify matters?

## Assistant

Michael is giving me a concrete use case that clarifies the abstraction levels. Let me think through this:

The Contact Card example shows:
- The **user/consumer** doesn't care about provenance (Mail vs iMessage vs Slack)
- They want a **unified view** of "messages with this person"
- The **system** needs to know provenance for ETL/sync purposes
- **Designer/Analyst** personas might need schema visibility

This is similar to how in PAFV, the user sees "a grid of cards" while the system knows "Time axis mapped to Y-plane, Category axis mapped to X-plane."

So there's a layering here:
1. **Presentation layer**: "Messages with Sarah" (domain-unified)
2. **Integration layer**: Knows these came from Mail, iMessage, Slack (provenance-aware)
3. **Source layer**: The actual ETL connectors

The user-facing concept is something like "Messages" (a unified domain) regardless of source. The system tracks lineage but abstracts it away.

This feels like it might parallel:
- **Source** (raw ETL origin) → like "facets" in PAFV - the specific implementation
- **Stream** (unified domain) → like "axes" in PAFV - the organizing principle
- **View** (materialized/rendered) → like "planes" in PAFV - the spatial projection

Or maybe:
- **Origin** → where it came from (Mail, Slack, iMessage)
- **Entity** → what it represents (Message, Person, Project)
- **Blend** → the unified collection the user sees

The key insight Michael is surfacing: the consumer shouldn't need to think about provenance—they think in terms of unified entities. But the system maintains provenance for sync/lineage/debugging.

This is like how in a data warehouse you have:
- **Sources** (operational systems)
- **Staging** (raw extracts)
- **Conformed dimensions** (unified entities)


- **Marts** (domain-specific views)

I'm exploring CardBoard's native language for these concepts. I see three key abstractions:
- **Tap**: The source connection where data originates
- **Pool**: A unified collection where data converges and conforms
- **Lens**: The specific view or query through which data is perceived

The metaphor captures how data flows from distinct sources into a shared space, then gets viewed through different perspectives - maintaining both technical precision and user-friendly abstraction.

The system's architecture reveals an elegant progression: Sources feed Streams, which then surface through Views. This creates a layered approach where data transforms from raw inputs to structured entities to rendered experiences.

The core insight is a three-layer model:
- ETL layer: Raw data sources
- Unification layer: Consolidated, schema-aligned streams
- Presentation layer: Contextual, filtered surfaces

Each layer adds semantic richness, progressively refining raw information into meaningful user experiences.

The critical innovation is the "Stream" concept - a unified, dynamic collection that aggregates diverse inputs while maintaining a consistent interface for querying and interaction. By treating disparate sources as a continuous, evolving entity, the system creates a flexible data representation that transcends individual communication platforms.

The taxonomy reveals three key abstraction layers: Sources capture raw data, Streams normalize and unify these inputs, and Surfaces present contextualized views tailored to different user needs. Each layer serves a distinct persona - from technical administrators to end users - while preserving the underlying data's integrity and accessibility.

The potential distinction between Stream definition and Stream instance introduces nuanced flexibility, allowing for both type-level schemas and specific, scoped data collections. This approach enables granular yet comprehensive data management across communication domains.

I'll draft a response for Michael that validates his core insight, proposes a lightweight hierarchical model, maps personas to data interactions, and probes critical implementation boundaries through targeted questions.That clarifies enormously. You've identified a key principle: **provenance is system-level; consumers see unified entities.**

The Contact Card example reveals a natural hierarchy:

```
Sources → Streams → Surfaces
(ETL)     (Data)    (Views)
```

**Sources** (system-level, hidden from consumers)
- Mail ETL, iMessage ETL, Slack ETL
- Persona: Admin/Engineer configures these
- Concern: Authentication, sync frequency, error handling

**Streams** (unified entity collections)
- "Messages" — regardless of whether they came from Mail, iMessage, or Slack
- "People" — regardless of Apple Contacts, LinkedIn, or manual entry
- Persona: Designer/Analyst sees schema here
- Concern: Conformant schema, entity resolution, deduplication

**Surfaces** (PAFV-projected views)
- Contact Card with Top 10 Messages
- Timeline of all communications
- Persona: Maker/Doer interacts here
- Concern: What LATCH filters? What GRAPH traversals?

The materialized view you mentioned ("Top 10 messages, refreshed on opening") lives at the **Stream→Surface** boundary. The query is against the unified Messages stream, not against "Mail messages + iMessage messages + Slack messages."

This also clarifies the "mixing" question: **CardBoard apps mix Streams, not Sources.** An app that shows "Contact + Recent Messages + Shared Documents" is joining three Streams (People, Messages, Documents) via GRAPH operations on a scoped entity.

Does this three-layer model (Sources → Streams → Surfaces) feel right? Or is there a fourth layer hiding—perhaps something about **Schemas** or **Entities** as distinct from Streams?
