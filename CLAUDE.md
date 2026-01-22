# Claudegram

A self-developing Telegram bot that wraps Claude Code capabilities, enabling incremental autonomous development through PR-based workflows with human review.

## Vision

Claudegram is an autonomous agent that:
1. **Wraps Claude Code** - Full access to Claude Code capabilities via Telegram interface
2. **Self-develops** - Adds skills, agents, commands, rules, hooks, and MCP configs through conversation
3. **Human-in-the-loop** - All self-modifications go through branches and PRs for review
4. **Multi-workspace** - Operates on its own codebase, Obsidian vaults, and other filesystems
5. **Incrementally grows** - Continuously expands capabilities while maintaining structure

## Architecture

### Layer Separation

```
┌─────────────────────────────────────────────────────────────┐
│                    Telegram Interface                        │
│  (Bot commands, menus, inline keyboards, message handling)   │
├─────────────────────────────────────────────────────────────┤
│                   Bot Core / Orchestration                   │
│    (Session management, routing, capability discovery)       │
├─────────────────────────────────────────────────────────────┤
│                  Claude Code Abstraction                     │
│  (CLI wrapper, streaming, conversation management, tools)    │
├─────────────────────────────────────────────────────────────┤
│                  Self-Development Engine                     │
│   (Git workflows, PR management, capability installation)    │
├─────────────────────────────────────────────────────────────┤
│                    Claude Code Features                      │
│  (Skills, Agents, Commands, Rules, Hooks, MCP Configs)       │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
claudegram/                    # Bot project root (git repo)
├── src/
│   ├── index.ts              # Entry point
│   ├── telegram/             # Telegram interface layer
│   │   ├── bot.ts            # grammY bot setup
│   │   ├── handlers/         # Message and command handlers
│   │   ├── menus.ts          # Interactive menus and keyboards
│   │   └── commands.ts       # Bot command definitions
│   ├── claude/               # Claude Code abstraction layer
│   │   ├── cli.ts            # CLI wrapper with streaming
│   │   ├── session.ts        # Conversation/session management
│   │   └── tools.ts          # Tool result parsing and handling
│   ├── development/          # Self-development engine
│   │   ├── git.ts            # Branch/PR management
│   │   ├── installer.ts      # Skill/agent/hook installation
│   │   └── reload.ts         # Hot reload and PR merge detection
│   └── config.ts             # Environment configuration
├── .claude/                   # Project-level Claude Code config
│   ├── commands/             # Project-specific slash commands
│   ├── agents/               # Project-specific agents
│   └── settings.json         # Project settings
└── CLAUDE.md                 # This file
```

### External Claude Code Features

User-level configurations that extend capabilities:
```
~/.claude/
├── commands/                 # User slash commands (skills)
├── agents/                   # User agents
├── settings.json            # User settings, MCP configs
└── hooks/                   # Event hooks (if supported)
```

## Core Concepts

### 1. Claude Code Wrapping

The bot provides full Claude Code capabilities through Telegram:
- **Conversations**: Multi-turn conversations with session persistence
- **Tools**: File operations, web search, code execution via Claude's toolset
- **Context**: Access to configured directories and MCP servers
- **Streaming**: Real-time response streaming to Telegram

### 2. Self-Development Workflow

When developing new capabilities through chat:

1. **Request**: User describes desired capability in Telegram
2. **Branch**: Bot creates feature branch (`feature/capability-name`)
3. **Implement**: Claude modifies code, adds skills/agents/hooks
4. **PR**: Bot creates pull request with description
5. **Review**: Human reviews PR on GitHub
6. **Merge**: Upon merge, bot detects and reloads itself

### 3. Capability Types

| Type | Location | Purpose | User-Invokable? |
|------|----------|---------|-----------------|
| **Commands** | `.claude/commands/` | Slash commands users can invoke | Yes (`/command`) |
| **Agents** | `.claude/agents/` | Context for Claude on specific tasks | No (Claude uses internally) |
| **Core Commands** | Bot code (`src/telegram/handlers/`) | Native Telegram bot commands | Yes (`/start`, `/develop`, etc.) |
| **Rules** | `.claude/settings.json` | Behavioral constraints | No |
| **Hooks** | `.claude/hooks/` | Event-triggered actions | No |
| **MCP Configs** | `.claude/settings.local.json` | External tool integrations | No |

