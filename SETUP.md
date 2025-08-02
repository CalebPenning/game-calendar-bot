# Discord Game Club Bot - Setup Guide

## 🎮 Overview

This bot manages your Discord server's monthly game book club, handling member rotation, game selection, and automated notifications.

## 📋 Prerequisites

- Node.js 18+ installed
- A Discord application/bot token
- Basic knowledge of Discord bot setup

## 🚀 Getting Started

### Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and create a bot
4. Copy the bot token (you'll need this later)
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent (if you want member-specific features)
   - Message Content Intent (for message handling)

### Step 2: Invite Bot to Your Server

1. Go to the "OAuth2" > "URL Generator" tab
2. Select scopes: `bot` and `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
   - Manage Messages (for admin commands)
4. Copy the generated URL and visit it to invite the bot

### Step 3: Setup Project

1. Clone/download this project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Fill in your `.env` file:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_client_id
   GUILD_ID=your_server_id_for_testing
   ```

### Step 4: Deploy Commands

Deploy slash commands to Discord:

```bash
npm run deploy
```

### Step 5: Start the Bot

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

## 📱 Commands

### User Commands
- `/current-game` - View the current month's selected game
- `/select-game <game>` - Select a game (only if you're nominated)
- `/game-history [limit]` - View past games and pickers
- `/game-calendar [months]` - View upcoming months and their status

### Admin Commands
- `/nominate-picker <user> [month]` - Nominate a member to pick next game

## 🤖 Automated Features

The bot automatically:
- **Monthly notifications** (1st of each month at 9:00 AM)
- **Weekly reminders** (Sundays at 10:00 AM during last week)
- **Next month reminders** (25th of each month at 10:00 AM)
- **Member rotation tracking** (excludes last 2 pickers)

## 🗃️ Database

The bot uses SQLite to store:
- Game selections and history
- Member rotation data
- Active nominations

Database file: `gameclub.db` (created automatically)

## 🔧 Customization

### Notification Channels
The bot looks for channels containing these keywords (in order):
- "game"
- "club" 
- "general"

### Cron Schedules
Edit `src/index.ts` to modify notification timing:
```typescript
// Monthly: '0 9 1 * *' = 1st day, 9:00 AM
// Weekly: '0 10 * * 0' = Sunday, 10:00 AM  
// Reminder: '0 10 25 * *' = 25th day, 10:00 AM
```

## 🚀 Hosting Options

### Free/Low-Cost Options:
1. **Railway** (Recommended)
   - Free tier available
   - Great for Discord bots
   - Easy deployment from GitHub

2. **Render**
   - Free tier with some limitations
   - Automatic deployments

3. **Heroku**
   - Free tier (limited hours)
   - Easy setup

### Self-Hosting:
- VPS (DigitalOcean, Linode, etc.)
- Raspberry Pi
- Your own server

## 🔄 Workflow Example

1. **Admin** uses `/nominate-picker @user` to nominate someone
2. **Nominated user** gets notified and uses `/select-game <game name>`
3. **Bot** announces the selection to the server
4. **Bot** sends monthly reminders and notifications automatically
5. **Members** can use `/current-game` to check what they should be playing

## 🛠️ Troubleshooting

### Bot not responding to commands:
- Check bot permissions in your server
- Ensure commands are deployed: `npm run deploy`
- Check console for error messages

### Database errors:
- Ensure write permissions in bot directory
- Check if `gameclub.db` file exists and is accessible

### Notifications not working:
- Bot needs permission to send messages in target channels
- Check if channels exist with expected names

## 🤝 Contributing

Feel free to customize this bot for your needs! Some ideas:
- Add game review/rating system
- Integration with gaming platforms (Steam, etc.)
- Voting system for game selection
- More detailed statistics and analytics

## 📄 License

MIT License - feel free to use and modify!
