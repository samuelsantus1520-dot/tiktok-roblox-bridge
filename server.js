const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. LISTA DE CLIENTES AUTORIZADOS (Quem pagou pelo pacote)
// Sempre que vender para alguém novo, basta adicionar o @ aqui e subir no Render.
const authorizedClients = [
    "souosam25",
    // "cliente_exemplo_1",
    // "outro_cliente"
];

// Armazena as conexões ativas e as filas de eventos separadas por streamer
const activeConnections = {};
const eventQueues = {};

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

// 2. FUNÇÃO QUE CONECTA NO TIKTOK LIVE DE UM CLIENTE ESPECÍFICO
function setupUserConnection(username) {
    if (activeConnections[username]) return; // Evita abrir conexões duplicadas para o mesmo usuário

    console.log(`[TikTok Bridge] Inicializando conexão para o canal de: @${username}`);
    const tiktokLiveConnection = new TikTokLiveConnection(username, {});
    
    eventQueues[username] = [];
    activeConnections[username] = tiktokLiveConnection;

    tiktokLiveConnection.connect().then(state => {
        console.log(`[TikTok Bridge] Conectado com sucesso à sala de @${username} (ID: ${state.roomId})`);
    }).catch(err => {
        console.error(`[TikTok Bridge] Erro ao conectar em @${username}:`, err.message);
        delete activeConnections[username]; // Permite tentar novamente depois se cair
    });

    // Cooldown rigoroso de 3 segundos por Usuário + Presente
    const recentGifts = {};

    tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
        const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
        const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
        const cleanName = normalizeGiftName(rawGiftName);

        const giftKey = `${userName}_${cleanName}`;
        const now = Date.now();

        if (recentGifts[giftKey] && (now - recentGifts[giftKey] < 3000)) {
            return; 
        }
        recentGifts[giftKey] = now;

        const mappedGift = giftMapping[cleanName];

        if (mappedGift) {
            console.log(`[@${username}] Presente processado: "${rawGiftName}" -> Roblox: "${mappedGift}" (Enviado por: ${userName})`);
            if (eventQueues[username]) {
                eventQueues[username].push({ 
                    type: 'gift', 
                    user: userName, 
                    gift: mappedGift, 
                    giftName: mappedGift 
                });
            }
        } else {
            console.log(`[@${username}][DEBUG] Presente não mapeado: "${rawGiftName}"`);
        }
    });

    // EVENTO DE SEGUIDOR (FOLLOW)
    tiktokLiveConnection.on(WebcastEvent.SOCIAL, data => {
        if (data.displayType && data.displayType.includes('follow')) {
            const userName = data.uniqueId || "Viewer";
            console.log(`[@${username}][FOLLOW] Novo seguidor detectado: ${userName}`);
            if (eventQueues[username]) {
                eventQueues[username].push({ 
                    type: 'follow', 
                    user: userName 
                });
            }
        }
    });
}

// 3. ENDPOINT DINÂMICO PARA O ROBLOX BUSCAR OS EVENTOS
app.get('/events', (req, res) => {
    const username = req.query.user;

    // Valida se mandou o parâmetro do usuário
    if (!username) {
        return res.status(400).json({ error: "Usuário não informado na URL." });
    }

    // Trava de segurança: Se o usuário não pagou, bloqueia na hora!
    if (!authorizedClients.includes(username)) {
        console.log(`[Segurança] Acesso negado para o usuário não autorizado: @${username}`);
        return res.status(403).json({ error: "Acesso não autorizado. Adquira o pacote!" });
    }

    // Se o cliente é válido mas ainda não abriu a live dele no servidor, abre agora sob demanda
    if (!activeConnections[username]) {
        setupUserConnection(username);
    }

    // Retorna os eventos acumulados daquele cliente específico e limpa a fila dele
    const events = eventQueues[username] || [];
    eventQueues[username] = [];
    
    res.json({ events });
});

app.listen(PORT, () => {
    console.log(`[Bridge Server Multi-Streamer] Rodando na porta ${PORT}`);
});
