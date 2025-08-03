import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ComponentType,
} from 'discord.js'
import { GameClubDatabase } from '../database'
import { GiantBombService, GiantBombGame } from '../services/giantbomb'

export const data = new SlashCommandBuilder()
	.setName('select-game')
	.setDescription('Search for and select a game for the current or next month')
	.addStringOption((option) =>
		option.setName('query').setDescription('Search for a game (e.g., "The Witcher 3")').setRequired(true),
	)

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const searchQuery = interaction.options.getString('query', true)
		const userId = interaction.user.id
		const username = interaction.user.displayName || interaction.user.username

		const now = new Date()
		const currentMonth = now.toISOString().slice(0, 7)
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1).toISOString().slice(0, 7)

		let targetMonth = currentMonth
		let nomination = await db.getActiveNominationForMonth(currentMonth)

		if (!nomination) {
			targetMonth = nextMonth
			nomination = await db.getActiveNominationForMonth(nextMonth)
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

		const existingGame = await db.getGameByMonth(targetMonth)
		if (existingGame) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('❌ Game Already Selected')
				.setDescription(`A game has already been selected for this month: **${existingGame.game_name}**`)
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		await interaction.deferReply()

		const apiKey = process.env.GIANT_BOMB_API_KEY
		if (!apiKey) {
			await interaction.editReply({
				content: '❌ Giant Bomb API is not configured. Please contact an administrator.',
			})
			return
		}

		const giantBomb = new GiantBombService(apiKey)
		let searchResults: GiantBombGame[]

		try {
			searchResults = await giantBomb.searchGames(searchQuery, 10)
		} catch (error) {
			console.error('Giant Bomb API error:', error)
			await interaction.editReply({
				content: `❌ Error searching for games: ${error instanceof Error ? error.message : 'Unknown error'}`,
			})
			return
		}

		if (searchResults.length === 0) {
			await interaction.editReply({
				content: `🔍 No games found for "${searchQuery}". Try a different search term!`,
			})
			return
		}

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('game_selection')
			.setPlaceholder('Choose a game from the search results')
			.addOptions(
				searchResults.map((game, index) =>
					new StringSelectMenuOptionBuilder()
						.setLabel(game.name.length > 100 ? game.name.substring(0, 97) + '...' : game.name)
						.setDescription(
							game.deck && game.deck.length > 100 ? game.deck.substring(0, 97) + '...' : game.deck || 'No description',
						)
						.setValue(index.toString()),
				),
			)

		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

		const [year, month] = targetMonth.split('-')
		const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
		})

		const searchEmbed = new EmbedBuilder()
			.setColor(0x4ecdc4)
			.setTitle(`🔍 Game Search Results for "${searchQuery}"`)
			.setDescription(`Found ${searchResults.length} games. Select one for **${monthName}**:`)
			.addFields(searchResults.map((game, index) => GiantBombService.formatGameForEmbed(game, index)).slice(0, 10))
			.setTimestamp()
			.setFooter({ text: 'Select a game from the dropdown below' })

		if (searchResults[0]?.image?.medium_url) {
			searchEmbed.setThumbnail(searchResults[0].image.medium_url)
		}

		await interaction.editReply({
			embeds: [searchEmbed],
			components: [row],
		})

		try {
			const collector = interaction.channel?.createMessageComponentCollector({
				componentType: ComponentType.StringSelect,
				filter: (i) => i.user.id === userId && i.customId === 'game_selection',
				time: 60000,
			})

			collector?.on('collect', async (selectInteraction) => {
				const selectedIndex = parseInt(selectInteraction.values[0])
				const selectedGame = searchResults[selectedIndex]

				const gameEntry = await db.addGame({
					game_name: selectedGame.name,
					picker_id: userId,
					picker_name: username,
					month: targetMonth,
					selected_at: new Date().toISOString(),
					game_description: selectedGame.deck,
					game_image_url: selectedGame.image?.medium_url,
				})

				await db.updateMemberAfterPick(userId, targetMonth)
				await db.deactivateNomination(nomination.id)

				if (!(await db.getMemberByUserId(userId))) {
					await db.addMember(userId, username)
				}

				const successEmbed = new EmbedBuilder()
					.setColor(0x45b7d1)
					.setTitle('🎉 Game Selected!')
					.setDescription(`**${selectedGame.name}** has been selected for ${monthName}!`)
					.addFields(
						{ name: 'Selected by', value: `<@${userId}>`, inline: true },
						{ name: 'Month', value: monthName, inline: true },
					)
					.setTimestamp()
					.setFooter({ text: 'Let the gaming begin! 🎮' })

				if (selectedGame.image?.medium_url) {
					successEmbed.setThumbnail(selectedGame.image.medium_url)
				}

				await selectInteraction.update({
					embeds: [successEmbed],
					components: [],
				})
				const notificationEmbed = new EmbedBuilder()
					.setColor(0x95e1d3)
					.setTitle('📢 New Game Alert!')
					.setDescription(
						`<@${userId}> has selected **${selectedGame.name}** for ${monthName}! Time to start planning your gaming sessions! 🎮`,
					)
					.setTimestamp()

				if (selectedGame.image?.medium_url) {
					notificationEmbed.setThumbnail(selectedGame.image.medium_url)
				}

				await interaction.followUp({ embeds: [notificationEmbed] })

				collector.stop()
			})

			collector?.on('end', (collected) => {
				if (collected.size === 0) {
					const timeoutEmbed = new EmbedBuilder()
						.setColor(0xff6b6b)
						.setTitle('⏰ Selection Timeout')
						.setDescription('You took too long to select a game. Please run the command again.')
						.setTimestamp()

					interaction.editReply({
						embeds: [timeoutEmbed],
						components: [],
					})
				}
			})
		} catch (error) {
			console.error('Error setting up collector:', error)
			await interaction.editReply({
				content: 'An error occurred while setting up game selection.',
				components: [],
			})
		}
	} catch (error) {
		console.error('Error in select-game command:', error)
		if (interaction.deferred) {
			await interaction.editReply({
				content: 'An error occurred while searching for games.',
			})
		} else {
			await interaction.reply({
				content: 'An error occurred while searching for games.',
				flags: MessageFlags.Ephemeral,
			})
		}
	}
}