### 4. Code + Awareness Sync (Critical)

**Every code change MUST include corresponding awareness updates.**

Claudegram maintains self-awareness through skill and agent definitions. When modifying capabilities:

| Code Change | Required Awareness Update |
|-------------|--------------------------|
| New Telegram command | Add to `CORE_COMMANDS` in `src/telegram/commands.ts` AND create `.claude/commands/<name>.md` |
| New skill | Create `.claude/commands/<name>.md` |
| New agent | Create `.claude/agents/<name>.md` |
| New handler | Update this file's architecture section |
| New MCP | Update MCP Integrations table below |
| Behavior change | Update relevant skill/agent description |

This ensures Claude always knows what Claudegram can do when developing itself.

### 5. Multi-Workspace Operation

The bot operates across multiple directories:

| Workspace | Purpose | Access Mode |
|-----------|---------|-------------|
| `claudegram/` | Bot source code | Read/Write (via PR) |
| `$OBSIDIAN_VAULT_PATH` | Daily notes, life management | Read/Write |
| Additional paths | As configured | Configurable |

## Telegram Interface

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot, show capabilities |
| `/help` | Show available commands and features |
| `/menu` | Interactive capability menu |
| `/status` | Current session and bot status |
| `/restart` | Restart bot (after code changes) |
| `/capabilities` | List installed skills, agents, MCPs |
| `/develop` | Enter self-development mode |
| `/pr` | Show pending PRs for review |

### Interactive Menus

The bot exposes capabilities through inline keyboards:
- **Main Menu**: Quick access to common actions
- **Capabilities Browser**: Explore and invoke skills/agents
- **Development Menu**: Self-modification options
- **Settings**: Configure bot behavior

### Capability Communication

When new capabilities are added, the bot:
1. Updates its command list with BotFather
2. Announces new capability to user
3. Adds to interactive menus
4. Documents in `/capabilities` output

## Current Capabilities

This section is the source of truth for what Claudegram can do. **Keep this updated when adding capabilities.**

### Commands (`.claude/commands/`) - User-Invokable

Users can directly invoke these via `/command` in Telegram:

| Command | Description | Handler |
|---------|-------------|---------|
| `/note` | Quick capture to Obsidian inbox | Native (`src/telegram/handlers/notes.ts`) |
| `/schedule` | Schedule events from notes or natural language | Claude + Google Calendar MCP |
| `/daily` | View or interact with today's daily note | Claude |
| `/search` | Search across vault and codebase | Claude |

### Agents (`.claude/agents/`) - Claude's Context

Agents are NOT directly invokable by users. They provide context and instructions for Claude when handling specific types of tasks:

| Agent | Purpose | When Claude uses it |
|-------|---------|---------------------|
| `develop` | Self-development with code+awareness sync | When user asks to add/modify capabilities |
| `mcp-manager` | MCP server discovery and configuration | When user asks about MCP/integrations |
| `code-reviewer` | Review code changes and PRs | When reviewing code or PRs |

Claude should read the relevant agent file for detailed instructions when performing these tasks.

### Core Bot Commands

These are handled natively by Telegram handlers (not Claude):

| Command | Handler | Description |
|---------|---------|-------------|
| `/start` | `core.ts` | Welcome message |
| `/reset` | `core.ts` | Clear conversation |
| `/restart` | `core.ts` | Restart bot |
| `/status` | `core.ts` | Bot status |
| `/menu` | `development.ts` | Interactive menu |
| `/skills` | `skills.ts` | Browse skills |
| `/mcp` | `mcp.ts` | MCP management |
| `/capabilities` | `development.ts` | List all capabilities |
| `/develop` | `development.ts` | Self-development mode |
| `/pr` | `development.ts` | Pending PRs |

