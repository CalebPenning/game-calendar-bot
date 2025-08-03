import postgres from 'postgres'
import { GameEntry, MemberRotation, GameNomination } from './types'

export class GameClubDatabase {
	private sql: postgres.Sql

	constructor() {
		try {
			const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL

			if (!connectionString) {
				throw new Error('DATABASE_URL or DATABASE_PRIVATE_URL environment variable is required')
			}

			this.sql = postgres(connectionString, {
				ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
			})

			console.log('📦 PostgreSQL database connected')
			this.initializeTables()
		} catch (error) {
			console.error('❌ Failed to initialize database:', error)
			throw error
		}
	}

	private async initializeTables() {
		try {
			await this.sql`
				CREATE TABLE IF NOT EXISTS games (
					id SERIAL PRIMARY KEY,
					game_name TEXT NOT NULL,
					picker_id TEXT NOT NULL,
					picker_name TEXT NOT NULL,
					month TEXT NOT NULL UNIQUE,
					selected_at TIMESTAMPTZ NOT NULL,
					created_at TIMESTAMPTZ DEFAULT NOW(),
					game_description TEXT,
					game_image_url TEXT
				)
			`

			await this.sql`
				CREATE TABLE IF NOT EXISTS member_rotation (
					id SERIAL PRIMARY KEY,
					user_id TEXT NOT NULL UNIQUE,
					username TEXT NOT NULL,
					last_picked_month TEXT,
					pick_count INTEGER DEFAULT 0,
					is_eligible BOOLEAN DEFAULT true,
					created_at TIMESTAMPTZ DEFAULT NOW()
				)
			`

			await this.sql`
				CREATE TABLE IF NOT EXISTS game_nominations (
					id SERIAL PRIMARY KEY,
					nominated_user_id TEXT NOT NULL,
					nominated_username TEXT NOT NULL,
					target_month TEXT NOT NULL,
					is_active BOOLEAN DEFAULT true,
					created_at TIMESTAMPTZ DEFAULT NOW()
				)
			`

			console.log('✅ Database tables initialized successfully')
		} catch (error) {
			console.error('❌ Failed to initialize tables:', error)
			throw error
		}
	}

	async addGame(gameData: Omit<GameEntry, 'id' | 'created_at'>): Promise<GameEntry> {
		try {
			const [result] = await this.sql<GameEntry[]>`
				INSERT INTO games (game_name, picker_id, picker_name, month, selected_at, game_description, game_image_url)
				VALUES (${gameData.game_name}, ${gameData.picker_id}, ${gameData.picker_name}, 
						${gameData.month}, ${gameData.selected_at}, ${gameData.game_description || null}, 
						${gameData.game_image_url || null})
				RETURNING *
			`
			return result
		} catch (error) {
			console.error('❌ Failed to add game:', error)
			throw error
		}
	}

	async getGameById(id: number): Promise<GameEntry | null> {
		try {
			const [result] = await this.sql<GameEntry[]>`SELECT * FROM games WHERE id = ${id}`
			return result || null
		} catch (error) {
			console.error('❌ Failed to get game by ID:', error)
			return null
		}
	}

	async getGameByMonth(month: string): Promise<GameEntry | null> {
		try {
			const [result] = await this.sql<GameEntry[]>`SELECT * FROM games WHERE month = ${month}`
			return result || null
		} catch (error) {
			console.error('❌ Failed to get game by month:', error)
			return null
		}
	}

	async getCurrentMonthGame(): Promise<GameEntry | null> {
		const currentMonth = new Date().toISOString().slice(0, 7)
		return this.getGameByMonth(currentMonth)
	}

	async getAllGames(): Promise<GameEntry[]> {
		try {
			const results = await this.sql<GameEntry[]>`SELECT * FROM games ORDER BY month DESC`
			return results
		} catch (error) {
			console.error('❌ Failed to get all games:', error)
			return []
		}
	}

