# Discord Game Club Bot

A Discord bot for managing monthly game book club selections and rotations.

## Features

- 📅 Monthly game selection rotation
- 🎮 Game nomination and selection process
- 📊 Visual calendar display
- 🔔 Automated notifications
- ⚡ Slash commands for easy interaction

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your Discord bot token
4. Build the project: `npm run build`
5. Deploy slash commands: `npm run deploy`
6. Start the bot: `npm start`

## Development

- `npm run dev` - Start in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run deploy` - Deploy slash commands to Discord

## Commands

- `/current-game` - View the current month's game
- `/upcoming-game` - View next month's game (if selected)
- `/nominate-picker` - Admin command to nominate next game picker
- `/select-game` - Command for nominated user to select a game
- `/game-history` - View past games and pickers
- `/game-calendar` - View upcoming months calendar

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application client ID
- `GUILD_ID` - Your Discord server ID (for guild-specific commands)
