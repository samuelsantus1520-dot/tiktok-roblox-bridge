const express = require('express');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    console.warn(`[TikTok Bridge] Aviso: Não foi possível conectar ao TikTok Live (provavelmente a live está fechada). O modo de simulação via painel web continua funcionando perfeitamente!`);
});

// Cooldown de segurança por Usuário + Presente
const recentGifts = {};

tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
    if (data.repeatEnd === false) {
        return;
    }

    const rawGiftName = data.giftName || (data.gift && data.gift.name) || "";
    const userName = data.uniqueId || data.userId || data.nickname || "Viewer";
    const cleanName = normalizeGiftName(rawGiftName);

    const giftKey = `${userName}_${cleanName}`;
    const now = Date.now();

    if (recentGifts[giftKey] && (now - recentGifts[giftKey] < 2500)) {
        return; 
    }
    recentGifts[giftKey] = now;

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

// ==========================================
// 🛠️ PAINEL DE TESTE / SIMULAÇÃO PARA VÍDEO
// ==========================================

app.post('/simulate', (req, res) => {
    const { type, user, gift } = req.body;
    const userName = user || "ViewerTeste";

    if (type === 'follow') {
        eventQueues[defaultUsername].push({ type: 'follow', user: userName });
        console.log(`[SIMULAÇÃO] Follow adicionado para: ${userName}`);
        return res.json({ success: true, message: `Follow de ${userName} simulado!` });
    } 
    
    if (type === 'gift') {
        const cleanGift = normalizeGiftName(gift || "rosa");
        const mappedGift = giftMapping[cleanGift] || cleanGift;
        eventQueues[defaultUsername].push({ 
            type: 'gift', 
            user: userName, 
            gift: mappedGift, 
            giftName: mappedGift 
        });
        console.log(`[SIMULAÇÃO] Presente simulado: "${mappedGift}" de ${userName}`);
        return res.json({ success: true, message: `Presente ${mappedGift} simulado!` });
    }

    res.status(400).json({ success: false, message: "Tipo de evento inválido." });
});

// Página Web Local de Teste
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Painel de Testes - TikTok Live Bridge</title>
            <style>
                body { font-family: Arial, sans-serif; background: #121212; color: #fff; text-align: center; padding: 40px; }
                h1 { color: #fe2c55; }
                .container { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; max-width: 650px; margin: 0 auto; }
                button { background: #25f4ee; color: #000; border: none; padding: 14px 22px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; transition: 0.2s; }
                button:hover { background: #fe2c55; color: #fff; transform: scale(1.05); }
                .follow-btn { background: #fe2c55; color: #fff; }
                input { padding: 12px; font-size: 16px; border-radius: 5px; border: 1px solid #444; background: #222; color: #fff; margin-bottom: 20px; width: 280px; text-align: center; }
                .log { margin-top: 25px; font-family: monospace; color: #00ffcc; font-size: 15px; }
            </style>
        </head>
        <body>
            <h1>🎮 Painel de Testes TikTok Live</h1>
            <p>Insira o nome do viewer e clique nos botões para acionar os eventos no seu jogo:</p>
            <div>
                <input type="text" id="username" value="SamuelViewer" placeholder="Nome do Viewer"><br>
            </div>
            <div class="container">
                <button class="follow-btn" onclick="sendEvent('follow')">👤 Simular Follow</button>
                <button onclick="sendEvent('gift', 'rosa')">🌹 Rosa</button>
                <button onclick="sendEvent('gift', 'tiktok')">🎵 TikTok</button>
                <button onclick="sendEvent('gift', 'dedo de coracao')">🫶 Dedo de Coração</button>
                <button onclick="sendEvent('gift', 'carinha verde')">🟢 Carinha Verde</button>
                <button onclick="sendEvent('gift', 'rosquinha')">🍩 Rosquinha</button>
                <button onclick="sendEvent('gift', 'capivara')">🦫 Capivara</button>
                <button onclick="sendEvent('gift', 'bone')">🧢 Boné</button>
                <button onclick="sendEvent('gift', 'chapeu')">🎩 Chapéu</button>
            </div>
            <div class="log" id="log">Pronto para testar...</div>

            <script>
                async function sendEvent(type, gift = null) {
                    const user = document.getElementById('username').value || 'ViewerTeste';
                    const response = await fetch('/simulate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, user, gift })
                    });
                    const data = await response.json();
                    document.getElementById('log').innerText = "✔ " + data.message;
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`[Bridge Server] Rodando na porta ${PORT} para @${defaultUsername}`);
    console.log(`👉 Abra no seu navegador para testar visualmente: http://localhost:3000`);
});
