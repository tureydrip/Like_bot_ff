require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, update, push } = require('firebase/database');

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAgUINb0AxgHXbEld4OJKp9Ha9762s6Ll0",
    authDomain: "sorteo-7d9bc.firebaseapp.com",
    databaseURL: "https://sorteo-7d9bc-default-rtdb.firebaseio.com",
    projectId: "sorteo-7d9bc",
    storageBucket: "sorteo-7d9bc.firebasestorage.app",
    messagingSenderId: "1056098390546",
    appId: "1:1056098390546:web:30fa75d23c491d115e7ecb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const token = process.env.BOT_TOKEN || '8726893067:AAGC_v_RPSAppL9EdBrumsDR1B5DVyiXwN4'; 
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = "7710633235"; 
const ADMIN_WA = "573114998378";
const NEQUI_NUM = "3214701288";
const TASA_DOLAR = 3800;
const MIN_RECARGA = 3;

const userStates = {};

// Menús Separados: Admin vs Usuario
function getMainMenu(chatId) {
    const isOwner = chatId.toString() === ADMIN_ID;
    let keyboard = [];

    if (isOwner) {
        // MENÚ EXCLUSIVO ADMIN
        keyboard = [
            [{ text: "➕ Dar Saldo", callback_data: "admin_add_balance" }, { text: "➖ Quitar Saldo", callback_data: "admin_rem_balance" }],
            [{ text: "📢 Mensaje Global", callback_data: "admin_global" }, { text: "👥 Ver Usuarios", callback_data: "admin_users" }],
            [{ text: "📦 Gestionar Stock (FLUORITE IPA)", callback_data: "admin_manage_stock" }]
        ];
    } else {
        // MENÚ EXCLUSIVO USUARIO
        keyboard = [
            [{ text: "🛍️ Tienda Fluorite", callback_data: "menu_tienda" }, { text: "💳 Recargar Saldo", callback_data: "menu_recargar" }],
            [{ text: "👤 Mi Perfil", callback_data: "menu_perfil" }]
        ];
    }

    return { reply_markup: { inline_keyboard: keyboard } };
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = { step: 'none' };

    if (chatId.toString() === ADMIN_ID) {
        return bot.sendMessage(chatId, `👑 *PANEL DE CONTROL ADMINISTRATIVO*\nAcceso total concedido.`, { 
            parse_mode: 'Markdown', 
            ...getMainMenu(chatId) 
        });
    }

    const welcome = `🌌 *B I E N V E N I D O  A  F L U O R E T E  S H O P* 🌌\n\n` +
                    `⚠️ Para acceder a los servicios, identifícate:`;

    bot.sendMessage(chatId, welcome, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Registrarse", callback_data: "auth_register" }],
                [{ text: "🔐 Iniciar Sesión", callback_data: "auth_login" }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!userStates[chatId]) userStates[chatId] = { step: 'none' };

    // --- ACCIONES DE USUARIO ---
    if (data === "auth_register") {
        userStates[chatId].step = "awaiting_register_username";
        bot.sendMessage(chatId, "📝 Ingresa tu nuevo Nombre de Usuario:");
    } 
    else if (data === "auth_login") {
        userStates[chatId].step = "awaiting_login_username";
        bot.sendMessage(chatId, "🔐 Ingresa tu Nombre de Usuario:");
    }
    else if (data === "menu_perfil") {
        const snapshot = await get(ref(db, `users/${chatId}`));
        if (snapshot.exists()) {
            const user = snapshot.val();
            bot.sendMessage(chatId, `👤 *PERFIL*\n\n💠 User: ${user.username}\n💰 Saldo: $${user.balance} USD`, { parse_mode: 'Markdown' });
        }
    }
    else if (data === "menu_recargar") {
        userStates[chatId].step = "awaiting_recharge_amount";
        bot.sendMessage(chatId, `💳 *Mínimo:* $${MIN_RECARGA} USD ($${(MIN_RECARGA * TASA_DOLAR).toLocaleString()} COP)\nIngresa monto en USD:`);
    }
    else if (data === "menu_tienda") {
        const snapshot = await get(ref(db, 'products/FLUORITE_IPA'));
        if (snapshot.exists()) {
            const product = snapshot.val();
            let msg = `🛍️ *PRODUCTO:* FLUORITE IPA\n\n`;
            for (let dur in product.durations) {
                const stock = product.durations[dur].stock || 0;
                msg += `🔹 *${dur}*\n💸 Precio: $${product.durations[dur].price} USD\n📦 Stock: ${stock} unidades\n\n`;
            }
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "⚠️ Producto no disponible.");
        }
    }

    // --- ACCIONES DE ADMIN ---
    if (chatId.toString() === ADMIN_ID) {
        if (data === "admin_add_balance") {
            userStates[chatId].step = "admin_add_id";
            bot.sendMessage(chatId, "🆔 ID del usuario:");
        }
        else if (data === "admin_rem_balance") {
            userStates[chatId].step = "admin_rem_id";
            bot.sendMessage(chatId, "🆔 ID del usuario:");
        }
        else if (data === "admin_global") {
            userStates[chatId].step = "admin_msg_global";
            bot.sendMessage(chatId, "📢 Escribe el mensaje global:");
        }
        else if (data === "admin_manage_stock") {
            // Inicializar producto si no existe
            const snapshot = await get(ref(db, 'products/FLUORITE_IPA'));
            if (!snapshot.exists()) {
                await set(ref(db, 'products/FLUORITE_IPA'), {
                    name: "FLUORITE IPA",
                    durations: {
                        "1 Mes": { price: 10, stock: 0 },
                        "3 Meses": { price: 25, stock: 0 },
                        "Permanente": { price: 60, stock: 0 }
                    }
                });
            }
            userStates[chatId].step = "admin_pick_duration";
            bot.sendMessage(chatId, "📦 Elige duración para añadir stock:\n(1 Mes, 3 Meses o Permanente)");
        }
        else if (data === "admin_users") {
            const snapshot = await get(ref(db, 'users'));
            if (snapshot.exists()) {
                let list = "👥 *LISTA DE USUARIOS:*\n\n";
                const users = snapshot.val();
                for (let id in users) list += `\`${id}\` - ${users[id].username} ($${users[id].balance})\n`;
                bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
            }
        }
    }
});

bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    if (!userStates[chatId]) return;

    const state = userStates[chatId].step;

    // Lógica de Registro/Login
    if (state === "awaiting_register_username") {
        await set(ref(db, `users/${chatId}`), { username: text, balance: 0 });
        userStates[chatId].step = 'none';
        bot.sendMessage(chatId, `✅ Registrado como ${text}`, getMainMenu(chatId));
    }
    else if (state === "awaiting_login_username") {
        const snapshot = await get(ref(db, `users/${chatId}`));
        if (snapshot.exists() && snapshot.val().username === text) {
            userStates[chatId].step = 'none';
            bot.sendMessage(chatId, `🔓 Bienvenido ${text}`, getMainMenu(chatId));
        } else {
            bot.sendMessage(chatId, "❌ Usuario no coincide.");
        }
    }

    // Lógica de Recarga
    else if (state === "awaiting_recharge_amount") {
        const usd = parseFloat(text);
        if (usd >= MIN_RECARGA) {
            const cop = usd * TASA_DOLAR;
            const link = `https://wa.me/${ADMIN_WA}?text=Hola%20quiero%20recargar%20${usd}%20USD%20ya%20adjunto%20mi%20comprobante`;
            bot.sendMessage(chatId, `📄 *FACTURA*\nMonto: $${usd} USD\nTotal: $${cop.toLocaleString()} COP\n\nNequi: \`${NEQUI_NUM}\``, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: "📲 Enviar Comprobante", url: link }]] }
            });
            userStates[chatId].step = 'none';
        }
    }

    // Lógica Admin
    if (chatId.toString() === ADMIN_ID) {
        if (state === "admin_add_id") {
            userStates[chatId].target = text;
            userStates[chatId].step = "admin_add_amount";
            bot.sendMessage(chatId, "💰 Cantidad USD a agregar:");
        }
        else if (state === "admin_add_amount") {
            const userRef = ref(db, `users/${userStates[chatId].target}`);
            const snap = await get(userRef);
            if (snap.exists()) {
                const newB = snap.val().balance + parseFloat(text);
                await update(userRef, { balance: newB });
                bot.sendMessage(chatId, "✅ Saldo actualizado.");
                bot.sendMessage(userStates[chatId].target, `💎 Se han añadido $${text} USD a tu cuenta.`);
            }
            userStates[chatId].step = 'none';
        }
        else if (state === "admin_pick_duration") {
            userStates[chatId].selectedDur = text;
            userStates[chatId].step = "admin_set_stock";
            bot.sendMessage(chatId, `¿Cuántas unidades de stock añadirás a ${text}?`);
        }
        else if (state === "admin_set_stock") {
            const dur = userStates[chatId].selectedDur;
            const currentSnap = await get(ref(db, `products/FLUORITE_IPA/durations/${dur}`));
            if (currentSnap.exists()) {
                const newStock = (currentSnap.val().stock || 0) + parseInt(text);
                await update(ref(db, `products/FLUORITE_IPA/durations/${dur}`), { stock: newStock });
                bot.sendMessage(chatId, `✅ Stock actualizado: ${newStock} unidades en ${dur}.`, getMainMenu(chatId));
            } else {
                bot.sendMessage(chatId, "❌ Duración no válida. Usa: 1 Mes, 3 Meses o Permanente.");
            }
            userStates[chatId].step = 'none';
        }
        else if (state === "admin_msg_global") {
            const snap = await get(ref(db, 'users'));
            if (snap.exists()) {
                for (let id in snap.val()) bot.sendMessage(id, `📢 *MENSAJE GLOBAL:*\n\n${text}`, { parse_mode: 'Markdown' }).catch(()=>{});
                bot.sendMessage(chatId, "✅ Global enviado.");
            }
            userStates[chatId].step = 'none';
        }
    }
});

console.log("🚀 FLUORETE SHOP OPERATIVO (ADMIN-ONLY MODE ACTIVE)");
