---
type: execute
wave: 1
depends_on: []
files_modified: ["~/.zshrc", ".github/workflows/*", "~/.bash_profile"]
autonomous: true

must_haves:
  truths:
    - "Terminal.app opens with zsh as default shell"
    - "GitHub CI/CD pipeline is disabled"
    - "happy command executes with --dangerously-skip-permissions by default"
  artifacts:
    - path: "~/.zshrc"
      provides: "Shell configuration with happy alias"
      min_lines: 1
    - path: ".github/workflows/*"
      provides: "Disabled or removed CI workflows"
      contains: "# disabled"
  key_links:
    - from: "Terminal.app"
      to: "/bin/zsh"
      via: "default shell setting"
      pattern: "SHELL.*zsh"
---

<objective>
Fix three system administration issues: restore Terminal.app default shell to zsh, disable failing GitHub CI/CD pipeline, and create a happy CLI alias.

Purpose: Remove development friction from terminal usage, CI noise, and repetitive CLI flags
Output: Clean terminal environment with working shell and convenient aliases
</objective>

<execution_context>
@/Users/mshaler/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mshaler/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# System administration tasks unrelated to main Isometry project
# These are environmental fixes for development workflow
</context>

<tasks>

<task type="auto">
  <name>Fix Terminal.app default shell to zsh</name>
  <files>~/.zshrc, ~/.bash_profile</files>
  <action>
    Check current default shell with `echo $SHELL` and `dscl . -read /Users/$USER UserShell`.

    If not zsh:
    1. Run `chsh -s /bin/zsh` to change user's default shell
    2. Verify `/bin/zsh` exists and is in `/etc/shells`
    3. Create/update ~/.zshrc with basic configuration if missing
    4. Add export SHELL=/bin/zsh to ~/.zshrc as backup
    5. Test by opening new Terminal window and checking `echo $SHELL`

    Note: May require password for chsh command. If chsh fails due to permissions, guide user through System Preferences > Users & Groups > Advanced Options.
  </action>
  <verify>
    Open new Terminal window, run `echo $SHELL` - should return `/bin/zsh`
    Run `ps -p $$` - should show zsh process
  </verify>
  <done>Terminal.app opens with zsh as default shell, $SHELL variable shows /bin/zsh</done>
</task>

<task type="auto">
  <name>Disable GitHub CI/CD pipeline</name>
  <files>.github/workflows/*</files>
  <action>
    Find all GitHub Actions workflow files with `find .github/workflows -name "*.yml" -o -name "*.yaml"`.

    For each workflow file:
    1. Read the file to understand what CI/CD it runs
    2. Add `# DISABLED - failing pipeline` comment at top
    3. Comment out or remove the trigger events (on: push, on: pull_request, etc.)
    4. Alternatively, if user prefers complete removal, delete the workflow files

    Commit changes with descriptive message about disabling CI/CD.

    Note: This stops future workflow runs. Existing runs may need manual cancellation in GitHub UI.
  </action>
  <verify>
    Check `.github/workflows/` directory - files should be commented out or removed
    Run `git status` to confirm changes are staged
    No new workflow runs should trigger on next push
  </verify>
  <done>GitHub CI/CD workflows are disabled, no longer triggering on pushes</done>
</task>

<task type="auto">
  <name>Create happy CLI alias with skip permissions flag</name>
  <files>~/.zshrc</files>
  <action>
    Add alias to ~/.zshrc for the happy command with default flags:

    1. Open ~/.zshrc (create if doesn't exist)
    2. Add line: `alias happy='happy --dangerously-skip-permissions'`
    3. Add comment above alias explaining purpose
    4. Source ~/.zshrc or instruct user to restart terminal
    5. Test alias by running `which happy` and `happy --version` (if happy is installed)

    If happy command doesn't exist, note this in output but create alias anyway for when it's installed.
  </action>
  <verify>
    Run `source ~/.zshrc && alias | grep happy` - should show the alias
    Test `happy --help` to confirm it uses the skip permissions flag by default
  </verify>
  <done>happy command automatically executes with --dangerously-skip-permissions flag</done>
</task>

</tasks>

<verification>
1. Open new Terminal window - should start with zsh shell
2. Check GitHub repository - no CI/CD workflows triggering
3. Run `happy` command - should include skip permissions flag automatically
</verification>

<success_criteria>
- Terminal.app launches with zsh as default shell ($SHELL = /bin/zsh)
- GitHub CI/CD pipeline workflows are disabled or removed
- happy command alias works with --dangerously-skip-permissions flag by default
- All changes committed to git where appropriate
</success_criteria>

<output>
After completion, create `.planning/quick/001-three-fixes-terminal-shell-github-ci-cd-cl/001-SUMMARY.md`
</output>