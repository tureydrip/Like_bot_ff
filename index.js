require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, update, push, child } = require('firebase/database');

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

// Token del bot (Se recomienda ponerlo en variables de entorno en Railway)
const token = process.env.BOT_TOKEN || '8726893067:AAGC_v_RPSAppL9EdBrumsDR1B5DVyiXwN4'; 
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = 7710633235;
const ADMIN_WA = "573114998378";
const NEQUI_NUM = "3214701288";
const TASA_DOLAR = 3800;
const MIN_RECARGA = 3;

// Sistema de estados para manejar respuestas a botones
const userStates = {};

// Menú Principal
function getMainMenu(chatId) {
    const isAdmin = chatId === ADMIN_ID;
    const keyboard = [
        [{ text: "🛍️ Tienda Fluorite", callback_data: "menu_tienda" }, { text: "💳 Recargar Saldo", callback_data: "menu_recargar" }],
        [{ text: "👤 Mi Perfil", callback_data: "menu_perfil" }]
    ];

    if (isAdmin) {
        keyboard.push([{ text: "⚙️ PANEL DE ADMINISTRADOR ⚙️", callback_data: "none" }]);
        keyboard.push([{ text: "➕ Dar Saldo", callback_data: "admin_add_balance" }, { text: "➖ Quitar Saldo", callback_data: "admin_rem_balance" }]);
        keyboard.push([{ text: "📢 Mensaje Global", callback_data: "admin_global" }, { text: "👥 Ver Usuarios", callback_data: "admin_users" }]);
        keyboard.push([{ text: "📦 Crear Producto", callback_data: "admin_create_prod" }]);
    }

    return {
        reply_markup: { inline_keyboard: keyboard }
    };
}

// Comando Start - Reconocimiento Automático de Admin
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = { step: 'none' };

    // Verificamos si el que escribe es el dueño (TÚ)
    if (chatId === ADMIN_ID) {
        const adminWelcome = `👑 *¡BIENVENIDO JEFE (ADMIN)!* 👑\n\n` +
                             `Has sido reconocido automáticamente por el sistema.\n` +
                             `Todos los controles de **FLUORETE SHOP** están activos para ti.`;
        
        return bot.sendMessage(chatId, adminWelcome, { 
            parse_mode: 'Markdown', 
            ...getMainMenu(chatId) 
        });
    }

    // Si no es admin, se muestra el mensaje épico y el registro
    const epicMessage = `🌌 *B I E N V E N I D O  A  F L U O R E T E  S H O P* 🌌\n\n` +
                        `⚡️ El sistema definitivo de adquisición y automatización.\n` +
                        `💎 Adquiere tus productos al instante, sin intermediarios.\n\n` +
                        `⚠️ Para continuar en la plataforma, por favor identifícate:`;

    const authKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Registrarse", callback_data: "auth_register" }],
                [{ text: "🔐 Iniciar Sesión", callback_data: "auth_login" }]
            ]
        },
        parse_mode: 'Markdown'
    };

    bot.sendMessage(chatId, epicMessage, authKeyboard);
});

