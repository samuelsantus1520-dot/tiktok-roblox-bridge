const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = 3000;

const tiktokUsername = "souosam25";
const tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername, {});

let eventQueue = [];

// Tenta conectar na live (se não estiver online, apenas avisa no console mas o servidor continua rodando)
tiktokLiveConnection.connect().then(state => {
    console.log('[TikTok Bridge] Conectado com sucesso à sala ID: ' + state.roomId);
}).catch(err => {
    console.error('[TikTok Bridge] Aviso: Não foi possível conectar ao TikTok (Modo offline/teste ativo):', err.message);
});

// --- REGRAS DE ANIME E BALANCEAMENTO COMPLETO ---
const giftToAnimeAction = {
    "rosa": { action: "spawn", prefab: "Luffy", message: "ROSA! Luffy Gear 5 (+15)!" },
    "tiktok": { action: "spawn", prefab: "Sonic", message: "TIKTOK! Sonic te jogou para trás (-15)!" },
    "dedo de coracao": { action: "spawn", prefab: "Goku", message: "DEDO DE CORAÇÃO! Goku Kamehameha (+90)!" },
    "carinha verde": { action: "spawn", prefab: "Meteoro", message: "CARINHA VERDE! Meteoro de Pégasus (-90)!" },
    "rosquinha": { action: "spawn", prefab: "Rasengan", message: "ROSQUINHA! Naruto Rasengan supremo (+450)!" },
    "capivara": { action: "spawn", prefab: "Thor", message: "CAPIVARA! Machado do Thor (-450)!" },
    "bone": { action: "spawn", prefab: "Gojo", message: "BONÉ! Gojo Expansão de Domínio (VITÓRIA)!" },
    "chapeu": { action: "spawn", prefab: "SukunaFinger", message: "CHAPÉU! Saitama Soco Sério (INÍCIO)!" },
    "gg": { action: "heal", prefab: "GG", message: "GG! O chat mandou GG e curou o Chefe Sukuna em 5%!" }
};

// Função auxiliar para normalizar o nome (remove acentos e transforma em minúsculo)
function normalizeGiftName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// 1. Captura presentes reais da live do TikTok
tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    if (data.giftType === 1 || data.repeatEnd) {
        const cleanName = normalizeGiftName(data.giftName);
        const actionConfig = giftToAnimeAction[cleanName];
        if (actionConfig) {
            console.log('[ANIME MODE] ' + actionConfig.message + ' (Enviado por: ' + data.uniqueId + ')');
            eventQueue.push({ 
                type: 'gift', 
                user: data.uniqueId, 
                gift: data.giftName, 
                data: actionConfig 
            });
        } else {
            console.log('[TikTok] Presente recebido não mapeado nas regras: ' + data.giftName);
        }
    }
});

// 2. Captura novos seguidores reais da live do TikTok
tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
    if (data.displayType && data.displayType.includes('follow')) {
        console.log('[TIKTOK FOLLOW] Novo seguidor: ' + data.uniqueId);
        eventQueue.push({
            type: 'follow',
            user: data.uniqueId
        });
    }
});

tiktokLiveConnection.on('follow', data => {
    console.log('[TIKTOK FOLLOW] Novo seguidor: ' + data.uniqueId);
    eventQueue.push({
        type: 'follow',
        user: data.uniqueId
    });
});

// --- ROTA DE SIMULAÇÃO (TESTES NO NAVEGADOR) ---
app.get('/simulate', (req, res) => {
    const eventType = req.query.type || "gift";

    if (eventType === "follow") {
        const userName = req.query.user || "ViewerTeste";
        console.log('[TESTE SIMULADO] Disparando Follow de: ' + userName);
        eventQueue.push({
            type: 'follow',
            user: userName
        });
        res.send(`Sucesso! Follow simulado do usuário: "${userName}".`);
        return;
    }

    const rawGift = req.query.gift || "Rosa";
    const cleanName = normalizeGiftName(rawGift);
    const actionConfig = giftToAnimeAction[cleanName];
    
    if (actionConfig) {
        console.log('[TESTE SIMULADO] Disparando Gift: ' + actionConfig.message);
        eventQueue.push({ 
            type: 'gift', 
            user: 'SamuelTester', 
            gift: rawGift, 
            data: actionConfig 
        });
        res.send(`Sucesso! Presente simulado: "${rawGift}" (Mapeado como: ${actionConfig.prefab}).`);
    } else {
        res.send(`Erro: O presente "${rawGift}" não existe nas regras. Opções: rosa, tiktok, dedo de coracao, carinha verde, rosquinha, capivara, bone, chapeu, gg.`);
    }
});

app.get('/events', (req, res) => {
    res.json({ events: eventQueue });
    eventQueue = [];
});

app.listen(PORT, () => {
    console.log('[Bridge Server] Rodando em http://localhost:' + PORT);
    console.log('[DICA DE TESTE GG] Simule com: http://localhost:3000/simulate?gift=gg');
});