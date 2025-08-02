import { REST, Routes, type CommandInteraction } from 'discord.js'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables
config()

const commands: CommandInteraction[] = []
const commandsPath = path.join(__dirname, 'commands')
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))

// Load all commands
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file)
	const command = require(filePath)
	if ('data' in command && 'execute' in command) {
		commands.push(command.data.toJSON())
		console.log(`✅ Loaded command: ${command.data.name}`)
	} else {
		console.log(`⚠️ Command at ${filePath} is missing required "data" or "execute" property.`)
	}
}

// Create REST instance
const rest = new REST().setToken(process.env.DISCORD_TOKEN!)

// Deploy commands
async function deployCommands() {
	try {
		console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`)

		const clientId = process.env.CLIENT_ID!

		if (process.env.GUILD_ID) {
			// Deploy to specific guild (faster for development)
			const data = (await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), {
				body: commands,
			})) as any[]

			console.log(`✅ Successfully reloaded ${data.length} guild application (/) commands.`)
		} else {
			// Deploy globally (takes up to 1 hour to propagate)
			const data = (await rest.put(Routes.applicationCommands(clientId), { body: commands })) as any[]

			console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`)
		}
	} catch (error) {
		console.error('❌ Error deploying commands:', error)
		process.exit(1)
	}
}

// Check required environment variables
if (!process.env.DISCORD_TOKEN) {
	console.error('❌ DISCORD_TOKEN is not set in environment variables!')
	process.exit(1)
}

if (!process.env.CLIENT_ID) {
	console.error('❌ CLIENT_ID is not set in environment variables!')
	process.exit(1)
}

deployCommands()
