# Claudegram

A Telegram bot that provides Claude Code capabilities, allowing conversation-based interaction with an Obsidian vault through Telegram.

## Features

- Chat with Claude through Telegram
- Claude has full access to your Obsidian vault (read, edit, create files)
- Multi-turn conversation support with session persistence
- Streaming responses
- Long message chunking for Telegram's 4096 character limit

## Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) installed and authenticated (OAuth or API key)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd claudegram
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Copy the example environment file and configure:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your values:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
   - `ANTHROPIC_API_KEY`: (Optional) Only needed if not using OAuth authentication
   - `OBSIDIAN_VAULT_PATH`: Full path to your Obsidian vault
   - `ALLOWED_USER_IDS`: (Optional) Comma-separated Telegram user IDs

   > **Note**: If you've already authenticated `claude` CLI with your Claude account (OAuth), you don't need to set `ANTHROPIC_API_KEY`.

## Usage

Start the bot:
```bash
bun run start
```

Or with watch mode for development:
```bash
bun run dev
```

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and instructions |
| `/reset` | Clear conversation history, start fresh |
| `/status` | Check bot and Claude connection status |

## Architecture

```
Telegram User <-> Claudegram Bot <-> Claude CLI <-> Obsidian Vault
```

The bot receives messages from Telegram, passes them to the Claude CLI running in your Obsidian vault directory, and streams the responses back.

## Security Notes

- The bot runs Claude with `--dangerously-skip-permissions` for autonomous operation
- Use `ALLOWED_USER_IDS` to restrict access to specific Telegram users
- Sessions are stored in-memory and reset on bot restart

## License

MIT
