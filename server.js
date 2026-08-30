const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const defaultUsername = "souosam25";
const eventQueues = {};
eventQueues[defaultUsername] = [];

// Mapeia qualquer variação (Inglês/Português) para a chave exata que o Roblox espera
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

console.log(`[TikTok Bridge] Conectando ao canal de: @${defaultUsername}`);
const tiktokLiveConnection = new TikTokLiveConnection(defaultUsername, {});

tiktokLiveConnection.connect().then(state => {
    console.log(`[TikTok Bridge] Conectado com sucesso à sala (ID: ${state.roomId})`);
}).catch(err => {
    console.error(`[TikTok Bridge] Erro ao conectar:`, err.message);
});

// Cooldown de segurança por Usuário + Presente
const recentGifts = {};

tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    // 🛑 FILTRO ANTI-DUPLICAÇÃO DE STREAK: Ignora pacotes intermediários do TikTok, processando apenas o final do envio
    if (data.repeatEnd === false) {
        return;
    }

    const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
    const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
    const cleanName = normalizeGiftName(rawGiftName);

    // Chave única para o usuário + presente
    const giftKey = `${userName}_${cleanName}`;
    const now = Date.now();

    // Cooldown rigoroso de 2.5 segundos para evitar qualquer disparo duplo consecutivo
    if (recentGifts[giftKey] && (now - recentGifts[giftKey] < 2500)) {
        return; 
    }
    recentGifts[giftKey] = now;

    // Traduz para o padrão que o Roblox entende
    const mappedGift = giftMapping[cleanName];

    if (mappedGift) {
        console.log(`[ANIME] Presente único processado: "${rawGiftName}" -> Roblox: "${mappedGift}" (Enviado por: ${userName})`);
        eventQueues[defaultUsername].push({ 
            type: 'gift', 
            user: userName, 
            gift: mappedGift, 
            giftName: mappedGift 
        });
    } else {
        console.log(`[DEBUG] Presente não mapeado: "${rawGiftName}" (limpo: "${cleanName}")`);
    }
});

// EVENTO DE SEGUIDOR (FOLLOW) - Mantido funcional como estava
tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
    if (data.displayType && data.displayType.includes('follow')) {
        const userName = data.uniqueId || "Viewer";
        console.log(`[FOLLOW] Novo seguidor detectado: ${userName}`);
        eventQueues[defaultUsername].push({ 
            type: 'follow', 
            user: userName 
        });
    }
});

app.get('/events', (req, res) => {
    res.json({ events: eventQueues[defaultUsername] });
    eventQueues[defaultUsername] = [];
});

app.listen(PORT, () => {
    console.log(`[Bridge Server] Rodando na porta ${PORT} para @${defaultUsername}`);
});
