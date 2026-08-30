const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Armazena as filas de eventos separadas por nome de usuário do TikTok
const eventQueues = {};
const defaultUsername = 'souosam25'; // Seu usuário padrão

// Função auxiliar para adicionar um evento na fila do usuário correto
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

// Rota principal (Página inicial simples)
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

// Rota que o Roblox vai acessar via HttpService a cada X segundos
app.get('/events', (req, res) => {
    const username = req.query.user || defaultUsername;
    
    if (!eventQueues[username]) {
        eventQueues[username] = [];
    }

    // Retorna os eventos acumulados e limpa a fila imediatamente
    res.json({ events: eventQueues[username] });
    eventQueues[username] = []; 
});

// Rota de Simulação (Para testar no navegador sem live real)
app.get('/simulate', (req, res) => {
    const username = req.query.user || defaultUsername;
    const type = req.query.type || 'follow'; // 'follow', 'gift', 'chat'
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

// Evento de Chat
tiktokLiveConnection.on('chat', data => {
    addEvent(defaultUsername, {
        type: 'chat',
        user: data.uniqueId,
        details: data.comment
    });
});

// Evento de Presentes (Gifts)
tiktokLiveConnection.on('gift', data => {
    // Filtra para pegar apenas presentes válidos ou fim de combos para não duplicar
    if (data.giftType === 1 || data.repeatEnd) {
        addEvent(defaultUsername, {
            type: 'gift',
            user: data.uniqueId,
            details: data.giftName,
            diamondCount: data.diamondCount * data.repeatCount
        });
    }
});

// Evento de Follow (Seguir)
tiktokLiveConnection.on('follow', data => {
    addEvent(defaultUsername, {
        type: 'follow',
        user: data.uniqueId,
        details: 'Seguiu a transmissão'
    });
});

// Inicializar o servidor na porta definida
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT} no seu navegador para testar.`);
});