// Manejo de Botones (Inline Queries)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (!userStates[chatId]) userStates[chatId] = { step: 'none' };

    // Autenticación
    if (data === "auth_register") {
        userStates[chatId].step = "awaiting_register_username";
        bot.sendMessage(chatId, "📝 *REGISTRO*\nPor favor, ingresa un *Nombre de Usuario* único:", { parse_mode: 'Markdown' });
    } 
    else if (data === "auth_login") {
        userStates[chatId].step = "awaiting_login_username";
        bot.sendMessage(chatId, "🔐 *INICIO DE SESIÓN*\nIngresa tu *Nombre de Usuario*:", { parse_mode: 'Markdown' });
    }
    
    // Menú de Usuario
    else if (data === "menu_perfil") {
        const userRef = ref(db, `users/${chatId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
            const userData = snapshot.val();
            bot.sendMessage(chatId, `👤 *TU PERFIL*\n\n💠 *Usuario:* ${userData.username}\n💰 *Saldo:* $${userData.balance} USD`, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "⚠️ No estás registrado.");
        }
    }
    else if (data === "menu_recargar") {
        userStates[chatId].step = "awaiting_recharge_amount";
        bot.sendMessage(chatId, `💳 *RECARGA DE SALDO*\n\nIngresa la cantidad en *USD* que deseas recargar.\n⚠️ _Mínimo $${MIN_RECARGA} USD_\n💵 _Tasa de cambio: $${TASA_DOLAR} COP_`, { parse_mode: 'Markdown' });
    }
    else if (data === "menu_tienda") {
        const prodsRef = ref(db, 'products');
        const snapshot = await get(prodsRef);
        if (snapshot.exists()) {
            const products = snapshot.val();
            let msg = "🛍️ *TIENDA FLUORETE*\nSelecciona un producto:\n\n";
            for (let id in products) {
                msg += `🔹 *${products[id].name}*\n`;
                for (let dur in products[id].durations) {
                    msg += `  - ${dur}: $${products[id].durations[dur]} USD\n`;
                }
            }
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, "⚠️ La tienda está vacía por el momento.");
        }
    }

    // Funciones de Admin
    else if (chatId === ADMIN_ID) {
        if (data === "admin_add_balance") {
            userStates[chatId].step = "admin_awaiting_add_id";
            bot.sendMessage(chatId, "➕ Ingresa el *ID del Chat* al que le darás saldo:", { parse_mode: 'Markdown' });
        }
        else if (data === "admin_rem_balance") {
            userStates[chatId].step = "admin_awaiting_rem_id";
            bot.sendMessage(chatId, "➖ Ingresa el *ID del Chat* al que le quitarás saldo:", { parse_mode: 'Markdown' });
        }
        else if (data === "admin_global") {
            userStates[chatId].step = "admin_awaiting_global";
            bot.sendMessage(chatId, "📢 Escribe el mensaje global para enviar a todos:");
        }
        else if (data === "admin_create_prod") {
            userStates[chatId].step = "admin_awaiting_prod_name";
            bot.sendMessage(chatId, "📦 Ingresa el *Nombre del Producto*:", { parse_mode: 'Markdown' });
        }
        else if (data === "admin_users") {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            if (snapshot.exists()) {
                let msg = "👥 *USUARIOS REGISTRADOS*\n\n";
                const users = snapshot.val();
                for (let id in users) {
                    msg += `ID: \`${id}\` | User: ${users[id].username} | Saldo: $${users[id].balance}\n`;
                }
                bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, "No hay usuarios registrados.");
            }
        }
    }
});

