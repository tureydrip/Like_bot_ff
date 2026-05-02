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
        // MENÚ EXCLUSIVO ADMIN TOTALMENTE DINÁMICO
        keyboard = [
            [{ text: "⚙️ PANEL DE ADMINISTRADOR ⚙️", callback_data: "none" }],
            [{ text: "➕ Dar Saldo", callback_data: "admin_add_balance" }, { text: "➖ Quitar Saldo", callback_data: "admin_rem_balance" }],
            [{ text: "📢 Mensaje Global", callback_data: "admin_global" }, { text: "👥 Ver Usuarios", callback_data: "admin_users" }],
            [{ text: "🏷️ Crear/Editar Precio (FLUORITE)", callback_data: "admin_create_dur" }],
            [{ text: "📦 Agregar Stock (FLUORITE)", callback_data: "admin_manage_stock" }]
        ];
    } else {
        // MENÚ EXCLUSIVO USUARIO
        keyboard = [
            [{ text: "🛍️ Tienda Fluorite", callback_data: "menu_tienda" }],
            [{ text: "💳 Recargar Saldo", callback_data: "menu_recargar" }, { text: "👤 Mi Perfil", callback_data: "menu_perfil" }]
        ];
    }

    return { reply_markup: { inline_keyboard: keyboard } };
}

