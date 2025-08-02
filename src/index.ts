import { Client, Collection, GatewayIntentBits, Events, ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { config } from 'dotenv'
import { GameClubDatabase } from './database'
import * as cron from 'node-cron'
import path from 'path'
import fs from 'fs'

// Load environment variables
config()

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
})

// Initialize database
const db = new GameClubDatabase()

// Create a collection to store commands
interface Command {
	data: any
	execute: (interaction: ChatInputCommandInteraction, db: GameClubDatabase) => Promise<void>
}

const commands = new Collection<string, Command>()

// Load commands
const commandsPath = path.join(__dirname, 'commands')
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'))

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file)
	const command = require(filePath)

	if ('data' in command && 'execute' in command) {
		commands.set(command.data.name, command)
		console.log(`✅ Loaded command: ${command.data.name}`)
	} else {
		console.log(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`)
	}
}

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
	console.log(`🤖 Ready! Logged in as ${readyClient.user.tag}`)
	console.log(`📊 Loaded ${commands.size} commands`)

	// Set bot status
	client.user?.setActivity('Game Book Club | /current-game', { type: 0 })
})

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
	if (!interaction.isChatInputCommand()) return

	const command = commands.get(interaction.commandName)

	if (!command) {
		console.error(`❌ No command matching ${interaction.commandName} was found.`)
		return
	}

	try {
		await command.execute(interaction, db)
		console.log(`✅ ${interaction.user.tag} executed /${interaction.commandName}`)
	} catch (error) {
		console.error(`❌ Error executing ${interaction.commandName}:`, error)

		const errorMessage = {
			content: 'There was an error while executing this command!',
			ephemeral: true,
		}

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(errorMessage)
		} else {
			await interaction.reply(errorMessage)
		}
	}
})

// Scheduled notifications
function setupScheduledTasks() {
	// Run on the 1st of every month at 9:00 AM
	cron.schedule('0 9 1 * *', async () => {
		console.log('🗓️ Monthly notification triggered')
		await sendMonthlyNotifications()
	})

	// Run weekly on Sundays at 10:00 AM to remind about upcoming deadlines
	cron.schedule('0 10 * * 0', async () => {
		console.log('📅 Weekly reminder triggered')
		await sendWeeklyReminders()
	})

	// Run daily at 12:00 PM to check for auto-nominations (when 7 days left in month)
	cron.schedule('0 12 * * *', async () => {
		console.log('🤖 Auto-nomination check triggered')
		await checkAutoNomination()
	})

	// Run on the 25th of every month to remind about next month
	cron.schedule('0 10 25 * *', async () => {
		console.log('🔔 Next month reminder triggered')
		await sendNextMonthReminder()
	})

	console.log('⏰ Scheduled tasks set up successfully')
}

async function sendMonthlyNotifications() {
	try {
		const guilds = client.guilds.cache
		const currentGame = db.getCurrentMonthGame()

		for (const [_, guild] of guilds) {
			// Find a general channel to send notifications
			const channel = guild.channels.cache.find((ch) => ch.isTextBased() && ch.name === 'gamin')

			if (!channel || !channel.isTextBased()) continue

			if (currentGame) {
				await channel.send({
					content: `🎉 **NEW MONTH, NEW GAME!** 🎉\n\nIt's time to start playing **${currentGame.game_name}** selected by <@${currentGame.picker_id}>!\n\nShare your thoughts, screenshots, and experiences as you play! 🎮`,
				})
			} else {
				await channel.send({
					content: `📅 **NEW MONTH!** 📅\n\nNo game has been selected for this month yet. Admins, use \`/nominate-picker\` to get things started! 🎯`,
				})
			}
		}
	} catch (error) {
		console.error('Error sending monthly notifications:', error)
	}
}

async function sendWeeklyReminders() {
	try {
		const guilds = client.guilds.cache
		const now = new Date()
		const currentMonth = now.toISOString().slice(0, 7)
		const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()

		// Only send if we're in the last week of the month
		if (daysLeft > 7) return

		const currentGame = db.getCurrentMonthGame()
		const nomination = db.getActiveNominationForMonth(currentMonth)

		for (const [_, guild] of guilds) {
			const channel = guild.channels.cache.find((ch) => ch.isTextBased() && ch.name === 'gamin')

			if (!channel || !channel.isTextBased()) continue

			if (currentGame) {
				await channel.send({
					content: `⏰ **WEEK ${daysLeft <= 3 ? 'ENDING' : 'LEFT'} REMINDER** ⏰\n\nOnly ${daysLeft} days left to enjoy **${currentGame.game_name}**! Share your final thoughts and prepare for next month's selection! 🎮`,
				})
			} else if (nomination) {
				await channel.send({
					content: `🚨 **URGENT REMINDER** 🚨\n\n<@${nomination.nominated_user_id}>, you still need to select this month's game! Only ${daysLeft} days left in the month. Use \`/select-game\` now! ⏱️`,
				})
			}
		}
	} catch (error) {
		console.error('Error sending weekly reminders:', error)
	}
}

