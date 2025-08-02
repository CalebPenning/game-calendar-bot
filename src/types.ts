export interface GameEntry {
	id: number
	game_name: string
	picker_id: string
	picker_name: string
	month: string // YYYY-MM format
	selected_at: string
	created_at: string
}

export interface MemberRotation {
	id: number
	user_id: string
	username: string
	last_picked_month: string | null
	pick_count: number
	is_eligible: boolean
	created_at: string
}

export interface GameNomination {
	id: number
	nominated_user_id: string
	nominated_username: string
	target_month: string // YYYY-MM format
	is_active: boolean
	created_at: string
}
