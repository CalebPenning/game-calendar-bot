import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { GameClubDatabase } from '../database'

export const data = new SlashCommandBuilder()
	.setName('select-game')
	.setDescription('Select a game for the current or next month')
	.addStringOption((option) =>
		option.setName('game').setDescription('The name of the game to select').setRequired(true),
	)

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const gameName = interaction.options.getString('game', true)
		const userId = interaction.user.id
		const username = interaction.user.displayName || interaction.user.username

		// Get current month and next month
		const now = new Date()
		const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1).toISOString().slice(0, 7)

		// Check if user is nominated for current month
		let targetMonth = currentMonth
		let nomination = db.getActiveNominationForMonth(currentMonth)

		// If no nomination for current month, check next month
		if (!nomination) {
			targetMonth = nextMonth
			nomination = db.getActiveNominationForMonth(nextMonth)
		}

		if (!nomination) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('❌ Not Nominated')
				.setDescription(
					'You are not currently nominated to pick a game. An admin needs to nominate you first using `/nominate-picker`.',
				)
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		if (nomination.nominated_user_id !== userId) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('❌ Not Your Turn')
				.setDescription(`<@${nomination.nominated_user_id}> is currently nominated to pick the game for this month.`)
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		// Check if game already exists for this month
		const existingGame = db.getGameByMonth(targetMonth)
		if (existingGame) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('❌ Game Already Selected')
				.setDescription(`A game has already been selected for this month: **${existingGame.game_name}**`)
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		// Add the game
		const gameEntry = db.addGame({
			game_name: gameName,
			picker_id: userId,
			picker_name: username,
			month: targetMonth,
			selected_at: new Date().toISOString(),
		})

		// Update member rotation
		db.updateMemberAfterPick(userId, targetMonth)

		// Deactivate the nomination
		db.deactivateNomination(nomination.id)

		// Add member to rotation if not already there
		if (!db.getMemberByUserId(userId)) {
			db.addMember(userId, username)
		}

		// Parse YYYY-MM safely
		const [year, month] = targetMonth.split('-')
		const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
		})

		const embed = new EmbedBuilder()
			.setColor(0x45b7d1)
			.setTitle('🎉 Game Selected!')
			.setDescription(`**${gameName}** has been selected for ${monthName}!`)
			.addFields(
				{ name: 'Selected by', value: `<@${userId}>`, inline: true },
				{ name: 'Month', value: monthName, inline: true },
			)
			.setTimestamp()
			.setFooter({ text: 'Let the gaming begin! 🎮' })

		await interaction.reply({ embeds: [embed] })

		// Send notification to channel
		if (interaction.channel && !interaction.ephemeral) {
			const notificationEmbed = new EmbedBuilder()
				.setColor(0x95e1d3)
				.setTitle('📢 New Game Alert!')
				.setDescription(
					`<@${userId}> has selected **${gameName}** for ${monthName}! Time to start planning your gaming sessions! 🎮`,
				)
				.setTimestamp()

			await interaction.followUp({ embeds: [notificationEmbed] })
		}
	} catch (error) {
		console.error('Error in select-game command:', error)
		await interaction.reply({
			content: 'An error occurred while selecting the game.',
			flags: MessageFlags.Ephemeral,
		})
	}
}