bot.onText(/\/start/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        userStates[chatId] = { step: 'none' };

        if (chatId.toString() === ADMIN_ID) {
            return bot.sendMessage(chatId, `👑 *PANEL DE CONTROL ADMINISTRATIVO*\nAcceso total concedido jefe.`, { 
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
    } catch (e) { console.error(e); }
});

bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (!userStates[chatId]) userStates[chatId] = { step: 'none' };

        // --- ACCIONES DE AUTENTICACIÓN ---
        if (data === "auth_register") {
            userStates[chatId].step = "reg_username";
            bot.sendMessage(chatId, "📝 *REGISTRO*\nIngresa un *Nombre de Usuario* nuevo:", { parse_mode: 'Markdown' });
        } 
        else if (data === "auth_login") {
            userStates[chatId].step = "log_username";
            bot.sendMessage(chatId, "🔐 *INICIO DE SESIÓN*\nIngresa tu *Nombre de Usuario*:", { parse_mode: 'Markdown' });
        }
        
        // --- ACCIONES DE USUARIO ---
        else if (data === "menu_perfil") {
            const snapshot = await get(ref(db, `users/${chatId}`));
            if (snapshot.exists()) {
                const user = snapshot.val();
                bot.sendMessage(chatId, `👤 *PERFIL*\n\n💠 User: ${user.username}\n💰 Saldo: $${user.balance} USD\n🆔 ID: \`${chatId}\``, { parse_mode: 'Markdown' });
            }
        }
        else if (data === "menu_recargar") {
            userStates[chatId].step = "awaiting_recharge_amount";
            bot.sendMessage(chatId, `💳 *Mínimo:* $${MIN_RECARGA} USD ($${(MIN_RECARGA * TASA_DOLAR).toLocaleString('es-CO')} COP)\nIngresa el monto en USD que deseas recargar:`);
        }
        else if (data === "menu_tienda") {
            const snapshot = await get(ref(db, 'products/FLUORITE_IPA/durations'));
            if (snapshot.exists()) {
                const durations = snapshot.val();
                let msg = `🛍️ *PRODUCTO: FLUORITE IPA*\nSelecciona la duración que deseas comprar:\n\n`;
                let keyboard = [];

                for (let dur in durations) {
                    const price = durations[dur].price;
                    const stock = durations[dur].stock || 0;
                    
                    if (stock > 0) {
                        keyboard.push([{ 
                            text: `🛒 ${dur} - $${price} USD (Stock: ${stock})`, 
                            callback_data: `buy_${dur}` 
                        }]);
                    } else {
                        msg += `❌ *${dur}* - Agotado\n`;
                    }
                }

                if (keyboard.length === 0) {
                    bot.sendMessage(chatId, "⚠️ No hay stock disponible por el momento.");
                } else {
                    bot.sendMessage(chatId, msg, { 
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                }
            } else {
                bot.sendMessage(chatId, "⚠️ Producto no configurado por el administrador aún.");
            }
        }
        // Lógica de Compra con Botones
        else if (data.startsWith("buy_")) {
            const duration = data.split("buy_")[1];
            
            const userSnap = await get(ref(db, `users/${chatId}`));
            const prodSnap = await get(ref(db, `products/FLUORITE_IPA/durations/${duration}`));

            if (userSnap.exists() && prodSnap.exists()) {
                const user = userSnap.val();
                const prod = prodSnap.val();

                if (prod.stock <= 0) {
                    bot.sendMessage(chatId, "❌ Se agotó el stock justo ahora.");
                    return;
                }

                if (user.balance >= prod.price) {
                    const newBalance = user.balance - prod.price;
                    const newStock = prod.stock - 1;

                    await update(ref(db, `users/${chatId}`), { balance: newBalance });
                    await update(ref(db, `products/FLUORITE_IPA/durations/${duration}`), { stock: newStock });

                    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nHas adquirido *FLUORITE IPA (${duration})*.\nSe descontaron $${prod.price} USD de tu saldo.\nNuevo saldo: $${newBalance} USD.\n\n_(Pega aquí el enlace de descarga o instrucciones)_`, { parse_mode: 'Markdown' });
                    bot.sendMessage(ADMIN_ID, `💰 *NUEVA VENTA*\nUsuario: ${user.username} (${chatId})\nCompró: FLUORITE IPA - ${duration}\nPagó: $${prod.price} USD`, { parse_mode: 'Markdown' }).catch(()=>{});
                } else {
                    bot.sendMessage(chatId, `❌ *Saldo insuficiente.*\nNecesitas $${prod.price} USD y tienes $${user.balance} USD.`, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: "💳 Recargar Ahora", callback_data: "menu_recargar" }]] }
                    });
                }
            }
        }

        // --- ACCIONES DE ADMIN ---
        if (chatId.toString() === ADMIN_ID) {
            if (data === "admin_add_balance") {
                userStates[chatId].step = "admin_add_id";
                bot.sendMessage(chatId, "🆔 Envía el ID del usuario al que le darás saldo:");
            }
            else if (data === "admin_rem_balance") {
                userStates[chatId].step = "admin_rem_id";
                bot.sendMessage(chatId, "🆔 Envía el ID del usuario al que le quitarás saldo:");
            }
            else if (data === "admin_global") {
                userStates[chatId].step = "admin_msg_global";
                bot.sendMessage(chatId, "📢 Escribe el mensaje global para enviar a todos:");
            }
            else if (data === "admin_create_dur") {
                userStates[chatId].step = "admin_awaiting_dur_name";
                bot.sendMessage(chatId, "🏷️ Escribe el *Nombre de la Duración* (Ejemplo: 1 Día, 1 Semana, VIP):", { parse_mode: 'Markdown' });
            }
            else if (data === "admin_manage_stock") {
                const snapshot = await get(ref(db, 'products/FLUORITE_IPA/durations'));
                if (snapshot.exists()) {
                    const durations = snapshot.val();
                    let keyboard = [];
                    for (let dur in durations) {
                        keyboard.push([{ text: `📦 Añadir a: ${dur}`, callback_data: `stock_${dur}` }]);
                    }
                    bot.sendMessage(chatId, "Selecciona la duración a la que le añadirás stock:", {
                        reply_markup: { inline_keyboard: keyboard }
                    });
                } else {
                    bot.sendMessage(chatId, "⚠️ Primero debes crear una duración/precio con el botón '🏷️ Crear/Editar Precio'.");
                }
            }
            else if (data.startsWith("stock_")) {
                const dur = data.split("stock_")[1];
                userStates[chatId].selectedDur = dur;
                userStates[chatId].step = "admin_set_stock";
                bot.sendMessage(chatId, `¿Cuántas unidades vas a sumar al stock de *${dur}*?`, { parse_mode: 'Markdown' });
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
    } catch (error) { console.error("Error en callback:", error); }
});

bot.on('message', async (msg) => {
    try {
        if (!msg.text || msg.text.startsWith('/')) return;
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        if (!userStates[chatId]) return;

        const state = userStates[chatId].step;

        // --- LÓGICA DE REGISTRO ---
        if (state === "reg_username") {
            const usersRef = ref(db, 'users');
            const snapshot = await get(usersRef);
            let exists = false;
            
            if (snapshot.exists()) {
                const users = snapshot.val();
                for (let id in users) {
                    if (users[id].username.toLowerCase() === text.toLowerCase()) exists = true;
                }
            }

            if (exists) {
                bot.sendMessage(chatId, "❌ Ese usuario ya existe. Intenta con otro:");
            } else {
                userStates[chatId].tempUser = text;
                userStates[chatId].step = "reg_password";
                bot.sendMessage(chatId, `🔑 Excelente, ${text}. Ahora ingresa una *Contraseña* para tu cuenta:`, { parse_mode: 'Markdown' });
            }
        }
        else if (state === "reg_password") {
            await set(ref(db, `users/${chatId}`), { 
                username: userStates[chatId].tempUser, 
                password: text, 
                balance: 0 
            });
            userStates[chatId].step = 'none';
            bot.sendMessage(chatId, `✅ *¡Registro Exitoso!*\nBienvenido a la plataforma. Ya puedes acceder a la tienda.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
        }

        // --- LÓGICA DE LOGIN ---
        else if (state === "log_username") {
            userStates[chatId].tempUser = text;
            userStates[chatId].step = "log_password";
            bot.sendMessage(chatId, "🔑 Ingresa tu *Contraseña*:", { parse_mode: 'Markdown' });
        }
        else if (state === "log_password") {
            const snapshot = await get(ref(db, `users/${chatId}`));
            if (snapshot.exists()) {
                const user = snapshot.val();
                if (user.username.toLowerCase() === userStates[chatId].tempUser.toLowerCase() && user.password === text) {
                    userStates[chatId].step = 'none';
                    bot.sendMessage(chatId, `🔓 *Acceso Concedido*\nBienvenido de vuelta, ${user.username}.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
                } else {
                    bot.sendMessage(chatId, "❌ Contraseña o usuario incorrectos. Intenta iniciar sesión de nuevo.");
                    userStates[chatId].step = 'none';
                }
            } else {
                bot.sendMessage(chatId, "❌ No se encontró ninguna cuenta vinculada a este chat. Regístrate primero.");
                userStates[chatId].step = 'none';
            }
        }

        // --- LÓGICA DE RECARGA ---
        else if (state === "awaiting_recharge_amount") {
            const usd = parseFloat(text);
            if (isNaN(usd) || usd < MIN_RECARGA) {
                bot.sendMessage(chatId, `❌ Monto inválido. El mínimo es $${MIN_RECARGA} USD.`);
            } else {
                const cop = usd * TASA_DOLAR;
                const link = `https://wa.me/${ADMIN_WA}?text=Hola%20quiero%20recargar%20${usd}%20USD%20ya%20adjunto%20mi%20comprobante`;
                
                bot.sendMessage(chatId, `📄 *FACTURA DE COMPRA*\n\n💵 Monto: $${usd} USD\n💰 Total: $${cop.toLocaleString('es-CO')} COP\n\n🏦 *Nequi:* \`${NEQUI_NUM}\`\n\n⚠️ Toca el botón de abajo para enviar el comprobante directamente al administrador por WhatsApp.`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: "📲 Enviar Comprobante (WhatsApp)", url: link }]] }
                });
                userStates[chatId].step = 'none';
                bot.sendMessage(chatId, "Volviendo al menú principal:", getMainMenu(chatId));
            }
        }

        // --- LÓGICA ADMIN ---
        if (chatId.toString() === ADMIN_ID) {
            // Crear/Editar Duración y Precio
            if (state === "admin_awaiting_dur_name") {
                userStates[chatId].tempDurName = text;
                userStates[chatId].step = "admin_awaiting_dur_price";
                bot.sendMessage(chatId, `💸 Ingresa el *Precio en USD* para "${text}":`, { parse_mode: 'Markdown' });
            }
            else if (state === "admin_awaiting_dur_price") {
                const price = parseFloat(text);
                if (!isNaN(price)) {
                    const durName = userStates[chatId].tempDurName;
                    
                    // Aseguramos que la estructura inicial exista
                    const nameRef = ref(db, 'products/FLUORITE_IPA/name');
                    await set(nameRef, "FLUORITE IPA");

                    // Recuperar el stock actual si existe, si no, es 0
                    const durRef = ref(db, `products/FLUORITE_IPA/durations/${durName}`);
                    const snap = await get(durRef);
                    const currentStock = snap.exists() ? (snap.val().stock || 0) : 0;

                    await update(durRef, { price: price, stock: currentStock });
                    
                    bot.sendMessage(chatId, `✅ *Duración Guardada*\nNombre: ${durName}\nPrecio: $${price} USD\n(Recuerda agregarle stock desde el menú principal si es nueva)`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
                } else {
                    bot.sendMessage(chatId, "❌ El precio debe ser un número válido. Intenta de nuevo.");
                }
                userStates[chatId].step = 'none';
            }
            
            // Añadir Saldo
            else if (state === "admin_add_id") {
                userStates[chatId].target = text;
                userStates[chatId].step = "admin_add_amount";
                bot.sendMessage(chatId, "💰 Cantidad de USD a agregar:");
            }
            else if (state === "admin_add_amount") {
                const amount = parseFloat(text);
                const userRef = ref(db, `users/${userStates[chatId].target}`);
                const snap = await get(userRef);
                if (snap.exists() && !isNaN(amount)) {
                    const newB = snap.val().balance + amount;
                    await update(userRef, { balance: newB });
                    bot.sendMessage(chatId, `✅ Saldo actualizado. Nuevo balance: $${newB}`, getMainMenu(chatId));
                    bot.sendMessage(userStates[chatId].target, `💎 *¡RECARGA EXITOSA!*\nSe han añadido $${amount} USD a tu cuenta.`, { parse_mode: 'Markdown' }).catch(()=>{});
                } else {
                    bot.sendMessage(chatId, "❌ Error. Verifica el ID o la cantidad.");
                }
                userStates[chatId].step = 'none';
            }
            
            // Quitar Saldo
            else if (state === "admin_rem_id") {
                userStates[chatId].target = text;
                userStates[chatId].step = "admin_rem_amount";
                bot.sendMessage(chatId, "💰 Cantidad de USD a quitar:");
            }
            else if (state === "admin_rem_amount") {
                const amount = parseFloat(text);
                const userRef = ref(db, `users/${userStates[chatId].target}`);
                const snap = await get(userRef);
                if (snap.exists() && !isNaN(amount)) {
                    const newB = Math.max(0, snap.val().balance - amount);
                    await update(userRef, { balance: newB });
                    bot.sendMessage(chatId, `✅ Saldo retirado. Nuevo balance: $${newB}`, getMainMenu(chatId));
                }
                userStates[chatId].step = 'none';
            }
            
            // Setear Stock
            else if (state === "admin_set_stock") {
                const dur = userStates[chatId].selectedDur;
                const qty = parseInt(text);
                if (!isNaN(qty)) {
                    const durRef = ref(db, `products/FLUORITE_IPA/durations/${dur}`);
                    const currentSnap = await get(durRef);
                    const currentStock = currentSnap.exists() ? (currentSnap.val().stock || 0) : 0;
                    const newStock = currentStock + qty;
                    
                    await update(durRef, { stock: newStock });
                    bot.sendMessage(chatId, `✅ Stock actualizado.\nAhora hay ${newStock} unidades en *${dur}*.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
                } else {
                    bot.sendMessage(chatId, "❌ Ingresa un número válido.");
                }
                userStates[chatId].step = 'none';
            }
            
            // Mensaje Global
            else if (state === "admin_msg_global") {
                const snap = await get(ref(db, 'users'));
                if (snap.exists()) {
                    for (let id in snap.val()) {
                        bot.sendMessage(id, `📢 *MENSAJE GLOBAL:*\n\n${text}`, { parse_mode: 'Markdown' }).catch(()=>{});
                    }
                    bot.sendMessage(chatId, "✅ Mensaje global enviado.", getMainMenu(chatId));
                }
                userStates[chatId].step = 'none';
            }
        }
    } catch (error) { console.error("Error en message:", error); }
});

console.log("🚀 FLUORETE SHOP OPERATIVO CON PRECIOS/DURACIONES DINÁMICOS");
