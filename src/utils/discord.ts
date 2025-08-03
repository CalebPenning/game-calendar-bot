import { Guild, GuildMember, GuildTextBasedChannel } from 'discord.js'
import { CONFIG } from '../config'

export function findGameChannel(guild: Guild): GuildTextBasedChannel | undefined {
	const channel = guild.channels.cache.find((ch) => ch.isTextBased() && ch.name === CONFIG.CHANNELS.GAME_DISCUSSION)
	return channel?.isTextBased() ? channel : undefined
}

export function getEligibleMembersForAutoNomination(
	members: Map<string, GuildMember>,
	recentPickerIds: string[],
): GuildMember[] {
	const excludedUserIds = [CONFIG.AUTO_NOMINATION.EXCLUDED_USER_ID, ...recentPickerIds]

	return Array.from(members.values()).filter((member) => !member.user.bot && !excludedUserIds.includes(member.user.id))
}

export function selectRandomMember(members: GuildMember[]): GuildMember | null {
	if (members.length === 0) return null
	return members[Math.floor(Math.random() * members.length)]
}

export function getDisplayName(member: GuildMember): string {
	return member.displayName || member.user.username
}

export async function sendDirectMessage(member: GuildMember, content: string): Promise<boolean> {
	try {
		await member.user.send({ content })
		return true
	} catch (error) {
		console.log(`Could not send DM to ${getDisplayName(member)}:`, error)
		return false
	}
}
