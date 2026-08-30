const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');
const app = express();

app.use(express.json());

// Armazena as instâncias ativas do TikTokLive e as filas de eventos por usuário
const activeConnections = {};
const eventQueues = {};

/**
 * Função para garantir que existe uma conexão ativa com a live do usuário do TikTok
 */
function ensureTikTokConnection(username) {
    // Se já existe uma conexão ativa ou em andamento, não faz nada
    if (activeConnections[username]) {
        return;
    }

    console.log(`[TikTok] Iniciando conexão para o streamer: ${username}`);
    const tiktokLiveConnection = new WebcastPushConnection(username);

    activeConnections[username] = tiktokLiveConnection;
    if (!eventQueues[username]) {
        eventQueues[username] = [];
    }

    // Conectando à live
    tiktokLiveConnection.connect().then(state => {
        console.log(`[TikTok] Conectado com sucesso à live de @${username} (Room ID: ${state.roomId})`);
    }).catch(err => {
        console.error(`[TikTok] Erro ao conectar na live de @${username}:`, err);
        // Remove da lista para permitir novas tentativas caso o cliente tente novamente
        delete activeConnections[username];
    });

    // --- EVENTOS DO TIKTOK ---

    tiktokLiveConnection.on('chat', data => {
        const event = { type: 'chat', user: data.uniqueId, comment: data.comment };
        eventQueues[username].push(event);
    });

    tiktokLiveConnection.on('gift', data => {
        // Ignora múltiplos pacotes de um mesmo gift contínuo se necessário
        if (data.giftType === 1 && !data.repeatEnd) return;

        const event = { 
            type: 'gift', 
            user: data.uniqueId, 
            giftName: data.giftName, 
            count: data.repeatCount || 1 
        };
        eventQueues[username].push(event);
    });

    tiktokLiveConnection.on('like', data => {
        const event = { type: 'like', user: data.uniqueId, count: data.likeCount };
        eventQueues[username].push(event);
    });

    tiktokLiveConnection.on('disconnected', () => {
        console.log(`[TikTok] Desconectado da live de @${username}`);
        delete activeConnections[username];
    });
}

/**
 * Rota que o Roblox consome para buscar os eventos (Long Polling)
 * Exemplo de uso: /events?user=nome_do_streamer
 */
app.get('/events', (req, res) => {
    const username = req.query.user;

    if (!username) {
        return res.status(400).json({ error: 'O parâmetro "user" é obrigatório.' });
    }

    // Garante que o servidor está escutando o TikTok deste usuário
    ensureTikTokConnection(username);

    // Pega os eventos acumulados na fila desse usuário e limpa a fila
    const queue = eventQueues[username] || [];
    eventQueues[username] = [];

    res.json({ events: queue });
});

/**
 * Rota para simulação de eventos via painel de testes (opcional)
 */
app.post('/simulate', (req, res) => {
    const { user, type, comment, giftName, count } = req.body;
    
    if (!user) {
        return res.status(400).json({ error: 'O campo "user" é obrigatório.' });
    }

    if (!eventQueues[user]) {
        eventQueues[user] = [];
    }

    eventQueues[user].push({ type, user, comment, giftName, count });
    res.json({ success: true, message: `Evento simulado adicionado para @${user}!` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor multicliente rodando na porta ${PORT}`);
});
