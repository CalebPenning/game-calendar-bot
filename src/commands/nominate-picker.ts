import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js'
import { GameClubDatabase } from '../database'
import { getCurrentMonth, formatMonthYear } from '../utils/date'
import { getDisplayName, sendDirectMessage } from '../utils/discord'
import { createErrorEmbed, createWarningEmbed, createNominationEmbed } from '../utils/embeds'

export const data = new SlashCommandBuilder()
	.setName('nominate-picker')
	.setDescription('Nominate a member to pick the next game')
	.addUserOption((option) => option.setName('user').setDescription('The user to nominate').setRequired(true))
	.addStringOption((option) =>
		option
			.setName('month')
			.setDescription('Month to nominate for (YYYY-MM format, defaults to current month)')
			.setRequired(false),
	)

export async function execute(interaction: ChatInputCommandInteraction, db: GameClubDatabase) {
	try {
		const targetUser = interaction.options.getUser('user', true)
		const monthInput = interaction.options.getString('month')

		let targetMonth: string
		if (monthInput) {
			if (!/^\d{4}-\d{2}$/.test(monthInput)) {
				const embed = createErrorEmbed('Invalid Month Format', 'Please use YYYY-MM format (e.g., 2024-03)')
				await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
				return
			}
			targetMonth = monthInput
		} else {
			targetMonth = getCurrentMonth()
		}

		const existingGame = await db.getGameByMonth(targetMonth)
		if (existingGame) {
			const embed = new EmbedBuilder()
				.setColor(0xff6b6b)
				.setTitle('❌ Game Already Selected')
				.setDescription(
					`A game has already been selected for ${targetMonth}: **${existingGame.game_name}** by <@${existingGame.picker_id}>`,
				)
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		const guildMembers = await interaction.guild?.members.fetch()
		const eligibleMembers = await db.getCurrentlyEligibleMembers(guildMembers)
		const isEligible = eligibleMembers.some((member) => member.user_id === targetUser.id)

		if (!isEligible && eligibleMembers.length > 0) {
			const recentGames = (await db.getAllGames()).slice(0, 2)
			const recentPickerNames = recentGames.map((game) => game.picker_name).join(', ')

			const embed = new EmbedBuilder()
				.setColor(0xffd93d)
				.setTitle('⚠️ User Not Eligible')
				.setDescription(
					`<@${targetUser.id}> was one of the last 2 game pickers (${recentPickerNames}). Consider nominating someone else to maintain rotation fairness.`,
				)
				.addFields({
					name: 'Eligible Members',
					value: eligibleMembers.map((member) => `<@${member.user_id}>`).join(', ') || 'None available',
				})
				.setTimestamp()

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
			return
		}

		const member = interaction.guild?.members.cache.get(targetUser.id)
		const username = member ? getDisplayName(member) : targetUser.displayName || targetUser.username
		if (!(await db.getMemberByUserId(targetUser.id))) {
			await db.addMember(targetUser.id, username)
		}

		await db.addNomination(targetUser.id, username, targetMonth)

		const monthName = formatMonthYear(targetMonth)
		const embed = createNominationEmbed(targetUser.id, monthName, interaction.user.id)

		await interaction.reply({ embeds: [embed] })

		try {
			const dmEmbed = new EmbedBuilder()
				.setColor(0x95e1d3)
				.setTitle("🎮 You've Been Nominated!")
				.setDescription(`You've been nominated to pick the game for **${monthName}** in the Game Book Club!`)
				.addFields({
					name: 'What to do next',
					value:
						'Use the `/select-game` command in the server to choose your game. Take your time and pick something you think everyone will enjoy!',
				})
				.setTimestamp()

			await targetUser.send({ embeds: [dmEmbed] })
		} catch (error) {
			console.log('Could not send DM to nominated user:', error)
		}
	} catch (error) {
		console.error('Error in nominate-picker command:', error)
		await interaction.reply({
			content: 'An error occurred while nominating the picker.',
			flags: MessageFlags.Ephemeral,
		})
	}
}
