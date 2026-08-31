const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;



app.use(express.json());

app.use(express.urlencoded({ extended: true }));



// Armazena as filas de eventos separadas por nome de usuário do TikTok

const eventQueues = {};

const defaultUsername = 'souosam25'; // Seu usuário padrão



// Lista única de streamers que o bot vai conectar simultaneamente

const streamersParaConectar = [defaultUsername, 'maozinha_05'];



// Função auxiliar para padronizar e limpar o nome de usuário (remove '@' e espaços)

function cleanUsername(username) {

    if (!username) return defaultUsername;

    return username.toString().replace(/^@/, '').trim();

}



function addEvent(username, eventData) {

    const userKey = cleanUsername(username);

    if (!eventQueues[userKey]) {

        eventQueues[userKey] = [];

    }

    eventQueues[userKey].push(eventData);

}



// ==========================================

// PAINEL VISUAL DE CONTROLE

// ==========================================



app.get('/', (req, res) => {

    res.send(`

        <!DOCTYPE html>

        <html lang="pt-BR">

        <head>

            <meta charset="UTF-8">

            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <title>Painel de Controle - TikTok Live to Roblox</title>

            <style>

                body {

                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

                    background: #0f0f19;

                    color: #fff;

                    text-align: center;

                    padding: 20px;

                    margin: 0;

                }

                h1 { color: #8a2be2; margin-bottom: 5px; font-size: 24px; }

                p { color: #aaa; font-size: 14px; margin-bottom: 20px; }

                .container {

                    max-width: 550px;

                    margin: 0 auto;

                    background: #1a1a2e;

                    padding: 25px;

                    border-radius: 16px;

                    box-shadow: 0 8px 25px rgba(0,0,0,0.6);

                    border: 1px solid #2a2a40;

                }

                .input-group {

                    margin-bottom: 15px;

                    text-align: left;

                }

                label { font-size: 13px; color: #ccc; font-weight: bold; }

                input {

                    width: 100%;

                    padding: 10px;

                    margin-top: 5px;

                    border-radius: 8px;

                    border: 1px solid #444;

                    background: #111;

                    color: #fff;

                    box-sizing: border-box;

                    font-size: 14px;

                }

                .grid {

                    display: grid;

                    grid-template-columns: repeat(2, 1fr);

                    gap: 12px;

                    margin-top: 20px;

                }

                button {

                    padding: 12px;

                    border: none;

                    border-radius: 8px;

                    font-weight: bold;

                    cursor: pointer;

                    transition: all 0.2s ease;

                    color: white;

                    font-size: 13px;

                }

                button:hover { opacity: 0.85; transform: translateY(-2px); }

                button:active { transform: translateY(0); }

                .btn-gift { background: #6c5ce7; }

                .btn-follow { background: #00b894; grid-column: span 2; font-size: 14px; padding: 14px; }

                #log {

                    margin-top: 20px;

                    font-size: 13px;

                    color: #00ffcc;

                    background: #111118;

                    padding: 10px;

                    border-radius: 6px;

                    border: 1px solid #222;

                    min-height: 20px;

                }

            </style>

        </head>

        <body>

            <div class="container">

                <h1>🎮 Painel TikTok to Roblox</h1>

                <p>Simule eventos em tempo real para qualquer streamer!</p>

                

                <div class="input-group">

                    <label>Usuário do TikTok (Ex: maozinha_05 ou @souosam25):</label>

                    <input type="text" id="streamer" value="maozinha_05">

                </div>

                

                <div class="input-group">

                    <label>Nome de quem enviou o presente:</label>

                    <input type="text" id="viewer" value="JoaoGamer">

                </div>

                

                <div class="grid">

                    <button class="btn-gift" onclick="sendEvent('gift', 'Rosa')">🌹 Rosa (Luffy)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Rosquinha')">🍩 Rosquinha (Rasengan)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Dedo de Coracao')">🫰 Dedo de Coração (Goku)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Carinha Verde')">🟢 Carinha Verde (Meteoro)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Capivara')">🦫 Capivara (Thor)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'TikTok')">🎵 TikTok (MaoPoppy)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Bone')">🧢 Boné (Gojo / Domínio)</button>

                    <button class="btn-gift" onclick="sendEvent('gift', 'Chapeu')">🎩 Chapéu (Sukuna)</button>

                    <button class="btn-follow" onclick="sendEvent('follow', 'Seguiu a live')">👤 Simular Seguidor (Super Pulo)</button>

                </div>

                

                <div id="log">Aguardando ação...</div>

            </div>



            <script>

                function sendEvent(type, details) {

                    const user = document.getElementById('streamer').value;

                    const name = document.getElementById('viewer').value;

                    const url = \`/simulate?user=\${encodeURIComponent(user)}&type=\${type}&name=\${encodeURIComponent(name)}&details=\${encodeURIComponent(details)}\`;

                    

                    fetch(url)

                        .then(response => response.text())

                        .then(data => {

                            document.getElementById('log').innerText = "✅ Sucesso! Enviado para [" + user + "] -> " + details;

                        })

                        .catch(err => {

                            document.getElementById('log').innerText = "❌ Erro ao enviar o evento!";

                        });

                }

            </script>

        </body>

        </html>

    `);

});