## Development Guidelines

### Adding New Capabilities

When asked to add capabilities through chat:

1. **Determine type**: Is it a skill, agent, hook, or bot feature?
2. **Create branch**: `git checkout -b feature/description`
3. **Implement + Document** (BOTH required):
   - Skills → Create `.claude/commands/skill-name.md`
   - Agents → Create `.claude/agents/agent-name.md`
   - Bot features → Code in `src/` AND create corresponding skill/update CLAUDE.md
4. **Update Capability Manifest**: Update "Current Capabilities" section in this file
5. **Test**: Verify functionality works
6. **PR**: Create PR with clear description
7. **Wait**: Do not merge - human reviews

**Critical**: Never commit code without its awareness counterpart. The `develop` agent enforces this.

### Code Modification Rules

- **Never push to main directly** - Always use PRs
- **Code + Awareness sync** - Every code change needs awareness update
- **Small, focused changes** - One capability per PR
- **Clear descriptions** - PR describes what and why
- **Backwards compatible** - Don't break existing features
- **Update menus** - Expose new capabilities to user
- **Update CLAUDE.md** - Keep Current Capabilities section accurate

### PR Auto-Reload

The bot monitors for merged PRs:
1. Polls GitHub API or watches for webhook
2. Detects merge to main branch
3. Pulls latest changes
4. Gracefully restarts

## Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=         # From @BotFather
ANTHROPIC_API_KEY=          # Anthropic API key

# Workspaces
OBSIDIAN_VAULT_PATH=        # Primary vault for notes/life management
ADDITIONAL_PATHS=           # Comma-separated additional paths

# Access Control
ALLOWED_USER_IDS=           # Comma-separated Telegram user IDs

# Development
GITHUB_TOKEN=               # For PR creation and monitoring
GITHUB_REPO=                # owner/repo format

# Logging
LOG_LEVEL=                  # debug|info|warn|error|none
```

## MCP Integrations

Configured via Claude Code's MCP system:

```bash
claude mcp add --scope user [name] -- [command]
claude mcp list
```

### Current Integrations

| MCP | Purpose | Status |
|-----|---------|--------|
| Google Calendar | Schedule events from notes | Active |
| Linear | Issue tracking and project management | Planned |
| Obsidian | Direct vault manipulation | Planned |

### Adding New MCPs

Through chat: "Add MCP for [service]" triggers:
1. Research available MCP servers
2. Configure via `claude mcp add`
3. Update this documentation
4. Announce capability in Telegram

## Runtime

- **Runtime**: Bun (use `bun` instead of `node`)
- **Bot Framework**: grammY
- **Claude Integration**: Claude Code CLI subprocess

### Commands

```bash
bun run start      # Run the bot
bun run dev        # Run with watch mode
bun run daemon     # Run with auto-restart on exit
```

### Auto-Restart Flow

```
run.sh (loop)
    └── bun run src/index.ts
            ├── Normal operation
            ├── /restart command → exit(0) → restart
            └── PR merged → pull → exit(0) → restart
```

## Logging

### Levels
- `debug` - Verbose development logging
- `info` - Standard operation (default)
- `warn` - Warnings and errors
- `error` - Errors only
- `none` - Silent

### Component Loggers
- `claudegram` - Main application
- `telegram` - Bot events and handlers
- `claude` - CLI interactions
- `session` - Session management
- `development` - Git and PR operations
- `skills` - Skill discovery and execution

## Security Considerations

- **User allowlist**: Only configured users can interact
- **PR review gate**: All code changes require human approval
- **Workspace isolation**: Clear boundaries between workspaces
- **No direct main pushes**: Branch protection enforced
- **Audit trail**: All changes tracked via git history

## Future Roadmap

- [ ] Webhook-based PR detection (vs polling)
- [ ] Multi-user session isolation
- [ ] Capability marketplace (share skills/agents)
- [ ] Voice message support
- [ ] Scheduled autonomous tasks
- [ ] Memory/context persistence across restarts
