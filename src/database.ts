import Database from 'better-sqlite3'
import { GameEntry, MemberRotation, GameNomination } from './types'

export class GameClubDatabase {
	private db: Database.Database

	constructor(dbPath: string = 'gameclub.db') {
		try {
			this.db = new Database(dbPath)
			console.log(`📦 SQLite database connected: ${dbPath}`)

			// Enable WAL mode for better performance
			this.db.pragma('journal_mode = WAL')

			this.initializeTables()
		} catch (error) {
			console.error('❌ Failed to initialize database:', error)
			throw error
		}
	}

	private initializeTables() {
		try {
			// Games table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS games (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_name TEXT NOT NULL,
          picker_id TEXT NOT NULL,
          picker_name TEXT NOT NULL,
          month TEXT NOT NULL UNIQUE,
          selected_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

			// Member rotation table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS member_rotation (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL,
          last_picked_month TEXT,
          pick_count INTEGER DEFAULT 0,
          is_eligible BOOLEAN DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

			// Game nominations table
			this.db.exec(`
        CREATE TABLE IF NOT EXISTS game_nominations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nominated_user_id TEXT NOT NULL,
          nominated_username TEXT NOT NULL,
          target_month TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

			console.log('✅ Database tables initialized successfully')
		} catch (error) {
			console.error('❌ Failed to initialize tables:', error)
			throw error
		}
	}

	// Game methods
	addGame(gameData: Omit<GameEntry, 'id' | 'created_at'>): GameEntry {
		try {
			const stmt = this.db.prepare(`
        INSERT INTO games (game_name, picker_id, picker_name, month, selected_at)
        VALUES (?, ?, ?, ?, ?)
      `)

			const result = stmt.run(
				gameData.game_name,
				gameData.picker_id,
				gameData.picker_name,
				gameData.month,
				gameData.selected_at,
			)

			return this.getGameById(result.lastInsertRowid as number)!
		} catch (error) {
			console.error('❌ Failed to add game:', error)
			throw error
		}
	}

	getGameById(id: number): GameEntry | null {
		try {
			const stmt = this.db.prepare('SELECT * FROM games WHERE id = ?')
			return stmt.get(id) as GameEntry | null
		} catch (error) {
			console.error('❌ Failed to get game by ID:', error)
			return null
		}
	}

	getGameByMonth(month: string): GameEntry | null {
		try {
			const stmt = this.db.prepare('SELECT * FROM games WHERE month = ?')
			return stmt.get(month) as GameEntry | null
		} catch (error) {
			console.error('❌ Failed to get game by month:', error)
			return null
		}
	}

	getCurrentMonthGame(): GameEntry | null {
		const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
		return this.getGameByMonth(currentMonth)
	}

	getAllGames(): GameEntry[] {
		try {
			const stmt = this.db.prepare('SELECT * FROM games ORDER BY month DESC')
			return stmt.all() as GameEntry[]
		} catch (error) {
			console.error('❌ Failed to get all games:', error)
			return []
		}
	}

	// Member rotation methods
	addMember(userId: string, username: string): MemberRotation {
		try {
			const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO member_rotation (user_id, username)
        VALUES (?, ?)
      `)

			stmt.run(userId, username)
			return this.getMemberByUserId(userId)!
		} catch (error) {
			console.error('❌ Failed to add member:', error)
			throw error
		}
	}

	getMemberByUserId(userId: string): MemberRotation | null {
		try {
			const stmt = this.db.prepare('SELECT * FROM member_rotation WHERE user_id = ?')
			return stmt.get(userId) as MemberRotation | null
		} catch (error) {
			console.error('❌ Failed to get member by user ID:', error)
			return null
		}
	}

	getAllMembers(): MemberRotation[] {
		try {
			const stmt = this.db.prepare('SELECT * FROM member_rotation ORDER BY username')
			return stmt.all() as MemberRotation[]
		} catch (error) {
			console.error('❌ Failed to get all members:', error)
			return []
		}
	}

	getEligibleMembers(): MemberRotation[] {
		try {
			const stmt = this.db.prepare('SELECT * FROM member_rotation WHERE is_eligible = 1')
			return stmt.all() as MemberRotation[]
		} catch (error) {
			console.error('❌ Failed to get eligible members:', error)
			return []
		}
	}

	updateMemberAfterPick(userId: string, month: string): void {
		try {
			const stmt = this.db.prepare(`
        UPDATE member_rotation
        SET last_picked_month = ?, pick_count = pick_count + 1
        WHERE user_id = ?
      `)

			stmt.run(month, userId)
		} catch (error) {
			console.error('❌ Failed to update member after pick:', error)
			throw error
		}
	}

	// Get members excluding the last two pickers
	getEligibleMembersExcludingRecent(): MemberRotation[] {
		try {
			const recentPickers = this.db
				.prepare(
					`
        SELECT picker_id FROM games
        ORDER BY month DESC
        LIMIT 2
      `,
				)
				.all() as { picker_id: string }[]

			const excludeIds = recentPickers.map((p) => p.picker_id)

			if (excludeIds.length === 0) {
				return this.getEligibleMembers()
			}

			const placeholders = excludeIds.map(() => '?').join(',')
			const stmt = this.db.prepare(`
        SELECT * FROM member_rotation 
        WHERE is_eligible = 1 AND user_id NOT IN (${placeholders})
      `)

			return stmt.all(...excludeIds) as MemberRotation[]
		} catch (error) {
			console.error('❌ Failed to get eligible members excluding recent:', error)
			return []
		}
	}

	// Nomination methods
	addNomination(userId: string, username: string, targetMonth: string): GameNomination {
		try {
			// Deactivate any existing nominations for this month
			this.db
				.prepare(
					`
        UPDATE game_nominations 
        SET is_active = 0 
        WHERE target_month = ?
      `,
				)
				.run(targetMonth)

			const stmt = this.db.prepare(`
        INSERT INTO game_nominations (nominated_user_id, nominated_username, target_month)
        VALUES (?, ?, ?)
      `)

			const result = stmt.run(userId, username, targetMonth)
			return this.getNominationById(result.lastInsertRowid as number)!
		} catch (error) {
			console.error('❌ Failed to add nomination:', error)
			throw error
		}
	}

	getNominationById(id: number): GameNomination | null {
		try {
			const stmt = this.db.prepare('SELECT * FROM game_nominations WHERE id = ?')
			return stmt.get(id) as GameNomination | null
		} catch (error) {
			console.error('❌ Failed to get nomination by ID:', error)
			return null
		}
	}

	getActiveNominationForMonth(month: string): GameNomination | null {
		try {
			const stmt = this.db.prepare(`
        SELECT * FROM game_nominations 
        WHERE target_month = ? AND is_active = 1
      `)
			return stmt.get(month) as GameNomination | null
		} catch (error) {
			console.error('❌ Failed to get active nomination for month:', error)
			return null
		}
	}

	deactivateNomination(id: number): void {
		try {
			const stmt = this.db.prepare('UPDATE game_nominations SET is_active = 0 WHERE id = ?')
			stmt.run(id)
		} catch (error) {
			console.error('❌ Failed to deactivate nomination:', error)
			throw error
		}
	}

	close(): void {
		try {
			this.db.close()
			console.log('📦 Database connection closed')
		} catch (error) {
			console.error('❌ Failed to close database:', error)
		}
	}
}
