---
name: iso:execute-phase
description: Execute all plans in Isometry phase with wave-based parallelization
argument-hint: "<phase-number>"
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in docs/plans/ tagged with specified phase using wave-based parallel execution. Each executor agent gets a fresh 200k context to prevent context degradation.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS

@docs/STATE.md
@docs/ROADMAP.md
</context>

<process>

## 1. Validate Phase and Discover Plans

```bash
PHASE=$ARGUMENTS

# Find all plan files for this phase
PLANS=$(grep -l "^phase: ${PHASE}$" docs/plans/*.md 2>/dev/null)

if [ -z "$PLANS" ]; then
  echo "❌ No plans found for Phase ${PHASE}"
  echo ""
  echo "Did you run: /iso:plan-phase ${PHASE} ?"
  exit 1
fi

echo "📋 Found plans for Phase ${PHASE}:"
echo "$PLANS" | sed 's|docs/plans/||g'
```

## 2. Group Plans by Wave

Read wave number from each plan's frontmatter:

```bash
for plan in $PLANS; do
  WAVE=$(grep "^wave:" "$plan" | head -1 | awk '{print $2}')
  echo "  $plan → Wave $WAVE"
done
```

Group into waves 1, 2, 3.

## 3. Execute Waves Sequentially

For each wave (1 → 2 → 3):

### 3.1 Identify Wave Plans

```bash
WAVE_PLANS=$(for plan in $PLANS; do
  W=$(grep "^wave: ${WAVE}$" "$plan")
  if [ -n "$W" ]; then
    echo "$plan"
  fi
done)
```

### 3.2 Check for Existing SUMMARYs

```bash
for plan in $WAVE_PLANS; do
  if grep -q "## Completion Summary" "$plan"; then
    echo "  ✅ $plan (already complete)"
  else
    echo "  🔄 $plan (needs execution)"
  fi
done
```

### 3.3 Spawn Executor Agents (Parallel)

For each incomplete plan in the wave, spawn a `gsd-executor` agent:

```
Task(
  subagent_type="gsd-executor",
  description="Execute plan: $(basename $plan)",
  prompt="""
  Execute this plan for Isometry Phase ${PHASE}:

  @${plan}
  @docs/STATE.md
  @docs/PROJECT.md
  @docs/REQUIREMENTS.md

  For each implementation step:
  1. Read the affected files
  2. Make the changes
  3. Test the changes
  4. Commit atomically with message: feat(phase-${PHASE}): <step description>

  After all steps complete:
  1. Add ## Completion Summary section to the plan
  2. Fill in: Completed date, commit hashes, issues found, lessons learned
  3. Save the plan file

  Use atomic commits. Each step gets its own commit immediately after completion.
  """
)
```

**IMPORTANT:** Spawn all agents in the wave in PARALLEL (single message, multiple Task calls).

### 3.4 Wait for Wave Completion

Task tool blocks until agents complete. Once all return, proceed to next wave.

### 3.5 Verify Wave Completion

```bash
for plan in $WAVE_PLANS; do
  if ! grep -q "## Completion Summary" "$plan"; then
    echo "⚠️  Warning: $plan missing completion summary"
  fi
done
```

## 4. Update STATE.md

After all waves complete:

```bash
# Update docs/STATE.md
# Mark phase work as in-progress
# Add completed plans to "Active Work"
# Record any lessons learned from plan SUMMARYs
```

## 5. Commit Planning Docs

```bash
git add docs/
git commit -m "docs(phase-${PHASE}): execution complete"
```

## 6. Summary Report

```
✅ Phase ${PHASE} execution complete!

Waves executed: 3
Plans completed: 5
Total commits: 23

Next steps:
  /iso:verify-phase ${PHASE}  - Verify all requirements met
  /iso:sync-state            - Update STATE.md
```

</process>

<notes>
- Each wave executes in parallel (multiple Task calls in single message)
- Waves execute sequentially (Wave 2 waits for Wave 1)
- Each executor gets fresh 200k context
- Atomic commits after each implementation step
- Orchestrator stays lean (~15% context usage)
</notes>