app.get('/events', (req, res) => {

    const username = cleanUsername(req.query.user);

    

    if (!eventQueues[username]) {

        eventQueues[username] = [];

    }



    res.json({ events: eventQueues[username] });

    eventQueues[username] = []; 

});



app.get('/simulate', (req, res) => {

    const username = cleanUsername(req.query.user);

    const type = req.query.type || 'follow';

    const name = req.query.name || 'ViewerTeste';

    const details = req.query.details || 'Rosa';



    addEvent(username, {

        type: type,

        user: name,

        gift: details,        

        details: details,      

        timestamp: Date.now()

    });



    res.send(`Evento simulado com sucesso para [${username}]! Tipo: ${type} | Presente: ${details} | Usuário: ${name}`);

});



// ==========================================

// ROTA DE INTEGRAÇÃO COM O TIKFINITY (WEBHOOK)

// ==========================================



app.post('/webhook', (req, res) => {

    const body = req.body;

    

    // O TikFinity costuma enviar o identificador do streamer ou você pode direcionar para o padrão

    const username = cleanUsername(body.uniqueId || body.author || 'souosam25');

    const eventType = body.event || body.type;

    

    // Tratando eventos de Presente (Gift) ou Seguir (Follow) vindos do TikFinity

    if (eventType === 'gift' || body.giftName) {

        addEvent(username, {

            type: 'gift',

            user: body.uniqueId || body.username || 'Espectador',

            gift: body.giftName || 'Presente',

            details: body.giftName || 'Presente',

            timestamp: Date.now()

        });

    } else if (eventType === 'follow' || body.action === 'follow') {

        addEvent(username, {

            type: 'follow',

            user: body.uniqueId || body.username || 'Espectador',

            details: 'Seguiu a transmissão',

            timestamp: Date.now()

        });

    }



    res.status(200).send({ status: 'success' });

});



// ==========================================

// CONEXÃO MULTI-STREAMER COM O TIKTOK LIVE

// ==========================================



function iniciarConexaoTikTok(rawUsername) {

    const username = cleanUsername(rawUsername);

    try {

        const tiktokModule = require('tiktok-live-connector');

        const WebcastPushConnection = tiktokModule.WebcastPushConnection || tiktokModule.default || tiktokModule;



        if (typeof WebcastPushConnection === 'function') {

            const tiktokLiveConnection = new WebcastPushConnection(username);



            tiktokLiveConnection.connect().then(state => {

                console.info(`[TikTok] Conectado com sucesso à live de @${state.roomInfo.owner.uniqueId}`);

            }).catch(err => {

                console.error(`[TikTok] Erro ao conectar na live de @${username}:`, err);

            });



            tiktokLiveConnection.on('chat', data => {

                addEvent(username, {

                    type: 'chat',

                    user: data.uniqueId,

                    details: data.comment

                });

            });



            tiktokLiveConnection.on('gift', data => {

                if (data.giftType === 1 || data.repeatEnd) {

                    addEvent(username, {

                        type: 'gift',

                        user: data.uniqueId,

                        gift: data.giftName,

                        details: data.giftName,

                        diamondCount: data.diamondCount * data.repeatCount

                    });

                }

            });



            tiktokLiveConnection.on('follow', data => {

                addEvent(username, {

                    type: 'follow',

                    user: data.uniqueId,

                    details: 'Seguiu a transmissão'

                });

            });

        } else {

            console.warn(`[TikTok] WebcastPushConnection não pôde ser carregado para @${username}.`);

        }

    } catch (e) {

        console.error(`[TikTok] Erro ao iniciar módulo para @${username}.`, e);

    }

}



streamersParaConectar.forEach((username, index) => {

    const atraso = index * 1000; 

    setTimeout(() => {

        console.log(`[Sistema] Iniciando monitoramento para: @${cleanUsername(username)}`);

        iniciarConexaoTikTok(username);

    }, atraso);

});



app.listen(PORT, () => {

    console.log(`Servidor rodando na porta ${PORT}`);

});
