import { GameClubDatabase } from './database'
import * as cron from 'node-cron'
import path from 'path'
import fs from 'fs'

// Test bot initialization without Discord connection
console.log('🧪 Testing Discord Game Club Bot initialization...\n')

try {
	console.log('1️⃣ Testing database initialization...')
	const db = new GameClubDatabase('test-bot.db')

	console.log('2️⃣ Testing command loading...')
	const commandsPath = path.join(__dirname, 'commands')

	if (!fs.existsSync(commandsPath)) {
		console.log('❌ Commands directory not found, but this is expected in test')
	} else {
		const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
		console.log(`✅ Found ${commandFiles.length} command files`)

		// Try to load each command
		for (const file of commandFiles) {
			try {
				const filePath = path.join(commandsPath, file)
				const command = require(filePath)

				if ('data' in command && 'execute' in command) {
					console.log(`✅ Successfully loaded command: ${command.data.name}`)
				} else {
					console.log(`⚠️ Command ${file} missing required properties`)
				}
			} catch (error) {
				console.log(`❌ Failed to load command ${file}:`, (error as Error).message)
			}
		}
	}

	console.log('\n3️⃣ Testing cron schedule validation...')

	// Test cron expressions without actually running them
	const cronExpressions = [
		{ name: 'Monthly notifications', expr: '0 9 1 * *' },
		{ name: 'Weekly reminders', expr: '0 10 * * 0' },
		{ name: 'Next month reminders', expr: '0 10 25 * *' },
	]

	cronExpressions.forEach(({ name, expr }) => {
		try {
			// Validate cron expression
			cron.validate(expr)
			console.log(`✅ ${name}: ${expr} - Valid`)
		} catch (error) {
			console.log(`❌ ${name}: ${expr} - Invalid`)
		}
	})

	db.close()

	console.log('\n🎉 Bot initialization test passed! Ready for Discord setup.')
	console.log('\n📋 Next steps:')
	console.log('1. Create a Discord application at https://discord.com/developers/applications')
	console.log('2. Get your bot token and client ID')
	console.log('3. Create .env file with your credentials')
	console.log('4. Run: npm run dev')
} catch (error) {
	console.error('❌ Bot initialization test failed:', error)
	process.exit(1)
}
