import { EmbedBuilder } from 'discord.js'
import { CONFIG } from '../config'

export function createBaseEmbed(color: number = CONFIG.COLORS.PRIMARY): EmbedBuilder {
	return new EmbedBuilder().setColor(color).setTimestamp()
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
	return createBaseEmbed(CONFIG.COLORS.ERROR).setTitle(`❌ ${title}`).setDescription(description)
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
	return createBaseEmbed(CONFIG.COLORS.SUCCESS).setTitle(`✅ ${title}`).setDescription(description)
}

export function createWarningEmbed(title: string, description: string): EmbedBuilder {
	return createBaseEmbed(CONFIG.COLORS.WARNING).setTitle(`⚠️ ${title}`).setDescription(description)
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
	return createBaseEmbed(CONFIG.COLORS.INFO).setTitle(`ℹ️ ${title}`).setDescription(description)
}

export function createGameEmbed(gameName: string, description?: string, imageUrl?: string): EmbedBuilder {
	const embed = createBaseEmbed().setTitle(`🎮 ${gameName}`).setFooter({ text: 'Happy gaming! 🎮' })

	if (description) {
		embed.setDescription(description)
	}

	if (imageUrl) {
		embed.setThumbnail(imageUrl)
	}

	return embed
}

export function createNominationEmbed(nominatedUserId: string, monthName: string, nominatedBy: string): EmbedBuilder {
	return createBaseEmbed(CONFIG.COLORS.SUCCESS)
		.setTitle('🎯 Member Nominated!')
		.setDescription(`<@${nominatedUserId}> has been nominated to pick the game for **${monthName}**!`)
		.addFields(
			{ name: 'Nominated by', value: `<@${nominatedBy}>`, inline: true },
			{ name: 'Target Month', value: monthName, inline: true },
		)
		.setFooter({ text: 'They can now use /select-game to choose!' })
}
