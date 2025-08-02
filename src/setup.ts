#!/usr/bin/env node

/**
 * Discord Game Club Bot - Setup Helper
 *
 * This script helps you set up your Discord bot by checking if you have
 * the necessary environment variables configured.
 */

import fs from 'fs'
import path from 'path'

console.log('🎮 Discord Game Club Bot - Setup Helper\n')

const envPath = path.join(process.cwd(), '.env')
const envExamplePath = path.join(process.cwd(), '.env.example')

// Check if .env file exists
if (!fs.existsSync(envPath)) {
	console.log('❌ .env file not found!')

	if (fs.existsSync(envExamplePath)) {
		console.log('📋 Found .env.example file. Please:')
		console.log('1. Copy .env.example to .env')
		console.log('2. Fill in your Discord bot credentials\n')

		// Show the example content
		const exampleContent = fs.readFileSync(envExamplePath, 'utf8')
		console.log('📄 .env.example content:')
		console.log('─'.repeat(50))
		console.log(exampleContent)
		console.log('─'.repeat(50))
	} else {
		console.log('📋 Creating .env.example for you...')
		const envTemplate = `# Discord Bot Configuration
# Get these values from https://discord.com/developers/applications

# Your bot's token (from Bot tab)
DISCORD_TOKEN=your_bot_token_here

# Your application's client ID (from General Information tab)
CLIENT_ID=your_client_id_here

# Your Discord server ID (for faster command deployment during development)
# Right-click your server name in Discord and "Copy Server ID"
GUILD_ID=your_guild_id_here`

		fs.writeFileSync(envExamplePath, envTemplate)
		console.log('✅ Created .env.example file')
		console.log('📋 Please copy this to .env and fill in your credentials')
	}

	console.log('\n🔗 Get your Discord credentials from:')
	console.log('   https://discord.com/developers/applications')
	console.log('\n📖 Setup guide: Check SETUP.md for detailed instructions')

	process.exit(1)
}

// Check .env file content
console.log('✅ Found .env file')

try {
	require('dotenv').config()

	const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID']
	const optionalVars = ['GUILD_ID']

	console.log('\n🔍 Checking environment variables...')

	let allRequired = true

	for (const varName of requiredVars) {
		const value = process.env[varName]
		if (!value || value === `your_${varName.toLowerCase()}_here`) {
			console.log(`❌ ${varName}: Not set or using placeholder value`)
			allRequired = false
		} else {
			// Mask sensitive values
			const maskedValue =
				varName === 'DISCORD_TOKEN' ? value.substring(0, 10) + '...' + value.substring(value.length - 10) : value
			console.log(`✅ ${varName}: ${maskedValue}`)
		}
	}

	for (const varName of optionalVars) {
		const value = process.env[varName]
		if (!value || value === `your_${varName.toLowerCase()}_here`) {
			console.log(`⚠️  ${varName}: Not set (optional, but recommended for development)`)
		} else {
			console.log(`✅ ${varName}: ${value}`)
		}
	}

	if (!allRequired) {
		console.log('\n❌ Some required environment variables are missing!')
		console.log('📖 Please check SETUP.md for help getting these values')
		process.exit(1)
	}

	console.log('\n🎉 Environment setup looks good!')
	console.log('\n📋 You can now:')
	console.log('   npm run deploy  # Deploy slash commands to Discord')
	console.log('   npm run dev     # Start the bot in development mode')
	console.log('   npm run build   # Build for production')
	console.log('   npm start       # Start in production mode')
} catch (error) {
	console.error('❌ Error reading .env file:', error)
	process.exit(1)
}
