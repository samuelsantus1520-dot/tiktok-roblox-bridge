const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

// --- ESSENCIAL: Permite que o servidor receba dados em JSON do Roblox ---
app.use(express.json());

// --- 1. LISTA DE CLIENTES AUTORIZADOS (WHITELIST) ---
const whitelistAtiva = [
    "souosam25", // O seu próprio perfil para testes
    // Adicione os @ dos seus clientes pagantes aqui embaixo no futuro:
    // "cliente_exemplo",
];

// Dicionários para guardar as conexões e filas de cada streamer separadamente
const activeConnections = {};
const eventQueues = {};

// Mapeamento opcional para guardar qual Roblox User ID está ligado a qual TikTok
const playerTikTokLinks = {};

// --- REGRAS DE ANIME E BALANCEAMENTO COMPLETO ---
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

// --- ROTA PARA RECEBER O VINCULO DO ROBLOX ---
app.post('/vincular-usuario', (req, res) => {
    const { robloxUserId, robloxUserName, tiktokUser } = req.body;

    if (!tiktokUser) {
        return res.status(400).json({ error: "Usuário do TikTok não fornecido." });
    }

    // Limpa o @ se o jogador digitou com ele (ex: "@souosam25" vira "souosam25")
    const cleanTiktok = tiktokUser.replace(/^@/, "").toLowerCase();

    // Valida se está na whitelist
    if (!whitelistAtiva.includes(cleanTiktok)) {
        console.log(`[Vínculo Negado] @${cleanTiktok} tentou conectar, mas não está na whitelist.`);
        return res.status(403).json({ error: "Usuário não autorizado na whitelist." });
    }

    playerTikTokLinks[robloxUserId] = cleanTiktok;
    console.log(`[Vínculo Sucesso] Jogador do Roblox ${robloxUserName} vinculou o TikTok: @${cleanTiktok}`);

    // Já inicia a conexão com a live do TikTok preventivamente
    getOrConnectStreamer(cleanTiktok);

    res.json({ success: true, message: `Vinculado a @${cleanTiktok} com sucesso!` });
});

// --- ROTA DE EVENTOS PARA O ROBLOX (PROTEGIDA POR WHITELIST) ---
app.get('/events', (req, res) => {
    const username = req.query.user;
    
    if (!username) {
        return res.status(400).json({ error: "Parâmetro 'user' ausente." });
    }

    // --- 2. TRAVA DE SEGURANÇA DA MENSALIDADE ---
    const usernameLower = username.toLowerCase().replace(/^@/, "");
    if (!whitelistAtiva.includes(usernameLower)) {
        console.log(`[Bloqueio de Segurança] Acesso negado para: @${username} (Não está na whitelist)`);
        return res.status(403).json({ error: "Acesso negado. Assinatura pendente ou expirada." });
    }

    const queue = getOrConnectStreamer(usernameLower);
    
    if (!queue) {
        return res.json({ events: [] });
    }

    res.json({ events: queue });
    // Limpa a fila apenas daquele usuário específico após enviar
    eventQueues[usernameLower] = [];
});

// --- ROTA DE SIMULAÇÃO ---
app.get('/simulate', (req, res) => {
    const username = (req.query.user || "souosam25").replace(/^@/, "");
    const type = req.query.type || "gift"; // Permite escolher entre 'gift' ou 'follow'
    const queue = getOrConnectStreamer(username);

    if (!queue) {
        return res.send(`Erro ao conectar em @${username}.`);
    }

    if (type === "follow") {
        const followerName = req.query.name || "ViewerSeguidor";
        queue.push({
            type: 'follow',
            user: followerName
        });
        res.send(`Sucesso! Follow simulado para @${username} por "${followerName}".`);
    } else {
        const rawGift = req.query.gift || "Rosa";
        const cleanName = normalizeGiftName(rawGift);
        const actionConfig = giftToAnimeAction[cleanName];

        if (actionConfig) {
            queue.push({ 
                type: 'gift', 
                user: 'SamuelTester', 
                gift: rawGift, 
                data: actionConfig 
            });
            res.send(`Sucesso! Presente simulado para @${username}: "${rawGift}".`);
        } else {
            res.send(`Erro ao simular. Presente inválido: "${rawGift}".`);
        }
    }
});

app.listen(PORT, () => {
    console.log('[Bridge Server] Rodando na porta ' + PORT);
});
