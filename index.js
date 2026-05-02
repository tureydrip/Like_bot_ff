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

// Menú Principal (Botones abajo en el teclado)
function getMainMenu(chatId) {
    const isOwner = chatId.toString() === ADMIN_ID;
    let keyboard = [];

    if (isOwner) {
        // MENÚ EXCLUSIVO ADMIN (Teclado Fijo)
        keyboard = [
            ["🛠️ Gestionar Producto (FLUORITE)"],
            ["➕ Dar Saldo", "➖ Quitar Saldo"],
            ["📢 Mensaje Global", "👥 Ver Usuarios"],
            ["🛍️ Tienda Fluorite", "👤 Mi Perfil"]
        ];
    } else {
        // MENÚ EXCLUSIVO USUARIO (Teclado Fijo)
        keyboard = [
            ["🛍️ Tienda Fluorite"],
            ["💳 Recargar Saldo", "👤 Mi Perfil"]
        ];
    }

    return { 
        reply_markup: { 
            keyboard: keyboard,
            resize_keyboard: true, // Para que los botones no ocupen toda la pantalla
            is_persistent: true
        } 
    };
}

// Submenú de Gestión de Producto (Inline)
function getProductMenu() {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: "➕ Crear Nueva Duración", callback_data: "admin_create_dur" }],
                [{ text: "✏️ Editar Precio", callback_data: "admin_menu_edit_price" }, { text: "🔄 Cambiar Nombre", callback_data: "admin_menu_rename" }],
                [{ text: "🔑 Cargar Keys (Stock)", callback_data: "admin_manage_stock" }, { text: "🗑️ Eliminar Duración", callback_data: "admin_menu_delete" }]
            ]
        }
    };
}

