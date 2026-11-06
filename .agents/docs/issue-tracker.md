# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `htunnicliff/json-meta-client`.
Use the `gh` CLI from this repository.

## Conventions

- Verify the target with `gh repo view --json nameWithOwner` before
  creating the first issue of a session. Target this repository.
- Create: `gh issue create --title "..." --body-file <file>`.
  Use a temporary file for multiline bodies.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open --json number,title,body,labels`.
  Add label and state filters as needed.
- Comment: `gh issue comment <number> --body-file <file>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."`
  or `--remove-label "..."`. For triage states, first read
  [triage-labels.md](triage-labels.md).
- Close: post the explanation as a comment, then run
  `gh issue close <number>`. Post the comment separately even if the
  issue is already closed.

## Relationships

Use native GitHub sub-issues and blocking dependencies when supported.
If unavailable, put `Part of #<parent>` and `Blocked by: #<number>` at
the top of the child issue body, and list children in the parent.

For API operations, use numeric database issue IDs where required,
rather than issue numbers or node IDs.

A ticket is unblocked when every blocking requirement is satisfied or
explicitly removed. Check each blocker's resolution: closure as declined
or abandoned does not establish that its requirement was met. For a
superseded blocker, follow its replacement. Record any decision to remove
a requirement on the dependent issue and update the dependency relationship.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill operations

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the GitHub issue and its comments.

## Wayfinding

- Map: one issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Children: sub-issues labelled `wayfinder:<type>`, where type is
  research, prototype, grilling, or task.
- Frontier: open, unblocked children with no assignee;
  choose the first in map order.
- Claim: assign the ticket to the developer responsible for the work.
  Use `gh issue edit <number> --add-assignee @me` when that developer is
  the authenticated GitHub user; otherwise use their explicit GitHub login.
- Resolve: comment with the answer, close the ticket, then append
  a gist and link to the map's Decisions-so-far.