	async addMember(userId: string, username: string): Promise<MemberRotation> {
		try {
			const [result] = await this.sql<MemberRotation[]>`
				INSERT INTO member_rotation (user_id, username)
				VALUES (${userId}, ${username})
				ON CONFLICT (user_id) DO UPDATE SET username = ${username}
				RETURNING *
			`
			return result
		} catch (error) {
			console.error('❌ Failed to add member:', error)
			throw error
		}
	}

	async getMemberByUserId(userId: string): Promise<MemberRotation | null> {
		try {
			const [result] = await this.sql<MemberRotation[]>`SELECT * FROM member_rotation WHERE user_id = ${userId}`
			return result || null
		} catch (error) {
			console.error('❌ Failed to get member by user ID:', error)
			return null
		}
	}

	async getAllMembers(): Promise<MemberRotation[]> {
		try {
			const results = await this.sql<MemberRotation[]>`SELECT * FROM member_rotation ORDER BY username`
			return results
		} catch (error) {
			console.error('❌ Failed to get all members:', error)
			return []
		}
	}

	async getEligibleMembers(): Promise<MemberRotation[]> {
		try {
			const results = await this.sql<MemberRotation[]>`SELECT * FROM member_rotation WHERE is_eligible = true`
			return results
		} catch (error) {
			console.error('❌ Failed to get eligible members:', error)
			return []
		}
	}

	async updateMemberAfterPick(userId: string, month: string): Promise<void> {
		try {
			await this.sql`
				UPDATE member_rotation
				SET last_picked_month = ${month}, pick_count = pick_count + 1
				WHERE user_id = ${userId}
			`
		} catch (error) {
			console.error('❌ Failed to update member after pick:', error)
			throw error
		}
	}

	async getCurrentlyEligibleMembers(): Promise<MemberRotation[]> {
		try {
			const recentPickers = (await this.sql<Partial<GameEntry>[]>`
				SELECT picker_id FROM games
				ORDER BY month DESC
				LIMIT 2
			`)

			const excludeIds = recentPickers.map((p) => p.picker_id).filter((id): id is string => !!id)

			if (excludeIds.length === 0) {
				return this.getEligibleMembers()
			}

			const results = await this.sql<MemberRotation[]>`
				SELECT * FROM member_rotation 
				WHERE is_eligible = true AND user_id NOT IN ${this.sql(excludeIds)}
			`

			return results
		} catch (error) {
			console.error('❌ Failed to get eligible members excluding recent:', error)
			return []
		}
	}

	async addNomination(userId: string, username: string, targetMonth: string): Promise<GameNomination> {
		try {
			await this.sql`
				UPDATE game_nominations 
				SET is_active = false 
				WHERE target_month = ${targetMonth}
			`

			const [result] = await this.sql<GameNomination[]>`
				INSERT INTO game_nominations (nominated_user_id, nominated_username, target_month)
				VALUES (${userId}, ${username}, ${targetMonth})
				RETURNING *
			`

			return result
		} catch (error) {
			console.error('❌ Failed to add nomination:', error)
			throw error
		}
	}

	async getNominationById(id: number): Promise<GameNomination | null> {
		try {
			const [result] = await this.sql<GameNomination[]>`SELECT * FROM game_nominations WHERE id = ${id}`
			return result || null
		} catch (error) {
			console.error('❌ Failed to get nomination by ID:', error)
			return null
		}
	}

	async getActiveNominationForMonth(month: string): Promise<GameNomination | null> {
		try {
			const [result] = await this.sql<GameNomination[]>`
				SELECT * FROM game_nominations 
				WHERE target_month = ${month} AND is_active = true
			`
			return result || null
		} catch (error) {
			console.error('❌ Failed to get active nomination for month:', error)
			return null
		}
	}

	async deactivateNomination(id: number): Promise<void> {
		try {
			await this.sql`UPDATE game_nominations SET is_active = false WHERE id = ${id}`
		} catch (error) {
			console.error('❌ Failed to deactivate nomination:', error)
			throw error
		}
	}

	async close(): Promise<void> {
		try {
			await this.sql.end()
			console.log('📦 Database connection closed')
		} catch (error) {
			console.error('❌ Failed to close database:', error)
		}
	}
}
