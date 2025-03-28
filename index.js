import {
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits
} from 'discord.js';
import http from 'http';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1343124162142666815";
const GUILD_ID = "1222570193096671343";
const CHANNEL_ID = "1344647779078766622";
const ROLE_ID = "1316376786208034816";

let statusChannelId = CHANNEL_ID;
let statusMessageId = null;

if (!TOKEN) {
    console.error('Missing BOT_TOKEN in .env file.');
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
        .setDescription('Get the current server status.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select a channel for status updates')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Ensures only admins can use it
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Successfully registered commands!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    setInterval(updateStatusEmbed, 60000);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'server-info') {
        if (interaction.options.getChannel('channel')) {
            statusChannelId = interaction.options.getChannel('channel').id;
        }

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
                .setURL('https://azure5.statuspage.io/')
        );

        try {
            const channel = await client.channels.fetch(statusChannelId);
            const message = await channel.send({ embeds: [embed], components: [button] });
            statusMessageId = message.id;
        } catch (error) {
            return interaction.reply({ content: 'Failed to send status embed. Check permissions.', ephemeral: true });
        }

        await interaction.reply({ content: `Status updates will be sent to <#${statusChannelId}>.`, ephemeral: true });
    }
});

async function getStatus() {
    try {
        const response = await fetch('https://azure5.statuspage.io/api/v2/summary.json');
        if (!response.ok) throw new Error('Failed to fetch status.');
        const data = await response.json();
        return {
            incidents: data.incidents.length ? data.incidents.map(i => `**${i.name}**: ${i.status}`).join('\n') : 'No active incidents.',
            maintenance: data.scheduled_maintenances.length ? data.scheduled_maintenances.map(m => `**${m.name}**: ${m.status}`).join('\n') : 'No scheduled maintenance.',
            components: data.components.map(c => `**${c.name}**: ${c.status}`).join('\n') || 'All components operational.',
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
    if (!statusChannelId || !statusMessageId) return;

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
            .setURL('https://azure5.statuspage.io/')
    );

    try {
        const channel = await client.channels.fetch(statusChannelId);
        const message = await channel.messages.fetch(statusMessageId);
        if (message) await message.edit({ embeds: [embed], components: [button] });
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

