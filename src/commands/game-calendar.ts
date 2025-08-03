import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { GameClubDatabase } from '../database'

export const data = new SlashCommandBuilder()
	.setName('game-calendar')
	.setDescription('View upcoming months calendar')
	.addIntegerOption((option) =>
		option
			.setName('months')
			.setDescription('Number of months to show (default: 6)')
			.setMinValue(1)
			.setMaxValue(12)
			.setRequired(false),
	)

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const monthsToShow = interaction.options.getInteger('months') || 6
		const now = new Date()

		const embed = new EmbedBuilder()
			.setColor(0x95e1d3)
			.setTitle('📅 Game Book Club Calendar')
			.setDescription(`Upcoming ${monthsToShow} months:`)
			.setTimestamp()

		for (let i = 0; i < monthsToShow; i++) {
			const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
			const targetMonth = targetDate.toISOString().slice(0, 7) // YYYY-MM
			const monthName = targetDate.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
			})

			// Check if game exists for this month
			const game = await db.getGameByMonth(targetMonth)

			// Check if there's an active nomination
			const nomination = await db.getActiveNominationForMonth(targetMonth)

			let status: string
			let emoji: string

			if (game) {
				status = `✅ **${game.game_name}**\nPicked by: <@${game.picker_id}>`
				emoji = '🎮'
			} else if (nomination) {
				status = `🎯 Waiting for <@${nomination.nominated_user_id}> to select`
				emoji = '⏳'
			} else {
				status = '❓ No picker nominated yet'
				emoji = '📝'
			}

			// Add current month indicator
			const isCurrentMonth = i === 0
			const monthTitle = isCurrentMonth ? `${emoji} ${monthName} (Current)` : `${emoji} ${monthName}`

			embed.addFields({
				name: monthTitle,
				value: status,
				inline: false,
			})
		}

		// Add some helpful info
		const eligibleMembers = await db.getEligibleMembersExcludingRecent()
		if (eligibleMembers.length > 0) {
			embed.addFields({
				name: '👥 Currently Eligible for Nomination',
				value: eligibleMembers.map((member) => `<@${member.user_id}>`).join(', '),
				inline: false,
			})
		}

		embed.setFooter({ text: 'Use /nominate-picker to nominate someone for an upcoming month!' })

		await interaction.reply({ embeds: [embed] })
	} catch (error) {
		console.error('Error in game-calendar command:', error)
		await interaction.reply({
			content: 'An error occurred while fetching the calendar.',
			flags: MessageFlags.Ephemeral,
		})
	}
}
