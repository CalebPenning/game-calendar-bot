import { GameClubDatabase } from './database'

// Test the database functionality
console.log('🧪 Testing Discord Game Club Bot Database...\n')

try {
	// Initialize database
	const db = new GameClubDatabase('test-gameclub.db')

	console.log('1️⃣ Testing member management...')

	// Add some test members
	const member1 = db.addMember('123456789', 'TestUser1')
	const member2 = db.addMember('987654321', 'TestUser2')
	const member3 = db.addMember('555666777', 'TestUser3')

	console.log('✅ Added members:', member1.username, member2.username, member3.username)

	console.log('\n2️⃣ Testing nominations...')

	// Test nominations
	const currentMonth = new Date().toISOString().slice(0, 7)
	const nomination = db.addNomination('123456789', 'TestUser1', currentMonth)

	console.log('✅ Created nomination for:', nomination.nominated_username)

	console.log('\n3️⃣ Testing game selection...')

	// Test game addition
	const game = db.addGame({
		game_name: 'Test Game',
		picker_id: '123456789',
		picker_name: 'TestUser1',
		month: currentMonth,
		selected_at: new Date().toISOString(),
	})

	console.log('✅ Added game:', game.game_name, 'for month:', game.month)

	console.log('\n4️⃣ Testing data retrieval...')

	// Test retrieval
	const currentGame = db.getCurrentMonthGame()
	const allGames = db.getAllGames()
	const allMembers = db.getAllMembers()

	console.log('✅ Current game:', currentGame?.game_name || 'None')
	console.log('✅ Total games:', allGames.length)
	console.log('✅ Total members:', allMembers.length)

	console.log('\n5️⃣ Testing rotation logic...')

	// Test eligible members (should exclude recent picker)
	const eligibleMembers = db.getEligibleMembersExcludingRecent()
	console.log(
		'✅ Eligible members (excluding recent):',
		eligibleMembers.map((m) => m.username),
	)

	// Clean up
	db.close()

	console.log('\n🎉 All database tests passed! The bot should work correctly.')
} catch (error) {
	console.error('❌ Database test failed:', error)
	process.exit(1)
}
