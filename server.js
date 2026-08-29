const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const defaultUsername = "souosam25";
const eventQueues = {};
eventQueues[defaultUsername] = [];

// Dicionário completo cobrindo nomes em Português e Inglês da API do TikTok
const giftToAnimeAction = {
    "rosa": { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" },
    "rose": { action: "spawn", prefab: "Luffy", message: "ROSE! Luffy Gear 5 (+15)!" },
    "tiktok": { action: "spawn", prefab: "MaoPoppy", message: "TIKTOK! Mão do Poppy Playtime te jogou para trás (-15)!" },
    "dedo de coracao": { action: "spawn", prefab: "Goku", message: "DEDO DE CORAÇÃO! Goku Kamehameha (+90)!" },
    "finger heart": { action: "spawn", prefab: "Goku", message: "FINGER HEART! Goku Kamehameha (+90)!" },
    "carinha verde": { action: "spawn", prefab: "Meteoro", message: "CARINHA VERDE! Meteoro de Pégasus (-90)!" },
    "green face": { action: "spawn", prefab: "Meteoro", message: "GREEN FACE! Meteoro de Pégasus (-90)!" },
    "rosquinha": { action: "spawn", prefab: "Rasengan", message: "ROSQUINHA! Naruto Rasengan supremo (+450)!" },
    "donut": { action: "spawn", prefab: "Rasengan", message: "DONUT! Naruto Rasengan supremo (+450)!" },
    "doughnut": { action: "spawn", prefab: "Rasengan", message: "DOUGHNUT! Naruto Rasengan supremo (+450)!" },
    "capivara": { action: "spawn", prefab: "Thor", message: "CAPIVARA! Machado do Thor (-450)!" },
    "capybara": { action: "spawn", prefab: "Thor", message: "CAPYBARA! Machado do Thor (-450)!" },
    "bone": { action: "spawn", prefab: "Gojo", message: "BONÉ! Gojo Expansão de Domínio (VITÓRIA)!" },
    "cap": { action: "spawn", prefab: "Gojo", message: "CAP! Gojo Expansão de Domínio (VITÓRIA)!" },
    "chapeu": { action: "spawn", prefab: "SukunaFinger", message: "CHAPÉU! Saitama Soco Sério (INÍCIO)!" },
    "hat": { action: "spawn", prefab: "SukunaFinger", message: "HAT! Saitama Soco Sério (INÍCIO)!" }
};

function normalizeGiftName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

console.log(`[TikTok Bridge] Conectando ao canal de: @${defaultUsername}`);
const tiktokLiveConnection = new TikTokLiveConnection(defaultUsername, {});

tiktokLiveConnection.connect().then(state => {
    console.log(`[TikTok Bridge] Conectado com sucesso à sala (ID: ${state.roomId})`);
}).catch(err => {
    console.error(`[TikTok Bridge] Erro ao conectar:`, err.message);
});

// Controle de Anti-Duplicação por Tempo (Bloqueia repetições em menos de 2 segundos)
const recentGifts = {};

tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
    const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
    const cleanName = normalizeGiftName(rawGiftName);

    // Trava anti-duplicação baseada no usuário + nome do presente
    const giftKey = `${userName}_${cleanName}`;
    const now = Date.now();
    if (recentGifts[giftKey] && (now - recentGifts[giftKey] < 2000)) {
        return; // Descarta pacotes duplicados vindos muito rápido
    }
    recentGifts[giftKey] = now;

    let actionConfig = giftToAnimeAction[cleanName];

    if (actionConfig) {
        console.log(`[ANIME] ${actionConfig.message} (Enviado por: ${userName})`);
        eventQueues[defaultUsername].push({ 
            type: 'gift', 
            user: userName, 
            gift: rawGiftName, 
            data: actionConfig 
        });
    } else {
        console.log(`[DEBUG] Presente não mapeado: "${rawGiftName}" (limpo: "${cleanName}")`);
    }
});

app.get('/events', (req, res) => {
    res.json({ events: eventQueues[defaultUsername] });
    eventQueues[defaultUsername] = [];
});

app.listen(PORT, () => {
    console.log(`[Bridge Server] Rodando na porta ${PORT} para @${defaultUsername}`);
});
