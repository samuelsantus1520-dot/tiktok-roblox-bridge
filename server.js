const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const activeConnections = {};
const eventQueues = {};
const processedMsgIds = {};
const recentGifts = {}; // Trava de tempo de segurança

const giftMapping = {
    "rosa": "rosa",
    "rose": "rosa",
    "tiktok": "tiktok",
    "dedo de coracao": "dedo de coracao",
    "finger heart": "dedo de coracao",
    "carinha verde": "carinha verde",
    "green face": "carinha verde",
    "rosquinha": "rosquinha",
    "donut": "rosquinha",
    "doughnut": "rosquinha",
    "capivara": "capivara",
    "capybara": "capivara",
    "bone": "bone",
    "cap": "bone",
    "chapeu": "chapeu",
    "hat": "chapeu"
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

    // EVENTO DE PRESENTE COM DUPLA TRAVA (msgId + Cooldown de 3s)
    tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
        if (data.repeatEnd === false) return;

        const msgId = data.msgId;
        const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
        const userName = data.uniqueId || data.nickname || "Viewer";
        const cleanName = normalizeGiftName(rawGiftName);

        // Trava 1: Se o ID da mensagem já foi processado
        if (msgId && processedMsgIds[msgId]) {
            return;
        }

        // Trava 2: Cooldown estricto de 3 segundos por usuário + presente (caso o ID venha vazio/N/A)
        const giftKey = `${username}_${userName}_${cleanName}`;
        const now = Date.now();
        if (recentGifts[giftKey] && (now - recentGifts[giftKey] < 3000)) {
            return;
        }
        recentGifts[giftKey] = now;

        if (msgId) {
            processedMsgIds[msgId] = true;
            const keys = Object.keys(processedMsgIds);
            if (keys.length > 300) {
                delete processedMsgIds[keys[0]];
            }
        }

        const mappedGift = giftMapping[cleanName];

        if (mappedGift) {
            console.log(`[${username}][ANIME] Processado: "${rawGiftName}" -> "${mappedGift}" (${userName})`);
            eventQueues[username].push({ 
                type: 'gift', 
                user: userName, 
                gift: mappedGift, 
                giftName: mappedGift 
            });
        } else {
            console.log(`[${username}][DEBUG] Não mapeado: "${rawGiftName}" (limpo: "${cleanName}")`);
        }
    });

    // EVENTO DE SEGUIDOR (SOCIAL) MAIS FLEXÍVEL
    tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
        console.log(`[${username}][SOCIAL EVENT]`, JSON.stringify(data)); // Ajuda a debugar nos logs do Render
        
        const displayType = (data.displayType || "").toLowerCase();
        if (displayType.includes('follow') || displayType.includes('share') || data.actionId === '3') {
            const userName = data.uniqueId || data.nickname || "Viewer";
            console.log(`[${username}][FOLLOW] Novo seguidor confirmado: ${userName}`);
            eventQueues[username].push({ 
                type: 'follow', 
                user: userName 
            });
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

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`[Bridge Server] Rodando na nuvem na porta ${PORT}`);
    console.log(`========================================\n`);
    getOrConnectStreamer("souosam25");
});
