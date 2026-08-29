const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const defaultUsername = "souosam25";
const eventQueues = {};
eventQueues[defaultUsername] = [];

// Dicionário completo de todos os seus presentes
const giftToAnimeAction = {
    "rosa": { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" },
    "rose": { action: "spawn", prefab: "Luffy", message: "ROSE! Luffy Gear 5 (+15)!" },
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

console.log(`[TikTok Bridge] Conectando ao canal de: @${defaultUsername}`);
const tiktokLiveConnection = new TikTokLiveConnection(defaultUsername, {});

tiktokLiveConnection.connect().then(state => {
    console.log(`[TikTok Bridge] Conectado com sucesso à sala (ID: ${state.roomId})`);
}).catch(err => {
    console.error(`[TikTok Bridge] Erro ao conectar:`, err.message);
});

// Variável para evitar duplicação de pacotes do TikTok
let lastProcessedMsgId = null;

tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    // Filtro anti-duplicação por ID da mensagem do TikTok
    if (data.msgId && data.msgId === lastProcessedMsgId) return;
    if (data.msgId) lastProcessedMsgId = data.msgId;

    const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
    const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
    const cleanName = normalizeGiftName(rawGiftName);

    let actionConfig = giftToAnimeAction[cleanName];

    // Fallback de segurança caso venha alguma variação de rosa
    if (!actionConfig && cleanName.includes("ros")) {
        actionConfig = { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" };
    }

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