// Manejo de entradas de texto (Estados)
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    
    if (!userStates[chatId]) return;

    const state = userStates[chatId].step;

    // --- FLUJO DE AUTENTICACIÓN ---
    if (state === "awaiting_register_username") {
        const username = text;
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        let exists = false;
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            for (let id in users) {
                if (users[id].username.toLowerCase() === username.toLowerCase()) exists = true;
            }
        }

        if (exists) {
            bot.sendMessage(chatId, "❌ Ese usuario ya existe. Intenta con otro:");
        } else {
            await set(ref(db, `users/${chatId}`), {
                username: username,
                balance: 0,
                history: ["Cuenta creada"]
            });
            userStates[chatId].step = 'none';
            bot.sendMessage(chatId, `✅ *Registro Exitoso*\nBienvenido a la élite, ${username}.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
        }
    }

    else if (state === "awaiting_login_username") {
        const username = text;
        const userRef = ref(db, `users/${chatId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists() && snapshot.val().username.toLowerCase() === username.toLowerCase()) {
            userStates[chatId].step = 'none';
            bot.sendMessage(chatId, `✅ *Sesión Iniciada*\nBienvenido de nuevo, ${username}.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
        } else {
            bot.sendMessage(chatId, "❌ Usuario incorrecto o no vinculado a este chat. Intenta de nuevo o regístrate.");
        }
    }

    // --- FLUJO DE RECARGA ---
    else if (state === "awaiting_recharge_amount") {
        const amount = parseFloat(text);
        if (isNaN(amount) || amount < MIN_RECARGA) {
            bot.sendMessage(chatId, `❌ Cantidad inválida. El mínimo es $${MIN_RECARGA} USD. Intenta de nuevo:`);
        } else {
            const totalCop = amount * TASA_DOLAR;
            const formattedCop = totalCop.toLocaleString('es-CO');
            const waText = encodeURIComponent(`Hola quiero recargar ${amount} USD ya adjunto mi comprobante`);
            const waLink = `https://wa.me/${ADMIN_WA}?text=${waText}`;

            const rechargeMsg = `🧾 *FACTURA DE RECARGA*\n\n` +
                                `💵 *Cantidad USD:* $${amount}\n` +
                                `💰 *Total a pagar COP:* $${formattedCop} pesos\n\n` +
                                `🏦 *Método de pago (NEQUI):*\n\`${NEQUI_NUM}\`\n\n` +
                                `⚠️ *IMPORTANTE:*\nRealiza el pago y envía el comprobante directamente al Administrador tocando el botón de abajo.`;

            const waKeyboard = {
                reply_markup: {
                    inline_keyboard: [[{ text: "📲 Enviar Comprobante (WhatsApp)", url: waLink }]]
                },
                parse_mode: 'Markdown'
            };

            userStates[chatId].step = 'none';
            bot.sendMessage(chatId, rechargeMsg, waKeyboard);
            bot.sendMessage(chatId, "Volviendo al menú principal:", getMainMenu(chatId));
        }
    }

    // --- FLUJO DE ADMIN: DAR SALDO ---
    else if (state === "admin_awaiting_add_id") {
        userStates[chatId].tempId = text;
        userStates[chatId].step = "admin_awaiting_add_amount";
        bot.sendMessage(chatId, "Ingresa la cantidad de USD a sumar:");
    }
    else if (state === "admin_awaiting_add_amount") {
        const targetId = userStates[chatId].tempId;
        const amount = parseFloat(text);
        const userRef = ref(db, `users/${targetId}`);
        
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const newBalance = snapshot.val().balance + amount;
                update(userRef, { balance: newBalance });
                bot.sendMessage(chatId, `✅ Saldo agregado. Nuevo saldo de ${targetId}: $${newBalance}`, getMainMenu(chatId));
                bot.sendMessage(targetId, `💎 *¡RECARGA EXITOSA!*\nSe han añadido $${amount} USD a tu cuenta.`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, "❌ Usuario no encontrado.");
            }
        });
        userStates[chatId].step = 'none';
    }

    // --- FLUJO DE ADMIN: QUITAR SALDO ---
    else if (state === "admin_awaiting_rem_id") {
        userStates[chatId].tempId = text;
        userStates[chatId].step = "admin_awaiting_rem_amount";
        bot.sendMessage(chatId, "Ingresa la cantidad de USD a restar:");
    }
    else if (state === "admin_awaiting_rem_amount") {
        const targetId = userStates[chatId].tempId;
        const amount = parseFloat(text);
        const userRef = ref(db, `users/${targetId}`);
        
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                const newBalance = Math.max(0, snapshot.val().balance - amount);
                update(userRef, { balance: newBalance });
                bot.sendMessage(chatId, `✅ Saldo retirado. Nuevo saldo de ${targetId}: $${newBalance}`, getMainMenu(chatId));
            } else {
                bot.sendMessage(chatId, "❌ Usuario no encontrado.");
            }
        });
        userStates[chatId].step = 'none';
    }

    // --- FLUJO DE ADMIN: MENSAJE GLOBAL ---
    else if (state === "admin_awaiting_global") {
        const globalMsg = `📢 *MENSAJE GLOBAL:*\n\n${text}`;
        get(ref(db, 'users')).then((snapshot) => {
            if (snapshot.exists()) {
                const users = snapshot.val();
                for (let id in users) {
                    bot.sendMessage(id, globalMsg, { parse_mode: 'Markdown' }).catch(()=>{});
                }
                bot.sendMessage(chatId, "✅ Mensaje enviado a todos los usuarios.", getMainMenu(chatId));
            }
        });
        userStates[chatId].step = 'none';
    }

    // --- FLUJO DE ADMIN: CREAR PRODUCTO ---
    else if (state === "admin_awaiting_prod_name") {
        userStates[chatId].tempProdName = text;
        userStates[chatId].tempProdDurs = {};
        userStates[chatId].step = "admin_awaiting_prod_dur";
        bot.sendMessage(chatId, "Ingresa la duración (Ejemplo: 1 Mes, 1 Año, Permanente):");
    }
    else if (state === "admin_awaiting_prod_dur") {
        userStates[chatId].currentDur = text;
        userStates[chatId].step = "admin_awaiting_prod_price";
        bot.sendMessage(chatId, `Ingresa el precio en USD para "${text}":`);
    }
    else if (state === "admin_awaiting_prod_price") {
        const price = parseFloat(text);
        const dur = userStates[chatId].currentDur;
        userStates[chatId].tempProdDurs[dur] = price;
        
        // Preguntar si quiere añadir otra duración
        userStates[chatId].step = "admin_awaiting_more_durs";
        bot.sendMessage(chatId, "¿Deseas añadir otra duración para este producto? Responde 'SI' o 'NO'");
    }
    else if (state === "admin_awaiting_more_durs") {
        if (text.toUpperCase() === 'SI') {
            userStates[chatId].step = "admin_awaiting_prod_dur";
            bot.sendMessage(chatId, "Ingresa la nueva duración:");
        } else {
            // Guardar producto
            const prodRef = push(ref(db, 'products'));
            set(prodRef, {
                name: userStates[chatId].tempProdName,
                durations: userStates[chatId].tempProdDurs
            });
            bot.sendMessage(chatId, "✅ Producto creado exitosamente en la tienda.", getMainMenu(chatId));
            userStates[chatId].step = 'none';
        }
    }
});

console.log("🚀 Fluorete Shop Bot Inicializado Correctamente...");
