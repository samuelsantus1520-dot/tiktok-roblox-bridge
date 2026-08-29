const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const activeConnections = {};
const eventQueues = {};
const recentGlobalGifts = {}; // Trava global estrita por tipo de presente (bloqueia ecos em menos de 3s)

// Mapeia variações para a chave exata
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

    // --- EVENTO DE PRESENTE COM TRAVA GLOBAL ANTI-DUPLICAÇÃO ---
    tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
        if (data.repeatEnd === false) return;

        const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
        const cleanName = normalizeGiftName(rawGiftName);
        const mappedGift = giftMapping[cleanName];

        if (!mappedGift) {
            console.log(`[${username}][DEBUG] Não mapeado: "${rawGiftName}" (limpo: "${cleanName}")`);
            return;
        }

        // TRAVA GLOBAL: Se o mesmo presente chegou há menos de 3 segundos, o eco do TikTok é descartado na hora
        const giftKey = `${username}_${mappedGift}`;
        const now = Date.now();
        if (recentGlobalGifts[giftKey] && (now - recentGlobalGifts[giftKey] < 3000)) {
            return; 
        }
        recentGlobalGifts[giftKey] = now;

        const userName = data.uniqueId || data.nickname || "Viewer";

        console.log(`[${username}][ANIME] Presente único processado: "${rawGiftName}" -> "${mappedGift}" (${userName})`);
        eventQueues[username].push({ 
            type: 'gift', 
            user: userName, 
            gift: mappedGift, 
            giftName: mappedGift,
            timestamp: now
        });
    });

    // --- EVENTO DE SEGUIDOR (COM LOG DE DEPURAÇÃO SOCIAL) ---
    const handleFollowEvent = (data) => {
        const userName = data.uniqueId || data.nickname || "Novo Seguidor";
        
        const followKey = `${username}_follow_${userName}`;
        const now = Date.now();
        if (recentGlobalGifts[followKey] && (now - recentGlobalGifts[followKey] < 5000)) {
            return;
        }
        recentGlobalGifts[followKey] = now;

        console.log(`[${username}][FOLLOW] Novo Seguidor detectado: ${userName}`);
        eventQueues[username].push({ 
            type: 'follow', 
            user: userName,
            timestamp: now
        });
    };

    tiktokLiveConnection.on(WebcastEvent.FOLLOW, handleFollowEvent);
    
    tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
        // Mostra nos logs do Render o que o TikTok envia no Social para diagnosticarmos o Follow
        console.log(`[${username}][SOCIAL EVENT DEBUG]`, JSON.stringify(data));
        
        const displayType = (data.displayType || "").toLowerCase();
        if (displayType.includes('follow') || displayType.includes('share') || data.actionId === '3') {
            handleFollowEvent(data);
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
