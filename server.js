const express = require('express');

// Correção definitiva para extrair a classe corretamente no Node.js moderno
const tiktokModule = require('tiktok-live-connector');
const WebcastPushConnection = tiktokModule.WebcastPushConnection || tiktokModule.default || tiktokModule;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Armazena as filas de eventos separadas por nome de usuário do TikTok
const eventQueues = {};
const defaultUsername = 'souosam25'; // Seu usuário padrão

function addEvent(username, eventData) {
    const userKey = username || defaultUsername;
    if (!eventQueues[userKey]) {
        eventQueues[userKey] = [];
    }
    eventQueues[userKey].push(eventData);
}

// ==========================================
// ROTAS DO SERVIDOR
// ==========================================

app.get('/', (req, res) => {
    res.send(`
        <h2>TikTok Live to Roblox Bridge está online! 🚀</h2>
        <p>Endpoints disponíveis:</p>
        <ul>
            <li><code>/events?user=seuUsuario</code> - Usado pelo Roblox para buscar eventos.</li>
            <li><code>/simulate?user=seuUsuario&type=follow&name=Viewer1</code> - Usado para testar eventos.</li>
        </ul>
    `);
});

app.get('/events', (req, res) => {
    const username = req.query.user || defaultUsername;
    
    if (!eventQueues[username]) {
        eventQueues[username] = [];
    }

    res.json({ events: eventQueues[username] });
    eventQueues[username] = []; 
});

app.get('/simulate', (req, res) => {
    const username = req.query.user || defaultUsername;
    const type = req.query.type || 'follow';
    const name = req.query.name || 'ViewerTeste';
    const details = req.query.details || 'Rosa';

    addEvent(username, {
        type: type,
        user: name,
        details: details,
        timestamp: Date.now()
    });

    res.send(`Evento simulado com sucesso para [${username}]! Tipo: ${type} | Usuário: ${name}`);
});

// ==========================================
// CONEXÃO COM O TIKTOK LIVE
// ==========================================

const tiktokLiveConnection = new WebcastPushConnection(defaultUsername);

tiktokLiveConnection.connect().then(state => {
    console.info(`[TikTok] Conectado com sucesso à live de @${state.roomInfo.owner.uniqueId}`);
}).catch(err => {
    console.error('[TikTok] Erro ao conectar na live (você ainda pode usar o /simulate se estiver offline):', err);
});

tiktokLiveConnection.on('chat', data => {
    addEvent(defaultUsername, {
        type: 'chat',
        user: data.uniqueId,
        details: data.comment
    });
});

tiktokLiveConnection.on('gift', data => {
    if (data.giftType === 1 || data.repeatEnd) {
        addEvent(defaultUsername, {
            type: 'gift',
            user: data.uniqueId,
            details: data.giftName,
            diamondCount: data.diamondCount * data.repeatCount
        });
    }
});

tiktokLiveConnection.on('follow', data => {
    addEvent(defaultUsername, {
        type: 'follow',
        user: data.uniqueId,
        details: 'Seguiu a transmissão'
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
