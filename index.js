import { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle 
} from 'discord.js';
import http from 'http';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TOKEN; // Only the TOKEN will come from .env
const CLIENT_ID = "1343124162142666815";  // Directly in the script
const GUILD_ID = "1222570193096671343";  // Your Guild ID
const CHANNEL_ID = "1344647779078766622"; // The Channel ID to send the embed to
const ROLE_ID = "1316376786208034816"; // Role required to set the channel

let statusChannelId = CHANNEL_ID; // Use the pre-defined channel ID
let statusMessageId = null; // Stores the message ID of the status embed

if (!TOKEN) {
    console.error('Missing environment variable. Make sure to set the BOT_TOKEN in the .env file.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

const commands = [
    new SlashCommandBuilder()
        .setName('server-info')
        .setDescription('Server status updates.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send updates in')
                .setRequired(false)  // Channel ID is now predefined
        ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    setInterval(updateStatusEmbed, 60000); // Update the embed every 60 seconds
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'server-info') {
        // Optionally, let the user change the channel ID
        if (interaction.options.getChannel('channel')) {
            statusChannelId = interaction.options.getChannel('channel').id;
        }

        // Send initial status embed
        const { incidents, maintenance, components } = await getStatus();

        const embed = new EmbedBuilder()
            .setColor('#0F52BA')
            .setTitle('Server Status')
            .setDescription('Current status of our services.')
            .addFields(
                { name: 'Incidents', value: incidents, inline: false },
                { name: 'Maintenance', value: maintenance, inline: false },
                { name: 'Components', value: components, inline: false }
            )
            .setTimestamp();

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View Status')
                .setStyle(ButtonStyle.Link)
                .setURL('https://azure5.statuspage.io/')  // Corrected URL
        );

        try {
            const channel = await client.channels.fetch(statusChannelId);
            const message = await channel.send({ embeds: [embed], components: [button] });
            statusMessageId = message.id; // Save message ID for future updates
        } catch (error) {
            return interaction.reply({ content: 'Failed to send the status embed. Invalid channel or permission issue.', ephemeral: true });
        }

        await interaction.reply({ content: `Status updates will now be sent to the channel with ID: ${statusChannelId}.`, ephemeral: true });
    }
});

async function getStatus() {
    try {
        const response = await fetch('http://azure5.statuspage.io/api/v2/summary.json');
        if (!response.ok) throw new Error('Failed to fetch status.');
        const data = await response.json();
        return {
            incidents: data.incidents.map(incident => `**${incident.name}**: ${incident.status}`).join('\n') || 'No active incidents.',
            maintenance: data.scheduled_maintenances.map(m => `**${m.name}**: ${m.status}`).join('\n') || 'No scheduled maintenance.',
            components: data.components.map(c => `**${c.name}**: ${c.status}`).join('\n'),
        };
    } catch (error) {
        console.error('Error fetching server status:', error);
        return {
            incidents: 'Error fetching data.',
            maintenance: 'Error fetching data.',
            components: 'Error fetching data.',
        };
    }
}

async function updateStatusEmbed() {
    if (!statusChannelId || !statusMessageId) return; // Don't update if no channel is set

    const { incidents, maintenance, components } = await getStatus();

    const embed = new EmbedBuilder()
        .setColor('#0F52BA')
        .setTitle('Server Status')
        .setDescription('Current status of our services.')
        .addFields(
            { name: 'Incidents', value: incidents, inline: false },
            { name: 'Maintenance', value: maintenance, inline: false },
            { name: 'Components', value: components, inline: false }
        )
        .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('View Status')
            .setStyle(ButtonStyle.Link)
            .setURL('https://azure5.statuspage.io/')  // Corrected URL
    );

    try {
        const channel = await client.channels.fetch(statusChannelId);
        const message = await channel.messages.fetch(statusMessageId);

        if (message) {
            await message.edit({ embeds: [embed], components: [button] });
        } else {
            console.error('Status message not found.');
        }
    } catch (error) {
        console.error('Failed to update embed:', error);
    }
}

client.login(TOKEN);

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
}).listen(8080);

console.log('Ping server is running!');

