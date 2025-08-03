import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { GameClubDatabase } from '../database'

export const data = new SlashCommandBuilder().setName('current-game').setDescription("View the current month's game")

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const currentGame = await db.getCurrentMonthGame()

		if (!currentGame) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('📅 No Game Selected')
				.setDescription('No game has been selected for this month yet!')
				.setTimestamp()

			await interaction.reply({ embeds: [embed] })
			return
		}

		const currentMonth = new Date().toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
		})

		const embed = new EmbedBuilder()
			.setColor(0x4ecdc4)
			.setTitle(`🎮 ${currentMonth}'s Game`)
			.setDescription(
				`**${currentGame.game_name}**${currentGame.game_description ? `\n\n${currentGame.game_description}` : ''}`,
			)
			.addFields(
				{ name: 'Picked by', value: `<@${currentGame.picker_id}>`, inline: true },
				{ name: 'Selected on', value: new Date(currentGame.selected_at).toLocaleDateString(), inline: true },
			)
			.setTimestamp()
			.setFooter({ text: 'Happy gaming! 🎮' })

		if (currentGame.game_image_url) {
			embed.setThumbnail(currentGame.game_image_url)
		}

		await interaction.reply({ embeds: [embed] })
	} catch (error) {
		console.error('Error in current-game command:', error)
		await interaction.reply({
			content: 'An error occurred while fetching the current game.',
			flags: MessageFlags.Ephemeral,
		})
	}
}
