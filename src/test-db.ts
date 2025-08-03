import { GameClubDatabase } from './database'

console.log('🧪 Testing Database Operations...\n')

async function testDatabase() {
	// This test requires a valid PostgreSQL connection
	if (!process.env.DATABASE_URL && !process.env.DATABASE_PRIVATE_URL) {
		console.log('⏭️ Skipping database tests - no DATABASE_URL or DATABASE_PRIVATE_URL set')
		console.log('💡 Set up PostgreSQL connection to run database tests')
		return
	}

	try {
		console.log('1️⃣ Testing database connection...')
		const db = new GameClubDatabase()

		console.log('2️⃣ Testing member operations...')
		const member1 = await db.addMember('user1', 'TestUser1')
		const member2 = await db.addMember('user2', 'TestUser2')
		const member3 = await db.addMember('user3', 'TestUser3')
		console.log(`✅ Added members: ${member1.username}, ${member2.username}, ${member3.username}`)

		console.log('3️⃣ Testing nomination...')
		const nomination = await db.addNomination('user1', 'TestUser1', '2024-12')
		console.log(`✅ Nominated: ${nomination.nominated_username} for ${nomination.target_month}`)

		console.log('4️⃣ Testing game selection...')
		const currentMonth = new Date().toISOString().slice(0, 7)
		const game = await db.addGame({
			game_name: 'Test Game',
			picker_id: 'user1',
			picker_name: 'TestUser1',
			month: currentMonth,
			selected_at: new Date().toISOString(),
			game_description: 'A test game for database testing',
			game_image_url: 'https://example.com/test-image.jpg',
		})
		console.log(`✅ Added game: ${game.game_name} for ${game.month}`)

		console.log('5️⃣ Testing queries...')
		const currentGame = await db.getCurrentMonthGame()
		console.log(`✅ Current game: ${currentGame?.game_name || 'None'}`)

		const allGames = await db.getAllGames()
		console.log(`✅ Total games: ${allGames.length}`)

		const allMembers = await db.getAllMembers()
		console.log(`✅ Total members: ${allMembers.length}`)

		console.log('6️⃣ Testing member rotation...')
		await db.updateMemberAfterPick('user1', currentMonth)
		const eligibleMembers = await db.getCurrentlyEligibleMembers()
		console.log(`✅ Eligible members (excluding recent): ${eligibleMembers.map((m) => m.username).join(', ')}`)

		await db.close()
		console.log('\n🎉 All database tests passed!')
	} catch (error) {
		console.error('❌ Database test failed:', error)
		process.exit(1)
	}
}

testDatabase()
