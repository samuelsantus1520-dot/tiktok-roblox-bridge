const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const whitelistAtiva = ["souosam25"];
const activeConnections = {};
const eventQueues = {};

// Dicionário blindado
const giftToAnimeAction = {
    "rosa": { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" },
    "tiktok": { action: "spawn", prefab: "MaoPoppy", message: "TIKTOK! Mão do Poppy Playtime te jogou para trás (-15)!" },
    "dedo de coracao": { action: "spawn", prefab: "Goku", message: "DEDO DE CORAÇÃO! Goku Kamehameha (+90)!" },
    "carinha verde": { action: "spawn", prefab: "Meteoro", message: "CARINHA VERDE! Meteoro de Pégasus (-90)!" },
    "rosquinha": { action: "spawn", prefab: "Rasengan", message: "ROSQUINHA! Naruto Rasengan supremo (+450)!" },
    "capivara": { action: "spawn", prefab: "Thor", message: "CAPIVARA! Machado do Thor (-450)!" },
    "bone": { action: "spawn", prefab: "Gojo", message: "BONÉ! Gojo Expansão de Domínio (VITÓRIA)!" },
    "chapeu": { action: "spawn", prefab: "SukunaFinger", message: "CHAPÉU! Saitama Soco Sério (INÍCIO)!" }
};

function normalizeGiftName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function getOrConnectStreamer(username) {
    if (!username) return null;
    if (activeConnections[username]) return eventQueues[username];

    console.log(`[TikTok Bridge] Conectando ao canal de: @${username}`);
    const tiktokLiveConnection = new TikTokLiveConnection(username, {});
    eventQueues[username] = [];

    tiktokLiveConnection.connect().then(state => {
        console.log(`[TikTok Bridge] Conectado com sucesso à sala de @${username} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error(`[TikTok Bridge] Erro ao conectar em @${username}:`, err.message);
    });

    tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
        const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
        const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
        const cleanName = normalizeGiftName(rawGiftName);

        // BUSCA SEGURA E FORÇADA PARA A ROSA E OUTROS
        let actionConfig = giftToAnimeAction[cleanName];
        if (!actionConfig && (cleanName.includes("rosa") || rawGiftName.toLowerCase().includes("rosa"))) {
            actionConfig = { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" };
        }

        if (actionConfig) {
            console.log(`[${username}][ANIME] ` + actionConfig.message + ' (Enviado por: ' + userName + ')');
            eventQueues[username].push({ 
                type: 'gift', 
                user: userName, 
                gift: rawGiftName, 
                data: actionConfig 
            });
        } else {
            console.log(`[DEBUG] Presente não mapeado: "${rawGiftName}" (limpo: "${cleanName}")`);
        }
    });

    tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
        if (data.displayType && data.displayType.includes('follow')) {
            console.log(`[${username}][FOLLOW] Novo seguidor: ` + data.uniqueId);
            eventQueues[username].push({ type: 'follow', user: data.uniqueId });
        }
    });

    activeConnections[username] = tiktokLiveConnection;
    return eventQueues[username];
}

app.get('/events', (req, res) => {
    const username = (req.query.user || "souosam25").toLowerCase().replace(/^@/, "");
    const queue = getOrConnectStreamer(username);
    if (!queue) return res.json({ events: [] });

    res.json({ events: queue });
    eventQueues[username] = [];
});

const defaultUsername = "souosam25";
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`[Bridge Server] Rodando na porta ${PORT}`);
    console.log(`[Bridge Server] Canal configurado: @${defaultUsername}`);
    console.log(`========================================\n`);
    getOrConnectStreamer(defaultUsername);
});
