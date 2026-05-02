require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, update, push, remove } = require('firebase/database');

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

// Menú Principal
function getMainMenu(chatId) {
    const isOwner = chatId.toString() === ADMIN_ID;
    let keyboard = [];

    if (isOwner) {
        // MENÚ EXCLUSIVO ADMIN
        keyboard = [
            [{ text: "⚙️ PANEL DE ADMINISTRADOR ⚙️", callback_data: "none" }],
            [{ text: "➕ Dar Saldo", callback_data: "admin_add_balance" }, { text: "➖ Quitar Saldo", callback_data: "admin_rem_balance" }],
            [{ text: "📢 Mensaje Global", callback_data: "admin_global" }, { text: "👥 Ver Usuarios", callback_data: "admin_users" }],
            [{ text: "🛠️ Gestionar Producto (FLUORITE)", callback_data: "admin_manage_product" }]
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

// Submenú de Gestión de Producto (Admin)
function getProductMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Crear Nueva Duración", callback_data: "admin_create_dur" }],
                [{ text: "✏️ Editar Precio", callback_data: "admin_menu_edit_price" }, { text: "🔄 Cambiar Nombre", callback_data: "admin_menu_rename" }],
                [{ text: "🔑 Cargar Keys (Stock)", callback_data: "admin_manage_stock" }, { text: "🗑️ Eliminar Duración", callback_data: "admin_menu_delete" }],
                [{ text: "🔙 Volver al Panel", callback_data: "admin_back_main" }]
            ]
        }
    };
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
                bot.sendMessage(chatId, `👤 *PERFIL*\n\n💠 User: ${user.username}\n💰 Saldo: $${user.balance} USD`, { parse_mode: 'Markdown' });
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
        else if (data.startsWith("buy_")) {
            const duration = data.split("buy_")[1];
            const userSnap = await get(ref(db, `users/${chatId}`));
            const prodSnap = await get(ref(db, `products/FLUORITE_IPA/durations/${duration}`));

            if (userSnap.exists() && prodSnap.exists()) {
                const user = userSnap.val();
                const prod = prodSnap.val();
                const keysList = prod.keys || [];

                if (keysList.length === 0) {
                    bot.sendMessage(chatId, "❌ Se agotó el stock justo ahora.");
                    return;
                }

                if (user.balance >= prod.price) {
                    // Extraer la primera key y actualizar listas
                    const deliveredKey = keysList.shift();
                    const newBalance = user.balance - prod.price;
                    const newStock = keysList.length;

                    await update(ref(db, `users/${chatId}`), { balance: newBalance });
                    await update(ref(db, `products/FLUORITE_IPA/durations/${duration}`), { keys: keysList, stock: newStock });

                    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nHas adquirido *FLUORITE IPA (${duration})*.\nSe descontaron $${prod.price} USD de tu saldo.\n\n🔑 *TU KEY DE ACCESO ES:*\n\`${deliveredKey}\`\n\n_(Cópiala tocando el texto)_`, { parse_mode: 'Markdown' });
                    
                    // Notificación a WhatsApp para el Admin
                    const waText = encodeURIComponent(`NUEVA VENTA 💰\nUsuario: ${user.username}\nCompró: FLUORITE IPA - ${duration}\nKey entregada: ${deliveredKey}\nPagó: $${prod.price} USD`);
                    const waLink = `https://wa.me/${ADMIN_WA}?text=${waText}`;
                    
                    bot.sendMessage(ADMIN_ID, `💰 *NUEVA VENTA REGISTRADA*\n\nUsuario: ${user.username}\nCompró: FLUORITE IPA - ${duration}\nKey entregada: \`${deliveredKey}\`\nPagó: $${prod.price} USD\n\n[📲 Enviar reporte a mi WhatsApp](${waLink})`, { parse_mode: 'Markdown' }).catch(()=>{});
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
            if (data === "admin_back_main") {
                bot.sendMessage(chatId, "👑 *PANEL DE ADMINISTRADOR*", { parse_mode: 'Markdown', ...getMainMenu(chatId) });
            }
            else if (data === "admin_manage_product") {
                bot.sendMessage(chatId, "🛠️ *GESTIÓN DE FLUORITE IPA*\nSelecciona una opción del submenú:", { parse_mode: 'Markdown', ...getProductMenu() });
            }
            else if (data === "admin_add_balance") {
                userStates[chatId].step = "admin_add_id";
                bot.sendMessage(chatId, "👤 Envía el *Nombre de Usuario* al que le darás saldo:", { parse_mode: 'Markdown' });
            }
            else if (data === "admin_rem_balance") {
                userStates[chatId].step = "admin_rem_id";
                bot.sendMessage(chatId, "👤 Envía el *Nombre de Usuario* al que le quitarás saldo:", { parse_mode: 'Markdown' });
            }
            else if (data === "admin_global") {
                userStates[chatId].step = "admin_msg_global";
                bot.sendMessage(chatId, "📢 Escribe el mensaje global para enviar a todos:");
            }
            else if (data === "admin_users") {
                const snapshot = await get(ref(db, 'users'));
                if (snapshot.exists()) {
                    let list = "👥 *LISTA DE USUARIOS:*\n\n";
                    const users = snapshot.val();
                    for (let id in users) list += `👤 *User:* ${users[id].username} | 💰 *Saldo:* $${users[id].balance}\n`;
                    bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
                }
            }

            // GESTIÓN DE PRODUCTO
            else if (data === "admin_create_dur") {
                userStates[chatId].step = "admin_awaiting_dur_name";
                bot.sendMessage(chatId, "🏷️ Escribe el *Nombre de la Nueva Duración* (Ejemplo: 1 Día, VIP):", { parse_mode: 'Markdown' });
            }
            else if (data === "admin_manage_stock" || data === "admin_menu_edit_price" || data === "admin_menu_rename" || data === "admin_menu_delete") {
                const snapshot = await get(ref(db, 'products/FLUORITE_IPA/durations'));
                if (snapshot.exists()) {
                    const durations = snapshot.val();
                    let keyboard = [];
                    let actionPrefix = "";
                    let textMsg = "";

                    if (data === "admin_manage_stock") { actionPrefix = "stock_"; textMsg = "🔑 Selecciona la duración para cargarle las Keys:"; }
                    if (data === "admin_menu_edit_price") { actionPrefix = "editp_"; textMsg = "✏️ Selecciona para editar precio:"; }
                    if (data === "admin_menu_rename") { actionPrefix = "ren_"; textMsg = "🔄 Selecciona para cambiar nombre:"; }
                    if (data === "admin_menu_delete") { actionPrefix = "del_"; textMsg = "🗑️ Selecciona para ELIMINAR (Irreversible):"; }

                    for (let dur in durations) {
                        keyboard.push([{ text: `👉 ${dur}`, callback_data: `${actionPrefix}${dur}` }]);
                    }
                    bot.sendMessage(chatId, textMsg, { reply_markup: { inline_keyboard: keyboard } });
                } else {
                    bot.sendMessage(chatId, "⚠️ No hay duraciones creadas. Toca '➕ Crear Nueva Duración' primero.");
                }
            }

            // Manejadores de los botones dinámicos de gestión
            else if (data.startsWith("stock_")) {
                const dur = data.split("stock_")[1];
                userStates[chatId].selectedDur = dur;
                userStates[chatId].step = "admin_set_stock";
                bot.sendMessage(chatId, `🔑 Pega las **KEYS** que vas a agregar a *${dur}*.\n⚠️ _Debes poner una key por línea (una debajo de la otra)._`, { parse_mode: 'Markdown' });
            }
            else if (data.startsWith("editp_")) {
                const dur = data.split("editp_")[1];
                userStates[chatId].selectedDur = dur;
                userStates[chatId].step = "admin_edit_price";
                bot.sendMessage(chatId, `💸 Ingresa el NUEVO PRECIO en USD para *${dur}*:`, { parse_mode: 'Markdown' });
            }
            else if (data.startsWith("ren_")) {
                const dur = data.split("ren_")[1];
                userStates[chatId].selectedDur = dur;
                userStates[chatId].step = "admin_rename_dur";
                bot.sendMessage(chatId, `🔄 Escribe el NUEVO NOMBRE para reemplazar a *${dur}*:`, { parse_mode: 'Markdown' });
            }
            else if (data.startsWith("del_")) {
                const dur = data.split("del_")[1];
                await remove(ref(db, `products/FLUORITE_IPA/durations/${dur}`));
                bot.sendMessage(chatId, `✅ La duración *${dur}* ha sido eliminada por completo.`, { parse_mode: 'Markdown', ...getProductMenu() });
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
                
                const waText = encodeURIComponent(`Hola quiero recargar ${usd} USD ya adjunto mi comprobante`);
                const waLink = `https://wa.me/${ADMIN_WA}?text=${waText}`;
                
                bot.sendMessage(chatId, `📄 *FACTURA DE COMPRA*\n\n💵 Monto: $${usd} USD\n💰 Total: $${cop.toLocaleString('es-CO')} COP\n\n🏦 *Nequi:* \`${NEQUI_NUM}\`\n\n⚠️ Toca el botón de abajo para enviar el comprobante directamente al administrador por WhatsApp.`, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: "📲 Enviar Comprobante (WhatsApp)", url: waLink }]] }
                });
                userStates[chatId].step = 'none';
                bot.sendMessage(chatId, "Volviendo al menú principal:", getMainMenu(chatId));
            }
        }

        // --- LÓGICA ADMIN ---
        if (chatId.toString() === ADMIN_ID) {
            
            // Creación de Duración
            if (state === "admin_awaiting_dur_name") {
                userStates[chatId].tempDurName = text;
                userStates[chatId].step = "admin_awaiting_dur_price";
                bot.sendMessage(chatId, `💸 Ingresa el *Precio en USD* para "${text}":`, { parse_mode: 'Markdown' });
            }
            else if (state === "admin_awaiting_dur_price") {
                const price = parseFloat(text);
                if (!isNaN(price)) {
                    const durName = userStates[chatId].tempDurName;
                    await set(ref(db, 'products/FLUORITE_IPA/name'), "FLUORITE IPA");
                    await update(ref(db, `products/FLUORITE_IPA/durations/${durName}`), { price: price, stock: 0, keys: [] });
                    bot.sendMessage(chatId, `✅ *Duración Creada Exitosamente*\n\nNombre: ${durName}\nPrecio: $${price} USD\nStock inicial: 0\n\n_(Usa el botón de '🔑 Cargar Keys' para añadirle stock)._`, { parse_mode: 'Markdown', ...getProductMenu() });
                } else {
                    bot.sendMessage(chatId, "❌ El precio debe ser un número válido.");
                }
                userStates[chatId].step = 'none';
            }

            // Editar Precio
            else if (state === "admin_edit_price") {
                const price = parseFloat(text);
                if (!isNaN(price)) {
                    const dur = userStates[chatId].selectedDur;
                    await update(ref(db, `products/FLUORITE_IPA/durations/${dur}`), { price: price });
                    bot.sendMessage(chatId, `✅ Precio de *${dur}* actualizado a $${price} USD.`, { parse_mode: 'Markdown', ...getProductMenu() });
                } else {
                    bot.sendMessage(chatId, "❌ Número inválido.");
                }
                userStates[chatId].step = 'none';
            }

            // Cambiar Nombre
            else if (state === "admin_rename_dur") {
                const oldDur = userStates[chatId].selectedDur;
                const newDur = text;
                const oldRef = ref(db, `products/FLUORITE_IPA/durations/${oldDur}`);
                const snap = await get(oldRef);
                
                if (snap.exists()) {
                    const data = snap.val();
                    await set(ref(db, `products/FLUORITE_IPA/durations/${newDur}`), data);
                    await remove(oldRef);
                    bot.sendMessage(chatId, `✅ Duración renombrada de *${oldDur}* a *${newDur}*.`, { parse_mode: 'Markdown', ...getProductMenu() });
                }
                userStates[chatId].step = 'none';
            }

            // Setear Stock (LEYENDO KEYS)
            else if (state === "admin_set_stock") {
                const dur = userStates[chatId].selectedDur;
                const newKeys = text.split('\n').map(k => k.trim()).filter(k => k.length > 0);
                
                if (newKeys.length > 0) {
                    const durRef = ref(db, `products/FLUORITE_IPA/durations/${dur}`);
                    const snap = await get(durRef);
                    let currentKeys = [];
                    
                    if (snap.exists() && snap.val().keys) {
                        currentKeys = snap.val().keys;
                    }
                    
                    const updatedKeys = currentKeys.concat(newKeys);
                    const newStock = updatedKeys.length;
                    
                    await update(durRef, { keys: updatedKeys, stock: newStock });
                    bot.sendMessage(chatId, `✅ *¡KEYS GUARDADAS!*\nSe cargaron ${newKeys.length} keys exitosamente.\n\nStock total de *${dur}*: ${newStock} keys disponibles.`, { parse_mode: 'Markdown', ...getProductMenu() });
                } else {
                    bot.sendMessage(chatId, "❌ No detecté ninguna key válida. Asegúrate de pegarlas correctamente.");
                }
                userStates[chatId].step = 'none';
            }

            // --- BÚSQUEDA POR NOMBRE DE USUARIO PARA DAR SALDO ---
            else if (state === "admin_add_id") {
                const targetUsername = text.toLowerCase();
                const usersRef = ref(db, 'users');
                const snap = await get(usersRef);
                let foundId = null;

                if (snap.exists()) {
                    const users = snap.val();
                    for (let id in users) {
                        if (users[id].username.toLowerCase() === targetUsername) {
                            foundId = id;
                            break;
                        }
                    }
                }

                if (foundId) {
                    userStates[chatId].target = foundId;
                    userStates[chatId].targetName = text;
                    userStates[chatId].step = "admin_add_amount";
                    bot.sendMessage(chatId, `💰 Seleccionaste al usuario *${text}*.\nIngresa la cantidad de USD a agregar:`, { parse_mode: 'Markdown' });
                } else {
                    bot.sendMessage(chatId, `❌ Usuario *${text}* no encontrado. Verifica que esté bien escrito.`, { parse_mode: 'Markdown' });
                    userStates[chatId].step = 'none';
                }
            }
            else if (state === "admin_add_amount") {
                const amount = parseFloat(text);
                const userRef = ref(db, `users/${userStates[chatId].target}`);
                const snap = await get(userRef);
                if (snap.exists() && !isNaN(amount)) {
                    const newB = snap.val().balance + amount;
                    await update(userRef, { balance: newB });
                    bot.sendMessage(chatId, `✅ Saldo agregado a *${userStates[chatId].targetName}*.\nNuevo balance: $${newB}`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
                    bot.sendMessage(userStates[chatId].target, `💎 *¡RECARGA EXITOSA!*\nSe han añadido $${amount} USD a tu cuenta.`, { parse_mode: 'Markdown' }).catch(()=>{});
                } else {
                    bot.sendMessage(chatId, "❌ Error. Verifica la cantidad ingresada.");
                }
                userStates[chatId].step = 'none';
            }

            // --- BÚSQUEDA POR NOMBRE DE USUARIO PARA QUITAR SALDO ---
            else if (state === "admin_rem_id") {
                const targetUsername = text.toLowerCase();
                const usersRef = ref(db, 'users');
                const snap = await get(usersRef);
                let foundId = null;

                if (snap.exists()) {
                    const users = snap.val();
                    for (let id in users) {
                        if (users[id].username.toLowerCase() === targetUsername) {
                            foundId = id;
                            break;
                        }
                    }
                }

                if (foundId) {
                    userStates[chatId].target = foundId;
                    userStates[chatId].targetName = text;
                    userStates[chatId].step = "admin_rem_amount";
                    bot.sendMessage(chatId, `💰 Seleccionaste al usuario *${text}*.\nIngresa la cantidad de USD a quitar:`, { parse_mode: 'Markdown' });
                } else {
                    bot.sendMessage(chatId, `❌ Usuario *${text}* no encontrado. Verifica que esté bien escrito.`, { parse_mode: 'Markdown' });
                    userStates[chatId].step = 'none';
                }
            }
            else if (state === "admin_rem_amount") {
                const amount = parseFloat(text);
                const userRef = ref(db, `users/${userStates[chatId].target}`);
                const snap = await get(userRef);
                if (snap.exists() && !isNaN(amount)) {
                    const newB = Math.max(0, snap.val().balance - amount);
                    await update(userRef, { balance: newB });
                    bot.sendMessage(chatId, `✅ Saldo retirado a *${userStates[chatId].targetName}*.\nNuevo balance: $${newB}`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
                } else {
                    bot.sendMessage(chatId, "❌ Error. Verifica la cantidad ingresada.");
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

console.log("🚀 FLUORETE SHOP OPERATIVO AL 100% - ASIGNACIÓN DE SALDO POR USERNAME ACTIVA");