async function sendNextMonthReminder() {
	try {
		const guilds = client.guilds.cache
		const nextMonth = new Date()
		nextMonth.setMonth(nextMonth.getMonth() + 1)
		const nextMonthStr = nextMonth.toISOString().slice(0, 7)
		const nextMonthName = nextMonth.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
		})

		const nextGame = db.getGameByMonth(nextMonthStr)
		const nomination = db.getActiveNominationForMonth(nextMonthStr)

		for (const [_, guild] of guilds) {
			const channel = guild.channels.cache.find((ch) => ch.isTextBased() && ch.name === 'gamin')

			if (!channel || !channel.isTextBased()) continue

			if (nextGame) {
				await channel.send({
					content: `🎯 **NEXT MONTH READY!** 🎯\n\n**${nextGame.game_name}** is already selected for ${nextMonthName} by <@${nextGame.picker_id}>! Get ready! 🎮`,
				})
			} else if (nomination) {
				await channel.send({
					content: `⏳ **NEXT MONTH PENDING** ⏳\n\n<@${nomination.nominated_user_id}> is nominated to pick for ${nextMonthName} but hasn't selected yet. Don't forget to use \`/select-game\`! 🎯`,
				})
			} else {
				await channel.send({
					content: `📋 **NEXT MONTH PLANNING** 📋\n\nNo one is nominated for ${nextMonthName} yet. Admins, consider using \`/nominate-picker\` to keep the rotation going! 🔄`,
				})
			}
		}
	} catch (error) {
		console.error('Error sending next month reminders:', error)
	}
}

async function checkAutoNomination() {
	try {
		const guilds = client.guilds.cache
		const now = new Date()
		const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()

		// Only auto-nominate when exactly 7 days left in the month
		if (daysLeft !== 7) return

		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1)
		const nextMonthStr = nextMonth.toISOString().slice(0, 7)
		const nextMonthName = nextMonth.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
		})

		// Check if someone is already nominated for next month
		const existingNomination = db.getActiveNominationForMonth(nextMonthStr)
		if (existingNomination) {
			console.log(`🤖 Next month already has nomination: ${existingNomination.nominated_username}`)
			return
		}

		// Check if game already selected for next month
		const existingGame = db.getGameByMonth(nextMonthStr)
		if (existingGame) {
			console.log(`🤖 Next month already has game selected: ${existingGame.game_name}`)
			return
		}

		for (const [_, guild] of guilds) {
			// Get all guild members (not just those in our rotation database)
			const members = await guild.members.fetch()

			// Exclude bots, the specific user ID, and last 2 pickers
			const recentPickers = db
				.getAllGames()
				.slice(0, 2)
				.map((game) => game.picker_id)
			const excludedUserIds = ['1085028125336948898', ...recentPickers]

			const eligibleMembers = members.filter((member) => !member.user.bot && !excludedUserIds.includes(member.user.id))

			if (eligibleMembers.size === 0) {
				console.log('🤖 No eligible members found for auto-nomination')
				continue
			}

			// Randomly select a member
			const membersArray = Array.from(eligibleMembers.values())
			const randomMember = membersArray[Math.floor(Math.random() * membersArray.length)]
			const username = randomMember.displayName || randomMember.user.username

			// Add to member rotation if not already there
			if (!db.getMemberByUserId(randomMember.user.id)) {
				db.addMember(randomMember.user.id, username)
			}

			// Create nomination
			db.addNomination(randomMember.user.id, username, nextMonthStr)

			// Send notification to channel
			const channel = guild.channels.cache.find((ch) => ch.isTextBased() && ch.name === 'gamin')

			if (channel && channel.isTextBased()) {
				await channel.send({
					content: `🤖 **AUTO-NOMINATION!** 🤖\n\nWith 7 days left in the month, I've randomly selected <@${randomMember.user.id}> to pick the game for **${nextMonthName}**!\n\n<@${randomMember.user.id}>, use \`/select-game\` to choose your game! 🎮`,
				})

				// Try to send DM to nominated user
				try {
					await randomMember.user.send({
						content: `🤖 **You've Been Auto-Nominated!** 🤖\n\nYou've been randomly selected to pick the game for **${nextMonthName}** in the Game Book Club!\n\nUse the \`/select-game\` command in the server to choose your game. Take your time and pick something you think everyone will enjoy! 🎮`,
					})
				} catch (error) {
					console.log('Could not send DM to auto-nominated user:', error)
				}

				console.log(`🤖 Auto-nominated ${username} for ${nextMonthName}`)
			}
		}
	} catch (error) {
		console.error('Error in auto-nomination:', error)
	}
}

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('🛑 Shutting down gracefully...')
	db.close()
	client.destroy()
	process.exit(0)
})

process.on('SIGTERM', () => {
	console.log('🛑 Shutting down gracefully...')
	db.close()
	client.destroy()
	process.exit(0)
})

// Setup scheduled tasks after client is ready
client.once(Events.ClientReady, () => {
	setupScheduledTasks()
})

// Login to Discord
const token = process.env.DISCORD_TOKEN
if (!token) {
	console.error('❌ DISCORD_TOKEN is not set in environment variables!')
	process.exit(1)
}

client.login(token).catch((error) => {
	console.error('❌ Failed to login:', error)
	process.exit(1)
})
