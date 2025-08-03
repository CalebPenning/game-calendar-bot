import { Client, Collection, GatewayIntentBits, Events, ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { config } from 'dotenv'
import { GameClubDatabase } from './database'
import * as cron from 'node-cron'
import path from 'path'
import fs from 'fs'
import { CONFIG, ENVIRONMENT } from './config'
import { getCurrentMonth, getNextMonth, formatMonthYear, isDaysBeforeMonthEnd, getDaysLeftInMonth } from './utils/date'
import {
	findGameChannel,
	getEligibleMembersForAutoNomination,
	selectRandomMember,
	getDisplayName,
	sendDirectMessage,
} from './utils/discord'

config()

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
})

const db = new GameClubDatabase()

interface Command {
	data: any
	execute: (interaction: ChatInputCommandInteraction, db: GameClubDatabase) => Promise<void>
}

const commands = new Collection<string, Command>()

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

client.once(Events.ClientReady, (readyClient) => {
	console.log(`🤖 Ready! Logged in as ${readyClient.user.tag}`)
	console.log(`📊 Loaded ${commands.size} commands`)

	client.user?.setActivity('Game Book Club | /current-game', { type: 0 })
})

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

function setupScheduledTasks() {
	cron.schedule(CONFIG.SCHEDULING.MONTHLY_NOTIFICATIONS, async () => {
		console.log('🗓️ Monthly notification triggered')
		await sendMonthlyNotifications()
	})

	cron.schedule(CONFIG.SCHEDULING.WEEKLY_REMINDERS, async () => {
		console.log('📅 Weekly reminder triggered')
		await sendWeeklyReminders()
	})

	cron.schedule(CONFIG.SCHEDULING.AUTO_NOMINATION_CHECK, async () => {
		console.log('🤖 Auto-nomination check triggered')
		await checkAutoNomination()
	})

	cron.schedule(CONFIG.SCHEDULING.NEXT_MONTH_REMINDER, async () => {
		console.log('🔔 Next month reminder triggered')
		await sendNextMonthReminder()
	})

	console.log('⏰ Scheduled tasks set up successfully')
}

async function sendMonthlyNotifications() {
	try {
		const guilds = client.guilds.cache
		const currentGame = await db.getCurrentMonthGame()

		for (const [_, guild] of guilds) {
			const channel = findGameChannel(guild)
			if (!channel) continue

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
		const currentMonth = getCurrentMonth()
		const daysLeft = getDaysLeftInMonth()

		if (daysLeft > 7) return

		const currentGame = await db.getCurrentMonthGame()
		const nomination = await db.getActiveNominationForMonth(currentMonth)

		for (const [_, guild] of guilds) {
			const channel = findGameChannel(guild)
			if (!channel) continue

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

		const nextGame = await db.getGameByMonth(nextMonthStr)
		const nomination = await db.getActiveNominationForMonth(nextMonthStr)

		for (const [_, guild] of guilds) {
			const channel = findGameChannel(guild)
			if (!channel) continue

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
		if (!isDaysBeforeMonthEnd(CONFIG.AUTO_NOMINATION.DAYS_BEFORE_MONTH_END)) return

		const nextMonthStr = getNextMonth()
		const nextMonthName = formatMonthYear(nextMonthStr)

		const existingNomination = await db.getActiveNominationForMonth(nextMonthStr)
		if (existingNomination) {
			console.log(`🤖 Next month already has nomination: ${existingNomination.nominated_username}`)
			return
		}

		const existingGame = await db.getGameByMonth(nextMonthStr)
		if (existingGame) {
			console.log(`🤖 Next month already has game selected: ${existingGame.game_name}`)
			return
		}

		for (const [_, guild] of guilds) {
			const members = await guild.members.fetch()

			const recentPickers = (await db.getAllGames())
				.slice(0, CONFIG.AUTO_NOMINATION.RECENT_PICKER_EXCLUSION_COUNT)
				.map((game) => game.picker_id)
				.filter((id): id is string => !!id)

			const eligibleMembersArray = getEligibleMembersForAutoNomination(members, recentPickers)

			if (eligibleMembersArray.length === 0) {
				console.log('🤖 No eligible members found for auto-nomination')
				continue
			}

			const randomMember = selectRandomMember(eligibleMembersArray)
			if (!randomMember) continue

			const username = getDisplayName(randomMember)

			if (!(await db.getMemberByUserId(randomMember.user.id))) {
				await db.addMember(randomMember.user.id, username)
			}

			await db.addNomination(randomMember.user.id, username, nextMonthStr)

			const channel = findGameChannel(guild)

			if (channel) {
				await channel.send({
					content: `🤖 **AUTO-NOMINATION!** 🤖\n\nWith ${CONFIG.AUTO_NOMINATION.DAYS_BEFORE_MONTH_END} days left in the month, I've randomly selected <@${randomMember.user.id}> to pick the game for **${nextMonthName}**!\n\n<@${randomMember.user.id}>, use \`/select-game\` to choose your game! 🎮`,
				})

				await sendDirectMessage(
					randomMember,
					`🤖 **You've Been Auto-Nominated!** 🤖\n\nYou've been randomly selected to pick the game for **${nextMonthName}** in the Game Book Club!\n\nUse the \`/select-game\` command in the server to choose your game. Take your time and pick something you think everyone will enjoy! 🎮`,
				)

				console.log(`🤖 Auto-nominated ${username} for ${nextMonthName}`)
			}
		}
	} catch (error) {
		console.error('Error in auto-nomination:', error)
	}
}

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

client.once(Events.ClientReady, () => {
	setupScheduledTasks()
})

const token = ENVIRONMENT.DISCORD_TOKEN
if (!token) {
	console.error('❌ DISCORD_TOKEN is not set in environment variables!')
	process.exit(1)
}

client.login(token).catch((error) => {
	console.error('❌ Failed to login:', error)
	process.exit(1)
})
