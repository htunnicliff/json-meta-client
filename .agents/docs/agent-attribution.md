# Agent attribution

For any communication posted by an agent that isn't committed to the source
code, you must include a block quote at the beginning containing this pattern:

```md
<blockquote>
🤖 Written by {{model}}
</blockquote>
```

The `{{model}}` placeholder contains the current model identifier (e.g.
"gpt-6.1-sol-medium", "opus-5.5-high").

Optionally, if the harness in which the agent is running is known, this
pattern should be used:

```md
<blockquote>
🤖 Written by {{model}} via {{harness}}
</blockquote>
```

The `{{harness}}` placeholder contains a brief identifier for the harness
from which the agent is being executed (e.g. "Codex CLI", "Claude Web UI").

If attribution is being added after the fact and one or more placeholders
are not known, adapt the message accordingly (e.g. "🤖 Written by agent").
