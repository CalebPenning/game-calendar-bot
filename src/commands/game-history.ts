import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { GameClubDatabase } from '../database'

export const data = new SlashCommandBuilder()
	.setName('game-history')
	.setDescription('View past games and their pickers')
	.addIntegerOption((option) =>
		option
			.setName('limit')
			.setDescription('Number of games to show (default: 10)')
			.setMinValue(1)
			.setMaxValue(25)
			.setRequired(false),
	)

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const limit = interaction.options.getInteger('limit') || 10
		const allGames = await db.getAllGames()
		const games = allGames.slice(0, limit)

		if (games.length === 0) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('📚 No Game History')
				.setDescription('No games have been selected yet! Use `/nominate-picker` to get started.')
				.setTimestamp()

			await interaction.reply({ embeds: [embed] })
			return
		}

		const embed = new EmbedBuilder()
			.setColor(0x4ecdc4)
			.setTitle('📚 Game Book Club History')
			.setDescription(`Showing the last ${games.length} game${games.length !== 1 ? 's' : ''}:`)
			.setTimestamp()

		games.forEach((game, index) => {
			const [year, month] = game.month.split('-')
			const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
			})

			const selectedDate = new Date(game.selected_at).toLocaleDateString()

			embed.addFields({
				name: `${index + 1}. ${monthName}`,
				value: `**${game.game_name}**\nPicked by: <@${game.picker_id}>\nSelected: ${selectedDate}`,
				inline: false,
			})
		})

		// Add statistics
		const memberStats = new Map<string, { count: number; name: string }>()
		allGames.forEach((game) => {
			const existing = memberStats.get(game.picker_id)
			if (existing) {
				existing.count++
			} else {
				memberStats.set(game.picker_id, { count: 1, name: game.picker_name })
			}
		})

		const sortedStats = Array.from(memberStats.entries())
			.sort(([, a], [, b]) => b.count - a.count)
			.slice(0, 5)

		if (sortedStats.length > 0) {
			const statsText = sortedStats
				.map(([userId, stats]) => `<@${userId}>: ${stats.count} game${stats.count !== 1 ? 's' : ''}`)
				.join('\n')

			embed.addFields({
				name: '🏆 Top Pickers',
				value: statsText,
				inline: false,
			})
		}

		embed.setFooter({
			text: `Total games played: ${allGames.length} | Unique pickers: ${memberStats.size}`,
		})

		await interaction.reply({ embeds: [embed] })
	} catch (error) {
		console.error('Error in game-history command:', error)
		await interaction.reply({
			content: 'An error occurred while fetching game history.',
			flags: MessageFlags.Ephemeral,
		})
	}
}
