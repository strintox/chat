// Дополнительная защита для GitHub Pages
(function() {
    try {
        // Проверка загрузки на GitHub Pages
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        // Проверка наличия Supabase
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase не найден. Возможно, скрипт был загружен до библиотеки Supabase.');
            // Отображаем пользователю ошибку
            setTimeout(() => {
                const connectionElement = document.getElementById('connection-notification');
                const messageElement = document.getElementById('connection-message');
                if (connectionElement && messageElement) {
                    messageElement.textContent = 'Ошибка инициализации приложения. Пожалуйста, обновите страницу.';
                    connectionElement.classList.remove('hidden');
                } else {
                    alert('Не удалось инициализировать приложение. Пожалуйста, обновите страницу.');
                }
            }, 1000);
            return; // Прерываем выполнение скрипта
        }
        
        // Если мы на GitHub Pages, добавляем дополнительные параметры для CORS
        if (isGitHubPages) {
            console.log('Работа на GitHub Pages, настройка дополнительных параметров...');
            // Добавляем временные метки к запросам для предотвращения кеширования
            const originalFetch = window.fetch;
            window.fetch = function(url, options) {
                if (typeof url === 'string' && url.includes('api.ipify.org')) {
                    // Добавляем случайный параметр к URL для предотвращения кеширования
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}cache=${Date.now()}`;
                }
                return originalFetch(url, options);
            };
        }
    } catch (error) {
        console.error('Ошибка при запуске защитного кода:', error);
    }
})();

// Инициализация Supabase
const SUPABASE_URL = 'https://qiqskfxvlwjhanziheby.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpcXNrZnh2bHdqaGFuemloZWJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MjU2ODcsImV4cCI6MjA1ODMwMTY4N30.0l6xsQ_zUlu8D_2XUL-LRKtyVlbaRJ8aEVti9QP5Hq4';

// Проверка среды выполнения
const isGitHubPages = window.location.hostname.includes('github.io');
const RETRY_DELAYS = [1000, 2000, 3000, 5000]; // Задержки для повторных попыток в мс

// Создаем клиент Supabase с более надежными настройками и обработкой ошибок
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        realtime: {
            params: {
                eventsPerSecond: 10
            }
        },
        global: {
            headers: { 'X-Client-Info': 'nighttalk-chat' },
        },
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        }
    });
    
    // Проверяем, что объект создан корректно
    if (!supabase || !supabase.from) {
        throw new Error('Supabase клиент не был правильно инициализирован');
    }
    
    console.log('Supabase клиент успешно инициализирован');
} catch (error) {
    console.error('Критическая ошибка при инициализации Supabase:', error);
    // Показываем пользователю уведомление о проблеме
    window.addEventListener('load', () => {
        alert('Произошла ошибка при инициализации приложения. Пожалуйста, обновите страницу и попробуйте снова.');
    });
}

// Включаем дополнительное логирование
let DEBUG_MODE = true;

function logDebug(...args) {
    if (DEBUG_MODE) {
        console.log('[DEBUG]', ...args);
    }
}

// Проверяем, что Supabase правильно настроен
logDebug('Supabase объект:', supabase);
logDebug('Supabase realtime клиент:', supabase.realtime);

// DOM элементы
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const enterBtn = document.getElementById('enter-btn');
const loadingIndicator = document.getElementById('loading');
const usernameDisplay = document.getElementById('username');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');
const userAvatar = document.getElementById('user-avatar');
const onlineCountDisplay = document.getElementById('online-count');
const themeToggleBtn = document.getElementById('theme-toggle');
const connectionStatus = document.getElementById('connection-status');
const connectionNotification = document.getElementById('connection-notification');
const connectionMessage = document.getElementById('connection-message');

// Состояние приложения
let currentUser = null;
let onlineUsers = 0;
let channelSubscription = null;
let oldestMessageTimestamp = null; // Для пагинации
let isLoadingMoreMessages = false; // Флаг загрузки
let hasMoreMessages = true; // Флаг наличия старых сообщений

// Коллекция предустановленных аватаров
const AVATARS = [
    'https://cdn-icons-png.flaticon.com/512/3022/3022561.png', // Бизнесмен
    'https://cdn-icons-png.flaticon.com/512/3022/3022554.png', // Программист
    'https://cdn-icons-png.flaticon.com/512/3022/3022580.png', // Художник
    'https://cdn-icons-png.flaticon.com/512/3022/3022595.png', // Фермер
    'https://cdn-icons-png.flaticon.com/512/3022/3022549.png', // Музыкант
    'https://cdn-icons-png.flaticon.com/512/3022/3022563.png', // Доктор
    'https://cdn-icons-png.flaticon.com/512/3022/3022574.png', // Спортсмен
    'https://cdn-icons-png.flaticon.com/512/3022/3022588.png', // Повар
    'https://cdn-icons-png.flaticon.com/512/3022/3022600.png', // Студент
    'https://cdn-icons-png.flaticon.com/512/3022/3022608.png'  // Пилот
];

// Выбор аватара на основе userId
function getAvatarForUser(userId) {
    const avatarIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATARS.length;
    return AVATARS[avatarIndex];
}

// РАЗДЕЛ 1: АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ

// Генерация уникального ID на основе случайных данных и временной метки
async function generateUniqueId() {
    try {
        // В GitHub Pages API может не работать, поэтому добавляем проверку
        let ipInfo = null;
        if (!isGitHubPages) {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                if (response.ok) {
                    ipInfo = await response.json();
                }
            } catch (ipError) {
                console.warn('Не удалось получить IP:', ipError);
            }
        }

        // Создаем комбинированную строку для хеширования
        const timestamp = Date.now().toString();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const randomStr2 = crypto.getRandomValues(new Uint32Array(4))
            .join('-');
        
        let combinedString = `${timestamp}-${randomStr}-${randomStr2}`;
        
        // Добавляем IP если доступен
        if (ipInfo && ipInfo.ip) {
            combinedString = `${ipInfo.ip}-${combinedString}`;
        }
        
        // Добавляем информацию о браузере и экране для большей уникальности
        const browserInfo = `${navigator.userAgent}-${screen.width}x${screen.height}`;
        combinedString = `${combinedString}-${browserInfo}`;
        
        // Хешируем результат
        const hash = await hashString(combinedString);
        
        // Возвращаем часть хеша в качестве ID
        return `u${hash.slice(0, 12)}`; // Префикс 'u' для обеспечения допустимого формата ID
    } catch (error) {
        console.error('Ошибка при генерации уникального ID:', error);
        // Запасной вариант, максимально надежный
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8);
        const random2 = Math.random().toString(36).substring(2, 8);
        return `u${timestamp.slice(-6)}${random}${random2}`;
    }
}

// Улучшенная функция хеширования строки
async function hashString(str) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error('Ошибка при хешировании строки:', error);
        // Запасной вариант, если crypto API недоступен
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
}

// Генерация уникального имени пользователя
function generateUsername(userId) {
    const prefixes = ["Ночной", "Тайный", "Космо", "Звёздный", "Мистик", "Фантом", "Призрак", "Странник", "Искатель", "Путник"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const number = userId.slice(0, 4).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 1000;
    return `${randomPrefix}${number}`;
}

// Сброс состояния пользователя
function resetUserState() {
    try {
        localStorage.removeItem('nighttalk_user');
        currentUser = null;
        
        // Просто перезагружаем страницу вместо показа alert
        if (connectionNotification) {
            connectionMessage.textContent = 'Данные сброшены. Пожалуйста, попробуйте снова.';
            connectionNotification.classList.remove('hidden');
            
            // Перезагружаем через небольшую задержку, чтобы пользователь увидел сообщение
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            window.location.reload();
        }
    } catch (error) {
        console.error("Ошибка при сбросе данных пользователя:", error);
        // В случае ошибки все равно пытаемся перезагрузить страницу
        window.location.reload();
    }
}

// Функция для проверки и восстановления соединения с Supabase
async function checkSupabaseConnection() {
    if (!supabase) {
        console.error("Клиент Supabase не инициализирован");
        return false;
    }

    try {
        // Сначала проверяем простой запрос к базе данных
        const { error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true })
            .limit(1);
        
        if (error) {
            console.error("Ошибка соединения с Supabase:", error);
            return false;
        }
        
        // Проверяем состояние подписки на реальное время
        if (supabase.realtime && supabase.realtime.listChannels) {
            const channels = supabase.realtime.listChannels();
            console.log("Текущие каналы:", channels);
        }
        
        return true;
    } catch (error) {
        console.error("Произошла ошибка при проверке соединения:", error);
        return false;
    }
}

// Функция для повторных попыток подключения с задержкой
async function retryWithBackoff(fn, retries = 3) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries) {
                throw error; // Исчерпаны все попытки
            }
            const delay = RETRY_DELAYS[i] || 5000;
            console.log(`Попытка ${i+1} не удалась. Повтор через ${delay}мс...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// Инициализация пользователя - вход в чат
async function initUser() {
    try {
        // Показываем индикатор загрузки
        loadingIndicator.classList.remove('hidden');
        enterBtn.disabled = true;
        
        // Сначала проверяем соединение с Supabase
        if (isGitHubPages) {
            console.log("Запуск на GitHub Pages, проверка соединения...");
            const isConnected = await retryWithBackoff(checkSupabaseConnection);
            if (!isConnected) {
                throw new Error("Не удалось установить соединение с сервером после нескольких попыток. Пожалуйста, обновите страницу.");
            }
        }
        
        // Проверяем, существует ли пользователь в локальном хранилище
        const storedUser = localStorage.getItem('nighttalk_user');
        
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser);
                console.log("Пользователь загружен из хранилища:", currentUser);
                
                if (!currentUser.id) {
                    throw new Error('Некорректные данные пользователя');
                }
                
                // Проверяем существование пользователя в базе данных
                const { data: existingUser, error: userCheckError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', currentUser.id)
                    .single();
                
                if (userCheckError || !existingUser) {
                    console.warn("Пользователь не найден в базе данных, создаем заново");
                    throw new Error('Пользователь не найден в базе данных');
                }
                
                // Устанавливаем аватар из коллекции
                currentUser.avatar_url = getAvatarForUser(currentUser.id);
                localStorage.setItem('nighttalk_user', JSON.stringify(currentUser));
                
                // Обновляем аватар в базе данных
                await supabase
                    .from('users')
                    .update({ 
                        avatar_url: currentUser.avatar_url,
                        last_seen: new Date().toISOString()
                    })
                    .eq('id', currentUser.id);
                
            } catch (parseError) {
                console.error('Ошибка данных пользователя:', parseError);
                localStorage.removeItem('nighttalk_user'); // Очищаем неверные данные
                currentUser = null;
                // Продолжаем выполнение для создания нового пользователя
            }
        }
        
        // Если пользователь не найден или возникла ошибка, создаем нового
        if (!currentUser) {
            // Создаем нового пользователя
            let maxRetries = 3;
            let created = false;
            
            while (!created && maxRetries > 0) {
                try {
                    const userId = await generateUniqueId();
                    const username = generateUsername(userId);
                    const avatarUrl = getAvatarForUser(userId);
                    
                    console.log("Создаем нового пользователя:", username);
                    
                    // Создаем запись пользователя в базе данных с более безопасной обработкой
                    const { data, error } = await supabase
                        .from('users')
                        .insert({ 
                            id: userId,
                            username: username,
                            avatar_url: avatarUrl,
                            last_seen: new Date().toISOString()
                        })
                        .select();
                        
                    if (error) {
                        // Проверяем, является ли ошибка конфликтом ключей
                        const errorMessage = error.message ? error.message.toLowerCase() : '';
                        if (error.code === '23505' || 
                            errorMessage.includes('duplicate key') || 
                            errorMessage.includes('violates unique constraint') ||
                            errorMessage.includes('users_pkey')) {
                            console.warn("Конфликт ID пользователя, генерирую новый ID...");
                            maxRetries--;
                            
                            // Добавляем небольшую задержку перед следующей попыткой
                            await new Promise(r => setTimeout(r, 500));
                            continue;
                        } else {
                            console.error("Ошибка при создании пользователя:", error);
                            throw error;
                        }
                    }
                    
                    currentUser = {
                        id: userId,
                        username: username,
                        avatar_url: avatarUrl
                    };
                    
                    // Сохраняем в локальное хранилище
                    localStorage.setItem('nighttalk_user', JSON.stringify(currentUser));
                    
                    created = true;
                } catch (innerError) {
                    console.error("Ошибка в цикле создания пользователя:", innerError);
                    maxRetries--;
                    
                    // Добавляем задержку между попытками
                    await new Promise(r => setTimeout(r, 1000));
                    
                    if (maxRetries <= 0) {
                        throw new Error("Не удалось создать пользователя после нескольких попыток: " + innerError.message);
                    }
                }
            }
            
            if (!created) {
                throw new Error("Не удалось создать уникального пользователя после нескольких попыток");
            }
        }
        
        // Обновляем last_seen
        await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', currentUser.id);
        
        // Обновляем интерфейс пользователя
        usernameDisplay.textContent = currentUser.username;
        userAvatar.src = currentUser.avatar_url;
        
        // Проверка статуса реального времени
        await checkRealtimeStatus();
        
        // ВАЖНО: Сначала настраиваем подписку, потом загружаем сообщения
        startRealtimeSubscription();
        
        // Загружаем существующие сообщения
        await loadMessages();
        
        // Обновляем счетчик онлайн пользователей
        updateOnlineUsers();
        
        // Показываем экран чата
        loginScreen.classList.remove('active');
        chatScreen.classList.add('active');
        
    } catch (error) {
        console.error('Ошибка при входе в чат:', error);
        connectionMessage.textContent = 'Не удалось войти в чат: ' + error.message;
        connectionNotification.classList.remove('hidden');
        
        // Сбрасываем локальное хранилище при серьезных ошибках
        const errorMessage = error.message ? error.message.toLowerCase() : '';
        if (errorMessage.includes("duplicate key") || 
            errorMessage.includes("violates unique constraint") ||
            errorMessage.includes("users_pkey")) {
            console.warn("Обнаружен конфликт ID, сбрасываю данные пользователя...");
            resetUserState();
        }
    } finally {
        loadingIndicator.classList.add('hidden');
        enterBtn.disabled = false;
    }
}

// РАЗДЕЛ 2: РАБОТА С СООБЩЕНИЯМИ

// Загрузка сообщений из базы данных
async function loadMessages() {
    try {
        console.log("Загрузка существующих сообщений...");
        
        // Очищаем контейнер сообщений
        messagesContainer.innerHTML = '';
        
        // Сбрасываем состояние пагинации
        oldestMessageTimestamp = null;
        hasMoreMessages = true;
        
        // Загружаем последние 50 сообщений
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                image_url,
                created_at,
                user_id,
                users (
                    id,
                    username,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: false }) // Сначала новые
            .limit(50);
            
        if (error) {
            throw error;
        }
        
        // Если есть сообщения
        if (data && data.length > 0) {
            // Сохраняем timestamp самого старого сообщения
            oldestMessageTimestamp = data[data.length - 1].created_at;
            
            // Переворачиваем массив, чтобы отобразить сначала старые сообщения
            const reversedData = data.reverse();
            
            // Добавляем сообщения в DOM
            reversedData.forEach(message => {
                renderMessage(message);
            });
            
            // Проверяем, есть ли ещё сообщения
            hasMoreMessages = data.length === 50;
        } else {
            console.log("Нет сообщений для отображения");
            messagesContainer.innerHTML = '<div class="no-messages">Станьте первым, кто напишет сообщение!</div>';
            hasMoreMessages = false;
        }
        
        // Если есть старые сообщения, добавляем кнопку загрузки
        updateLoadMoreButton();
        
        // Прокручиваем к последнему сообщению
        scrollToBottom();
        
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        messagesContainer.innerHTML = '<div class="error-message">Ошибка при загрузке сообщений</div>';
    }
}

// Функция для загрузки старых сообщений
async function loadOlderMessages() {
    if (isLoadingMoreMessages || !hasMoreMessages || !oldestMessageTimestamp) return;
    
    try {
        isLoadingMoreMessages = true;
        
        // Показываем индикатор загрузки
        const loadingIndicator = document.getElementById('load-more-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }
        
        logDebug("Загрузка старых сообщений до", oldestMessageTimestamp);
        
        const { data, error } = await supabase
            .from('messages')
            .select(`
                id,
                content,
                image_url,
                created_at,
                user_id,
                users (
                    id,
                    username,
                    avatar_url
                )
            `)
            .lt('created_at', oldestMessageTimestamp) // Сообщения, созданные ранее самого старого
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) {
            throw error;
        }
        
        // Сохраняем текущую позицию прокрутки и высоту
        const scrollPosition = messagesContainer.scrollTop;
        const oldHeight = messagesContainer.scrollHeight;
        
        // Если есть сообщения
        if (data && data.length > 0) {
            // Сохраняем timestamp самого старого сообщения
            oldestMessageTimestamp = data[data.length - 1].created_at;
            
            // Создаем временный контейнер
            const tempContainer = document.createElement('div');
            
            // Переворачиваем массив и добавляем сообщения
            const reversedData = data.reverse();
            reversedData.forEach(message => {
                // Создаем сообщение в temp контейнере
                renderMessageToContainer(message, tempContainer);
            });
            
            // Вставляем все новые сообщения в начало контейнера
            messagesContainer.insertBefore(tempContainer, messagesContainer.firstChild);
            
            // Перемещаем все дочерние элементы из временного контейнера напрямую в основной
            while (tempContainer.firstChild) {
                messagesContainer.insertBefore(tempContainer.firstChild, tempContainer);
            }
            
            // Удаляем временный контейнер
            messagesContainer.removeChild(tempContainer);
            
            // Проверяем, есть ли ещё сообщения
            hasMoreMessages = data.length === 50;
            
            // Восстанавливаем позицию прокрутки с учетом новой высоты
            const newHeight = messagesContainer.scrollHeight;
            messagesContainer.scrollTop = scrollPosition + (newHeight - oldHeight);
            
            logDebug(`Загружено ${data.length} старых сообщений`);
        } else {
            hasMoreMessages = false;
            logDebug("Больше старых сообщений нет");
        }
        
        // Обновляем кнопку загрузки
        updateLoadMoreButton();
        
    } catch (error) {
        console.error("Ошибка при загрузке старых сообщений:", error);
        
        // Показываем сообщение об ошибке над чатом
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = 'Не удалось загрузить старые сообщения';
        errorElement.style.margin = '10px 0';
        messagesContainer.insertBefore(errorElement, messagesContainer.firstChild);
        
        // Удаляем сообщение об ошибке через 5 секунд
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 5000);
    } finally {
        isLoadingMoreMessages = false;
        
        // Скрываем индикатор загрузки
        const loadingIndicator = document.getElementById('load-more-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
}

// Функция для обновления кнопки "Загрузить еще"
function updateLoadMoreButton() {
    // Проверяем наличие существующей кнопки
    let loadMoreContainer = document.getElementById('load-more-container');
    
    // Удаляем контейнер, если он существует
    if (loadMoreContainer) {
        messagesContainer.removeChild(loadMoreContainer);
    }
    
    // Если есть еще сообщения для загрузки
    if (hasMoreMessages) {
        // Создаем контейнер кнопки
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'load-more-container';
        loadMoreContainer.className = 'load-more-container';
        
        loadMoreContainer.innerHTML = `
            <button id="load-more-btn" class="load-more-btn">
                <i class="fas fa-history"></i> Загрузить предыдущие сообщения
            </button>
            <div id="load-more-indicator" class="spinner hidden"></div>
        `;
        
        // Добавляем контейнер в начало списка сообщений
        messagesContainer.insertBefore(loadMoreContainer, messagesContainer.firstChild);
        
        // Добавляем обработчик клика
        document.getElementById('load-more-btn').addEventListener('click', loadOlderMessages);
    }
}

// Функция для рендеринга сообщения в указанный контейнер
function renderMessageToContainer(message, container) {
    // Проверка на корректность данных
    if (!message || !message.users) {
        console.error("Некорректные данные сообщения");
        return;
    }
    
    // Проверяем, является ли это собственным сообщением
    const isOwnMessage = message.user_id === currentUser.id;
    
    // Создаем элемент сообщения
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Добавляем классы в зависимости от типа сообщения
    if (isOwnMessage) {
        messageElement.classList.add('own');
    }
    
    messageElement.id = 'msg-' + message.id;
    
    // Определяем URL аватара
    const avatarUrl = isOwnMessage 
        ? currentUser.avatar_url 
        : (message.users.avatar_url || getAvatarForUser(message.users.id));
    
    // Форматируем время
    const messageTime = new Date(message.created_at);
    const formattedTime = messageTime.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Создаем HTML сообщения
    messageElement.innerHTML = `
        <div class="message-avatar">
            <img src="${avatarUrl}" alt="Аватар">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-name">${message.users.username}</span>
                <span class="message-time">${formattedTime}</span>
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
        </div>
    `;
    
    // Добавляем в указанный контейнер
    container.appendChild(messageElement);
}

// Обновляем функцию renderMessage для использования общей логики
function renderMessage(message) {
    // Если сообщение уже есть в DOM, не добавляем
    const existingMsg = document.getElementById(`msg-${message.id}`);
    if (existingMsg && !message.id.toString().startsWith('temp-')) {
        return;
    }
    
    // Если это временное сообщение
    if (message.id.toString().startsWith('temp-')) {
        // Создаем элемент сообщения
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'own', 'temp');
        messageElement.id = message.id;
        
        // Создаем HTML временного сообщения
        messageElement.innerHTML = `
            <div class="message-avatar">
                <img src="${currentUser.avatar_url}" alt="Аватар">
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-name">${currentUser.username}</span>
                    <span class="message-time">Отправляется...</span>
                </div>
                <div class="message-text">${escapeHtml(message.content)}</div>
            </div>
        `;
        
        // Добавляем в контейнер сообщений
        messagesContainer.appendChild(messageElement);
        return;
    }
    
    // Проверяем, является ли это сообщением от другого пользователя (для анимации)
    const isOtherUserMessage = message.user_id !== currentUser.id;
    
    // Создаем элемент для основных сообщений
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Добавляем классы для стилизации
    if (message.user_id === currentUser.id) {
        messageElement.classList.add('own');
    } else if (isOtherUserMessage) {
        messageElement.classList.add('new'); // Для анимации новых сообщений
    }
    
    messageElement.id = 'msg-' + message.id;
    
    // Используем renderMessageToContainer для общей логики
    renderMessageToContainer(message, messageElement);
    
    // Переносим дочерние элементы в messageElement
    while (messageElement.firstChild) {
        messagesContainer.appendChild(messageElement.firstChild);
    }
    
    // Добавляем в контейнер сообщений
    messagesContainer.appendChild(messageElement);
}

// Обновление индикатора соединения
function updateConnectionStatus(isConnected) {
    if (isConnected) {
        connectionStatus.innerHTML = '<i class="fas fa-signal"></i>';
        connectionStatus.classList.remove('offline');
        connectionNotification.classList.add('hidden');
    } else {
        connectionStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        connectionStatus.classList.add('offline');
        connectionMessage.textContent = 'Проблема с подключением к серверу';
        connectionNotification.classList.remove('hidden');
        
        // Скрываем уведомление через 5 секунд
        setTimeout(() => {
            connectionNotification.classList.add('hidden');
        }, 5000);
    }
}

// Функция настройки подписки на новые сообщения
function startRealtimeSubscription() {
    logDebug("Настройка подписки на обновления в реальном времени...");
    
    // Если есть существующая подписка, удаляем её
    if (channelSubscription) {
        supabase.removeChannel(channelSubscription);
    }
    
    // Обновляем статус соединения
    updateConnectionStatus(true);
    
    try {
        // Создаем канал для получения сообщений в реальном времени с улучшенными настройками
        channelSubscription = supabase
            .channel('realtime:public:messages')
            .on('postgres_changes', 
                {
                    event: '*', // Подписываемся на все события
                    schema: 'public', 
                    table: 'messages'
                }, 
                handleNewMessage
            )
            .subscribe((status) => {
                logDebug(`Статус подписки на канал: ${status}`);
                if (status === 'SUBSCRIBED') {
                    logDebug('Успешно подписались на обновления чата в реальном времени');
                    updateConnectionStatus(true);
                    // Тестовое сообщение в консоль
                    logDebug("Канал реального времени активирован, ожидание сообщений...");
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Ошибка при подписке на канал');
                    updateConnectionStatus(false);
                    // Попытка переподключения через 3 секунды
                    setTimeout(() => {
                        logDebug('Попытка переподключения к каналу реального времени...');
                        startRealtimeSubscription();
                    }, 3000);
                }
            });
            
        logDebug("Подписка на обновления настроена, текущий статус:", channelSubscription.state);
    } catch (error) {
        console.error("Ошибка при настройке канала:", error);
        updateConnectionStatus(false);
    }
}

// Обработчик новых сообщений
async function handleNewMessage(payload) {
    logDebug("Получено событие от Supabase:", payload);
    
    if (!payload || !payload.new) {
        console.error("Получено некорректное событие без данных");
        return;
    }
    
    // Обрабатываем только события вставки
    if (payload.eventType !== 'INSERT') {
        logDebug("Игнорируем событие, не является вставкой нового сообщения");
        return;
    }
    
    logDebug("Обработка нового сообщения с ID:", payload.new.id);
    
    // Проверяем, что текущий пользователь инициализирован
    if (!currentUser || !currentUser.id) {
        console.error("Текущий пользователь не инициализирован!");
        return;
    }
    
    // Если это не наше сообщение, загружаем полные данные
    if (payload.new.user_id !== currentUser.id) {
        try {
            logDebug("Получено новое сообщение от другого пользователя:", payload.new);
            
            // Проверяем, не отображено ли уже это сообщение
            const existingMsg = document.getElementById(`msg-${payload.new.id}`);
            if (existingMsg) {
                logDebug("Сообщение уже отображено, пропускаем:", payload.new.id);
                return;
            }
            
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    content,
                    image_url,
                    created_at,
                    user_id,
                    users (
                        id,
                        username,
                        avatar_url
                    )
                `)
                .eq('id', payload.new.id)
                .single();
                
            if (error) {
                console.error('Ошибка при получении данных сообщения:', error);
                logDebug("Использую минимальные данные для отображения сообщения");
                
                // Получаем информацию о пользователе отдельно
                let username = "Пользователь";
                let avatarUrl = getAvatarForUser(payload.new.user_id);
                
                try {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('username, avatar_url')
                        .eq('id', payload.new.user_id)
                        .single();
                        
                    if (userData) {
                        username = userData.username;
                        avatarUrl = userData.avatar_url || avatarUrl;
                    }
                } catch (userError) {
                    console.error("Не удалось получить данные пользователя:", userError);
                }
                
                // Если не удалось получить полные данные, отображаем с минимальными данными
                const minimalMessage = {
                    id: payload.new.id,
                    content: payload.new.content,
                    created_at: payload.new.created_at,
                    user_id: payload.new.user_id,
                    users: {
                        id: payload.new.user_id,
                        username: username,
                        avatar_url: avatarUrl
                    }
                };
                
                renderMessage(minimalMessage);
                scrollToBottom();
                
                // Проигрываем звук уведомления
                playNotificationSound();
                return;
            }
            
            if (data) {
                logDebug("Получены полные данные сообщения:", data);
                
                // Добавляем новое сообщение
                renderMessage(data);
                scrollToBottom();
                
                // Проигрываем звук уведомления
                playNotificationSound();
            }
        } catch (err) {
            console.error('Ошибка при обработке нового сообщения:', err);
        }
    } else {
        logDebug("Игнорируем собственное сообщение");
    }
}

// Функция для проигрывания звука уведомления (опционально)
function playNotificationSound() {
    try {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-message-pop-alert-2354.mp3');
        audio.volume = 0.3;
        audio.play();
    } catch (e) {
        console.log('Невозможно проиграть звук уведомления:', e);
    }
}

// РАЗДЕЛ 3: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// Обновление счетчика онлайн пользователей
async function updateOnlineUsers() {
    try {
        // Получаем пользователей, которые были онлайн в последние 10 минут
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const { data, error, count } = await supabase
            .from('users')
            .select('id', { count: 'exact' })
            .gt('last_seen', tenMinutesAgo);
            
        if (!error) {
            onlineUsers = count;
            onlineCountDisplay.textContent = `${onlineUsers} онлайн`;
        }
    } catch (error) {
        console.error('Ошибка при получении списка онлайн пользователей:', error);
    }
}

// Безопасное отображение HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Прокрутка к нижней части чата
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Переключение темы (заглушка)
function toggleTheme() {
    alert('Функция переключения на светлую тему в разработке!');
}

// РАЗДЕЛ 4: СЛУШАТЕЛИ СОБЫТИЙ И ИНИЦИАЛИЗАЦИЯ

// Кнопка входа в чат
enterBtn.addEventListener('click', initUser);

// Отправка сообщения по клику на кнопку
sendMessageBtn.addEventListener('click', sendMessage);

// Отправка сообщения по нажатию Enter
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// Кнопка переключения темы
themeToggleBtn.addEventListener('click', toggleTheme);

// Обновление статуса пользователя каждые 5 минут
setInterval(async () => {
    if (currentUser && currentUser.id) {
        try {
            await supabase
                .from('users')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', currentUser.id);
            
            updateOnlineUsers();
        } catch (error) {
            console.error('Ошибка при обновлении статуса:', error);
        }
    }
}, 5 * 60 * 1000);

// Дополнительный функционал: сброс данных пользователя по двойному клику на аватар
userAvatar.addEventListener('dblclick', () => {
    if (confirm('Сбросить данные пользователя?')) {
        resetUserState();
    }
});

// Обновляем статус соединения
window.addEventListener('online', function() {
    console.log('Соединение восстановлено. Переподключение к каналу...');
    updateConnectionStatus(true);
    if (currentUser) {
        startRealtimeSubscription();
        updateOnlineUsers();
    }
});

// Обновляем статус соединения при потере соединения
window.addEventListener('offline', function() {
    console.log('Соединение потеряно');
    updateConnectionStatus(false);
});

// Добавление состояния подключения
window.addEventListener('load', () => {
    if (!navigator.onLine) {
        updateConnectionStatus(false);
        alert('Вы находитесь в автономном режиме. Пожалуйста, проверьте подключение к интернету.');
    } else {
        updateConnectionStatus(true);
    }
});

// При инициализации чата проверяем работоспособность канала реального времени
async function checkRealtimeStatus() {
    try {
        logDebug("Проверка статуса подписки на реальное время...");
        
        // Проверяем доступные каналы
        const allChannels = supabase.getChannels();
        logDebug("Текущие каналы:", allChannels);
        
        try {
            const { data, error } = await supabase.rpc('get_realtime_status');
            if (error) {
                console.error("Ошибка при проверке статуса RPC:", error);
                return;
            }
            logDebug("Статус реального времени из БД:", data);
        } catch (error) {
            console.error("Ошибка при вызове RPC функции:", error);
        }
        
        // Дополнительная проверка соединения
        const isConnected = supabase.realtime.isConnected();
        logDebug("Supabase realtime соединение:", isConnected ? "Подключено" : "Отключено");
    } catch (error) {
        console.error("Ошибка при проверке статуса реального времени:", error);
    }
}

// Инициализируем клиент realtime при загрузке страницы
window.addEventListener('load', async () => {
    logDebug("Страница загружена, инициализация Supabase realtime...");
    
    // Настраиваем обработчик для отладки событий realtime
    supabase.realtime.forValidToken(token => {
        logDebug('Realtime token получен:', token && token.slice(0, 10) + '...');
        return token;
    });
    
    // Проверяем онлайн-статус
    if (!navigator.onLine) {
        updateConnectionStatus(false);
        alert('Вы находитесь в автономном режиме. Пожалуйста, проверьте подключение к интернету.');
    } else {
        updateConnectionStatus(true);
    }
});

// Функция для отправки тестового сообщения (для отладки)
async function sendTestMessage() {
    if (!currentUser) {
        console.error("Нельзя отправить тестовое сообщение - пользователь не авторизован");
        return;
    }
    
    try {
        const testMessage = `Тестовое сообщение ${new Date().toLocaleTimeString()}`;
        logDebug("Отправка тестового сообщения:", testMessage);
        
        const { data, error } = await supabase
            .from('messages')
            .insert({
                user_id: currentUser.id,
                content: testMessage
            })
            .select();
        
        if (error) {
            throw error;
        }
        
        logDebug("Тестовое сообщение отправлено успешно:", data);
        
    } catch (error) {
        console.error("Ошибка при отправке тестового сообщения:", error);
    }
}

// Отправка сообщения
async function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) {
        return; // Пустое сообщение не отправляем
    }
    
    try {
        console.log("Отправка сообщения: " + message);
        
        // Очищаем поле ввода
        messageInput.value = '';
        
        // Создаем временное сообщение для отображения
        const tempId = 'temp-' + Date.now();
        const tempMessage = {
            id: tempId,
            content: message,
            created_at: new Date().toISOString(),
            user_id: currentUser.id,
            users: {
                id: currentUser.id,
                username: currentUser.username,
                avatar_url: currentUser.avatar_url
            }
        };
        
        // Отображаем временное сообщение
        renderMessage(tempMessage);
        scrollToBottom();
        
        // Отправляем сообщение в базу данных
        console.log("Сохранение сообщения в базе данных...");
        const { data, error } = await supabase
            .from('messages')
            .insert({
                user_id: currentUser.id,
                content: message
            })
            .select()
            .single();
        
        // Удаляем временное сообщение
        const tempElement = document.getElementById(tempId);
        if (tempElement) {
            tempElement.remove();
        }
            
        if (error) {
            console.error("Ошибка при сохранении сообщения:", error);
            throw error;
        }
        
        console.log("Сообщение успешно сохранено:", data);
        
        // Получаем полное сообщение с пользовательскими данными
        const fullMessage = {
            ...data,
            users: {
                id: currentUser.id,
                username: currentUser.username,
                avatar_url: currentUser.avatar_url
            }
        };
        
        // Рендерим постоянное сообщение
        renderMessage(fullMessage);
        scrollToBottom();
        
        // Проверяем активность канала после отправки сообщения
        console.log("Текущий статус канала realtime:", channelSubscription.state);
        
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        alert('Не удалось отправить сообщение. Пожалуйста, проверьте подключение к интернету.');
    }
}

// Улучшенная функция для настройки мобильных взаимодействий
function setupMobileInteractions() {
    // Фиксация для проблем с виртуальной клавиатурой
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message');
    const messagesContainer = document.getElementById('messages-container');
    const chatInput = document.querySelector('.chat-input');
    
    // Фокусировка при касании поля ввода
    messageInput.addEventListener('focus', function() {
        // Небольшая задержка для появления клавиатуры
        setTimeout(() => {
            scrollToBottom();
            // Добавляем класс для активного состояния
            chatInput.classList.add('focus');
        }, 300);
    });
    
    // Потеря фокуса поля ввода
    messageInput.addEventListener('blur', function() {
        // Удаляем класс активного состояния
        chatInput.classList.remove('focus');
    });
    
    // Явно показываем кнопку отправки сообщения на мобильных устройствах
    messageInput.addEventListener('input', function() {
        if (messageInput.value.trim()) {
            sendMessageBtn.classList.add('visible');
        } else {
            sendMessageBtn.classList.remove('visible');
        }
    });
    
    // Делаем все кнопки более отзывчивыми на мобильных устройствах
    document.querySelectorAll('button').forEach(button => {
        // Предотвращаем "двойные нажатия" и задержку на мобильных устройствах
        button.addEventListener('touchstart', function(e) {
            e.preventDefault(); // Предотвращаем эффект зума/прокрутки
            this.classList.add('touch-active');
        }, { passive: false });
        
        button.addEventListener('touchend', function() {
            this.classList.remove('touch-active');
        });
    });
    
    // Особое внимание кнопке отправки сообщения
    sendMessageBtn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        this.classList.add('pressed');
    }, { passive: false });
    
    sendMessageBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        this.classList.remove('pressed');
        // Имитируем нажатие через setTimeout
        setTimeout(() => {
            sendMessage();
        }, 10);
    }, { passive: false });
    
    // Исправляем проблему с позиционированием на iOS
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.body.classList.add('ios-device');
        
        // Добавляем обработчик изменения размера для iOS
        window.addEventListener('resize', function() {
            // iOS отправляет событие resize при появлении клавиатуры
            // Устанавливаем переменную CSS для корректного расчета высоты
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Исправление для iOS: прокрутка к нижней части сообщений
            if (messageInput === document.activeElement) {
                setTimeout(scrollToBottom, 100);
            }
        });
    }
    
    // Оптимизация для всех мобильных устройств
    window.addEventListener('resize', function() {
        // Обновляем переменную высоты для корректного расчета
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    });
    
    // Устанавливаем оптимальную высоту при первой загрузке
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Вызов функции после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Обнаруживаем мобильное устройство
    const isMobile = window.innerWidth <= 768 || 
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // Добавляем класс для мобильных стилей
        document.body.classList.add('mobile-device');
        
        // Вызываем функцию настройки мобильных взаимодействий
        setupMobileInteractions();
    }
    
    // Дополнительное обнаружение устройства для стилизации
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        document.body.classList.add('ios-device');
    } else if (/Android/i.test(navigator.userAgent)) {
        document.body.classList.add('android-device');
    }
    
    // Адаптация под ориентацию
    window.addEventListener('orientationchange', function() {
        // Нужна задержка для корректного обновления
        setTimeout(() => {
            // Обновляем высоту viewport
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
            
            // Прокручиваем к нижней части чата
            if (messagesContainer) {
                scrollToBottom();
            }
        }, 200);
    });
}); 