---
title: "⚠️ Integration Gaps:"
id: 138432
created: 2025-12-07T17:57:00Z
modified: 2026-01-11T01:41:27Z
folder: "Learning/CardBoard"
attachments:
  - id: "0f8eebab-5bc7-430a-9555-0907c12a1e3c"
    type: "com.apple.notes.inlinetextattachment.hashtag"
    content: "<a class=\"tag link\" href=\"/tags/CardBoard\">#CardBoard</a>"
links: []
source: notes://showNote?identifier=0df4862b-71a0-456e-99fb-1b1dfb40d38a
---
**⚠️ Integration Gaps:**

**Two SuperGrid implementations** - supergrid.js (DOM-based) vs supergrid-d3.js (D3-based). Which is canonical?

> 

> I’m afraid neither are “canonical”.  I think that the version associated with commit f3320d4f is more complete (DOM-based?), but I think that subsequent versions are attempted to address the gaps (hard-coded styles, etc) with the D3-based version.  We made improvements, but broke what was working before.

> 

Underlying that lack of clarity is my lack of knowledge on how best to use git to manage branches and trees and merges, as well as the learning process of how best to use Claude Code.  We can chalk up our current challenge to “the branch not taken.”  I want to ensure we not only automate the mechanicals of write tests/build/launch/monitor/debug/test/document/commit but also I want to get better at using git instead of giving into the temptation to start from scratch.  Given the BIG architectural changes (well: forks) of PAFV and refactoring to pure D3.js for RenderEngine et al, I am tempted to rewrite the spec fully from the beginning. I’m certain of that exercise helping to clarify my thinking—do you recommend I revisit that keystone artifact?

The biggest frustration has been how hard it has been to get the backend wired up.  It’s frustrating that Apple has not embraced JavaScript frameworks such as D3.js and how difficult they make it to build across their various platforms without helpful alternative approaches. I am only able to build an app like CardBoard because of D3.js and Claude Code.

The biggest surprise on this part of the journey is how powerful D3.js, so anything we can do to reduce complexity on the backend will help us tenfold on the frontend.

**Data flow unclear**

Three paths exist:

Flask API → JSON → Browser (currently working in demo)

sql.js in-memory → D3.js (DataSyncCoordinator)

Native SQLite → Swift bridge → sql.js (planned)

> 

> I think we are looking to leverage 2 for now, but are planning on 3.  My question is this: given all the challenges of trying to make our data flow easier feels like its made everything harder.  Is this the best approach?

> 

**RenderEngine not connected to SuperGrid**

* The RenderEngine with ThemeRenderers exists but supergrid.js uses inline DOM manipulation with hardcoded styles

> 

> Yes, this is the gap created by transitioning from supergrid.js (or supergrid-modular.js) to supergrid-d3.js

> 

**Test status contradictions**

* VALIDATION_COMPLETE.md says "100% parser success" but CRITICAL_TEST_PRIORITIES.md shows many failing integration tests

> 

> Claude Code is consistently trying to put a bright face on test results.  I need to give clearer guidelines for what constitutes tests passing.

> 

**Questions for you:**

**Which SuperGrid is the source of truth?**

The DOM-based one in supergrid.js appears more complete but doesn't use the RenderEngine. The D3 version may be older.

> 

> I’m afraid neither are “canonical”.  I think that the version associated with commit f3320d4f is more complete (DOM-based?), but I think that subsequent versions are attempted to address the gaps (hard-coded styles, etc) with the D3-based version.  We made improvements, but broke what was working before.

> 

**What's the last known working demo configuration?**

Is it the Flask server + demo.html + browser approach?

> 

> I believe so.

> 

**Do you want to:**

(A) Integrate the existing RenderEngine/themes into the working SuperGrid?

(B) Build a new unified SuperGrid that uses the Canvas/Card architecture from the start?

(C) Keep them separate for now and focus on the sql.js read-only refactor first?

> 

> I think B is the best answer here, given the various out-of-sync issues we have here.

> 

**Dimension Navigator (DN)**

* I don't see a standalone DN component. Is it the axis/facet controls built into SuperGrid, or was there a separate implementation?

> 

> DN is the old term prior to our PAFV re-architecting for Axis Navigator.  Apologies for the terminology confusion.

> 

**Priority check**

: Given limited time, should we:

Focus on ETL → sql.js → D3.js data pipeline (backend stability)

Focus on SuperGrid → RenderEngine → Theme integration (frontend consistency)

Do a minimal "duct tape" integration to get everything talking?

> 

> 2 then 1 then 3?  Does that make sense from your perspective?

> 

[#CardBoard](/tags/CardBoard)

---

[Open in Notes](notes://showNote?identifier=0df4862b-71a0-456e-99fb-1b1dfb40d38a)