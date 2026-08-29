const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const defaultUsername = "souosam25";
const eventQueues = {};
eventQueues[defaultUsername] = [];

console.log(`[TikTok Bridge] Conectando ao canal de: @${defaultUsername}`);
const tiktokLiveConnection = new TikTokLiveConnection(defaultUsername, {});

tiktokLiveConnection.connect().then(state => {
    console.log(`[TikTok Bridge] Conectado com sucesso à sala (ID: ${state.roomId})`);
}).catch(err => {
    console.error(`[TikTok Bridge] Erro ao conectar:`, err.message);
});

// CAPTURA QUALQUER PRESENTE E Manda direto para o Roblox
tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    const rawGiftName = data.giftName || (data.gift && data.gift.name) || "Rosa";
    const userName = data.uniqueId || data.userId || data.nickname || "Viewer";

    console.log(`[SUPUERGIFT] Presente recebido: "${rawGiftName}" de ${userName}`);

    const actionConfig = { 
        action: "spawn", 
        prefab: "Luffy", 
        message: "ROSA! Luffy Gear 5 (+15)!" 
    };

    eventQueues[defaultUsername].push({ 
        type: 'gift', 
        user: userName, 
        gift: rawGiftName, 
        data: actionConfig 
    });
});

app.get('/events', (req, res) => {
    res.json({ events: eventQueues[defaultUsername] });
    eventQueues[defaultUsername] = [];
});

app.listen(PORT, () => {
    console.log(`[Bridge Server] Rodando na porta ${PORT} para @${defaultUsername}`);
});