bot.onText(/\/start/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        userStates[chatId] = { step: 'none' };

        if (chatId.toString() === ADMIN_ID) {
            return bot.sendMessage(chatId, `👑 *PANEL DE CONTROL ADMINISTRATIVO*\nAcceso total concedido jefe.\n\nUtiliza los botones de abajo para navegar.`, { 
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

        // --- ACCIONES DE AUTENTICACIÓN (Inline) ---
        if (data === "auth_register") {
            userStates[chatId].step = "reg_username";
            bot.sendMessage(chatId, "📝 *REGISTRO*\nIngresa un *Nombre de Usuario* nuevo:", { parse_mode: 'Markdown' });
        } 
        else if (data === "auth_login") {
            userStates[chatId].step = "log_username";
            bot.sendMessage(chatId, "🔐 *INICIO DE SESIÓN*\nIngresa tu *Nombre de Usuario*:", { parse_mode: 'Markdown' });
        }
        
        // --- ACCIONES DE COMPRA (Inline) ---
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
                    const deliveredKey = keysList.shift();
                    const newBalance = user.balance - prod.price;
                    const newStock = keysList.length;

                    await update(ref(db, `users/${chatId}`), { balance: newBalance });
                    await update(ref(db, `products/FLUORITE_IPA/durations/${duration}`), { keys: keysList, stock: newStock });

                    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nHas adquirido *FLUORITE IPA (${duration})*.\nSe descontaron $${prod.price} USD de tu saldo.\n\n🔑 *TU KEY DE ACCESO ES:*\n\`${deliveredKey}\`\n\n_(Cópiala tocando el texto)_`, { parse_mode: 'Markdown' });
                    
                    const waText = encodeURIComponent(`NUEVA VENTA 💰\nUsuario: ${user.username}\nCompró: FLUORITE IPA - ${duration}\nKey entregada: ${deliveredKey}\nPagó: $${prod.price} USD`);
                    const waLink = `https://wa.me/${ADMIN_WA}?text=${waText}`;
                    
                    bot.sendMessage(ADMIN_ID, `💰 *NUEVA VENTA REGISTRADA*\n\nUsuario: ${user.username}\nCompró: FLUORITE IPA - ${duration}\nKey entregada: \`${deliveredKey}\`\nPagó: $${prod.price} USD\n\n[📲 Enviar reporte a mi WhatsApp](${waLink})`, { parse_mode: 'Markdown' }).catch(()=>{});
                } else {
                    bot.sendMessage(chatId, `❌ *Saldo insuficiente.*\nNecesitas $${prod.price} USD y tienes $${user.balance} USD.`, {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [[{ text: "💳 Recargar Ahora", callback_data: "none" }]] } // El user puede ir tocando el botón de abajo
                    });
                }
            }
        }

        // --- ACCIONES DE ADMIN (Inline) ---
        if (chatId.toString() === ADMIN_ID) {
            if (data === "admin_create_dur") {
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
        
        if (!userStates[chatId]) userStates[chatId] = { step: 'none' };

        // ==========================================
        // INTERCEPTOR DE MENÚ PRINCIPAL (BOTONES ABAJO)
        // ==========================================
        const menuOptions = ["🛍️ Tienda Fluorite", "💳 Recargar Saldo", "👤 Mi Perfil", "🛠️ Gestionar Producto (FLUORITE)", "➕ Dar Saldo", "➖ Quitar Saldo", "📢 Mensaje Global", "👥 Ver Usuarios"];
        
        if (menuOptions.includes(text)) {
            userStates[chatId].step = 'none'; // Reseteamos cualquier acción pendiente si toca el menú

            // PERFIL
            if (text === "👤 Mi Perfil") {
                const snapshot = await get(ref(db, `users/${chatId}`));
                if (snapshot.exists()) {
                    const user = snapshot.val();
                    return bot.sendMessage(chatId, `👤 *PERFIL*\n\n💠 User: ${user.username}\n💰 Saldo: $${user.balance} USD`, { parse_mode: 'Markdown' });
                } else {
                    return bot.sendMessage(chatId, "⚠️ No estás logueado.");
                }
            }
            // RECARGAR
            else if (text === "💳 Recargar Saldo") {
                userStates[chatId].step = "awaiting_recharge_amount";
                return bot.sendMessage(chatId, `💳 *Mínimo:* $${MIN_RECARGA} USD ($${(MIN_RECARGA * TASA_DOLAR).toLocaleString('es-CO')} COP)\nIngresa el monto en USD que deseas recargar:`);
            }
            // TIENDA
            else if (text === "🛍️ Tienda Fluorite") {
                const snapshot = await get(ref(db, 'products/FLUORITE_IPA/durations'));
                if (snapshot.exists()) {
                    const durations = snapshot.val();
                    let msgT = `🛍️ *PRODUCTO: FLUORITE IPA*\nSelecciona la duración que deseas comprar:\n\n`;
                    let keyboardT = [];

                    for (let dur in durations) {
                        const price = durations[dur].price;
                        const stock = durations[dur].stock || 0;
                        if (stock > 0) {
                            keyboardT.push([{ text: `🛒 ${dur} - $${price} USD (Stock: ${stock})`, callback_data: `buy_${dur}` }]);
                        } else {
                            msgT += `❌ *${dur}* - Agotado\n`;
                        }
                    }

                    if (keyboardT.length === 0) {
                        return bot.sendMessage(chatId, "⚠️ No hay stock disponible por el momento.");
                    } else {
                        return bot.sendMessage(chatId, msgT, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboardT } });
                    }
                } else {
                    return bot.sendMessage(chatId, "⚠️ Producto no configurado por el administrador aún.");
                }
            }
            
            // ACCIONES EXCLUSIVAS DEL ADMIN
            if (chatId.toString() === ADMIN_ID) {
                if (text === "🛠️ Gestionar Producto (FLUORITE)") {
                    return bot.sendMessage(chatId, "🛠️ *GESTIÓN DE FLUORITE IPA*\nSelecciona una opción del submenú:", { parse_mode: 'Markdown', ...getProductMenu() });
                }
                else if (text === "➕ Dar Saldo") {
                    userStates[chatId].step = "admin_add_id";
                    return bot.sendMessage(chatId, "👤 Envía el *Nombre de Usuario* al que le darás saldo:", { parse_mode: 'Markdown' });
                }
                else if (text === "➖ Quitar Saldo") {
                    userStates[chatId].step = "admin_rem_id";
                    return bot.sendMessage(chatId, "👤 Envía el *Nombre de Usuario* al que le quitarás saldo:", { parse_mode: 'Markdown' });
                }
                else if (text === "📢 Mensaje Global") {
                    userStates[chatId].step = "admin_msg_global";
                    return bot.sendMessage(chatId, "📢 Escribe el mensaje global para enviar a todos:");
                }
                else if (text === "👥 Ver Usuarios") {
                    const snapshot = await get(ref(db, 'users'));
                    if (snapshot.exists()) {
                        let list = "👥 *LISTA DE USUARIOS:*\n\n";
                        const users = snapshot.val();
                        for (let id in users) list += `👤 *User:* ${users[id].username} | 💰 *Saldo:* $${users[id].balance}\n`;
                        return bot.sendMessage(chatId, list, { parse_mode: 'Markdown' });
                    }
                    return;
                }
            }
            return; 
        }
        // ==========================================

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
            bot.sendMessage(chatId, `✅ *¡Registro Exitoso!*\nBienvenido a la plataforma. Ya puedes acceder a la tienda con el teclado de abajo.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
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
                    bot.sendMessage(chatId, `🔓 *Acceso Concedido*\nBienvenido de vuelta, ${user.username}. Usa el menú de abajo.`, { parse_mode: 'Markdown', ...getMainMenu(chatId) });
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
            }
        }

        // --- LÓGICA ADMIN ESTADOS ---
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

            // Dar Saldo
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
                    bot.sendMessage(chatId, `✅ Saldo agregado a *${userStates[chatId].targetName}*.\nNuevo balance: $${newB}`, { parse_mode: 'Markdown' });
                    bot.sendMessage(userStates[chatId].target, `💎 *¡RECARGA EXITOSA!*\nSe han añadido $${amount} USD a tu cuenta.`, { parse_mode: 'Markdown' }).catch(()=>{});
                }
                userStates[chatId].step = 'none';
            }

            // Quitar Saldo
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
                    bot.sendMessage(chatId, `✅ Saldo retirado a *${userStates[chatId].targetName}*.\nNuevo balance: $${newB}`, { parse_mode: 'Markdown' });
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
                    bot.sendMessage(chatId, "✅ Mensaje global enviado.");
                }
                userStates[chatId].step = 'none';
            }
        }
    } catch (error) { console.error("Error en message:", error); }
});

console.log("🚀 FLUORETE SHOP OPERATIVO AL 100% - MENÚ FIJO INFERIOR ACTIVO");
