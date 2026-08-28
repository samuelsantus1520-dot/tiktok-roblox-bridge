const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

// Dicionários para guardar as conexões e filas de cada streamer separadamente
const activeConnections = {};
const eventQueues = {};

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

function normalizeGiftName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Função que conecta no TikTok de um usuário específico sob demanda
function getOrConnectStreamer(username) {
    if (!username) return null;
    
    // Se já estiver conectado para esse usuário, retorna a fila dele
    if (activeConnections[username]) {
        return eventQueues[username];
    }

    console.log(`[TikTok Bridge] Conectando ao canal de: @${username}`);
    const tiktokLiveConnection = new TikTokLiveConnection(username, {});
    eventQueues[username] = [];

    tiktokLiveConnection.connect().then(state => {
        console.log(`[TikTok Bridge] Conectado com sucesso à sala de @${username} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error(`[TikTok Bridge] Erro ao conectar em @${username}:`, err.message);
    });

    // Captura presentes
    tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
        if (data.giftType === 1 || data.repeatEnd) {
            const cleanName = normalizeGiftName(data.giftName);
            const actionConfig = giftToAnimeAction[cleanName];
            if (actionConfig) {
                console.log(`[${username}][ANIME] ` + actionConfig.message + ' (Enviado por: ' + data.uniqueId + ')');
                eventQueues[username].push({ 
                    type: 'gift', 
                    user: data.uniqueId, 
                    gift: data.giftName, 
                    data: actionConfig 
                });
            }
        }
    });

    // Captura seguidores
    tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
        if (data.displayType && data.displayType.includes('follow')) {
            console.log(`[${username}][FOLLOW] Novo seguidor: ` + data.uniqueId);
            eventQueues[username].push({
                type: 'follow',
                user: data.uniqueId
            });
        }
    });

    activeConnections[username] = tiktokLiveConnection;
    return eventQueues[username];
}

// --- ROTA RAIZ (Para o UptimeRobot não marcar como offline) ---
app.get('/', (req, res) => {
    res.send('TikTok Bridge is Online and Working!');
});

// --- ROTA DE EVENTOS PARA O ROBLOX ---
app.get('/events', (req, res) => {
    const username = req.query.user;
    
    if (!username) {
        return res.status(400).json({ error: "Parâmetro 'user' ausente." });
    }

    const queue = getOrConnectStreamer(username);
    
    if (!queue) {
        return res.json({ events: [] });
    }

    res.json({ events: queue });
    // Limpa a fila apenas daquele usuário específico após enviar
    eventQueues[username] = [];
});

// --- ROTA DE SIMULAÇÃO ---
app.get('/simulate', (req, res) => {
    const username = req.query.user || "souosam25";
    const rawGift = req.query.gift || "Rosa";
    const cleanName = normalizeGiftName(rawGift);
    const actionConfig = giftToAnimeAction[cleanName];
    
    const queue = getOrConnectStreamer(username);

    if (actionConfig && queue) {
        queue.push({ 
            type: 'gift', 
            user: 'SamuelTester', 
            gift: rawGift, 
            data: actionConfig 
        });
        res.send(`Sucesso! Presente simulado para @${username}: "${rawGift}".`);
    } else {
        res.send(`Erro ao simular para @${username}. Verifique o presente.`);
    }
});

app.listen(PORT, () => {
    console.log('[Bridge Server] Rodando na porta ' + PORT);
});
