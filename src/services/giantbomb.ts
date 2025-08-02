export interface GiantBombGame {
	id: number
	name: string
	deck: string
	image: {
		icon_url: string
		medium_url: string
		screen_url: string
		small_url: string
		super_url: string
		thumb_url: string
		tiny_url: string
	}
	original_release_date: string
	platforms: Array<{
		id: number
		name: string
		abbreviation: string
	}>
}

export interface GiantBombSearchResponse {
	error: string
	limit: number
	offset: number
	number_of_page_results: number
	number_of_total_results: number
	status_code: number
	results: GiantBombGame[]
}

export class GiantBombService {
	private apiKey: string
	private baseUrl = 'https://www.giantbomb.com/api'

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	async searchGames(query: string, limit: number = 10): Promise<GiantBombGame[]> {
		try {
			const searchUrl = `${this.baseUrl}/search?api_key=${this.apiKey}&format=json&query=${encodeURIComponent(
				query,
			)}&limit=${limit}&resources=game`

			console.log(`🔍 Searching Giant Bomb for: "${query}"`)

			const response = await fetch(searchUrl, {
				headers: {
					'User-Agent': 'Discord Game Club Bot',
				},
			})

			if (!response.ok) {
				throw new Error(`Giant Bomb API error: ${response.status} ${response.statusText}`)
			}

			const data = (await response.json()) as GiantBombSearchResponse

			if (data.status_code !== 1) {
				throw new Error(`Giant Bomb API returned error: ${data.error}`)
			}

			console.log(`✅ Found ${data.results.length} games for "${query}"`)
			return data.results
		} catch (error) {
			console.error('❌ Error searching Giant Bomb API:', error)
			throw error
		}
	}

	static cleanGameName(name: string): string {
		return name
			.replace(/\s*\(.*?\)\s*/g, '')
			.replace(/\s*:\s*.*$/g, '')
			.trim()
	}

	static formatGameForEmbed(game: GiantBombGame, index: number) {
		const platforms = game.platforms?.map((p) => p.abbreviation).join(', ') || 'Unknown'
		const releaseYear = game.original_release_date ? new Date(game.original_release_date).getFullYear() : 'Unknown'

		return {
			name: `${index + 1}. ${game.name}`,
			value: `${game.deck || 'No description available'}\n**Platforms:** ${platforms} | **Released:** ${releaseYear}`,
			inline: false,
		}
	}
}
