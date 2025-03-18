import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCxypEXHGW58g4kUJ80qJQDSv_jOHsnh4w",
    authDomain: "chat-5fe0a.firebaseapp.com",
    projectId: "chat-5fe0a",
    storageBucket: "chat-5fe0a.firebasestorage.app",
    messagingSenderId: "494037188866",
    appId: "1:494037188866:web:9eadb1d943535e19dd821b",
    measurementId: "G-W2QDT0QKY5"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Генерация ID пользователя и сохранение в localStorage
let userId;
if (localStorage.getItem('chatUserId')) {
    userId = localStorage.getItem('chatUserId');
} else {
    userId = 'user' + Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    localStorage.setItem('chatUserId', userId);
}

// Отображение ID пользователя на странице
const userIdElement = document.getElementById('userId');
if (userIdElement) {
    userIdElement.textContent = userId;
}

// Функция отправки сообщения
window.sendMessage = async () => {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message) {
        try {
            const messageData = {
                text: message,
                userId: userId,
                timestamp: Date.now()
            };
            
            await addDoc(collection(db, "messages"), messageData);
            messageInput.value = '';
            console.log('Сообщение отправлено:', messageData); // Для отладки
        } catch (error) {
            console.error("Ошибка при отправке сообщения:", error);
            alert("Ошибка при отправке сообщения: " + error.message);
        }
    }
};

// Слушатель для клавиши Enter
const messageInput = document.getElementById('messageInput');
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Получение сообщений
const messagesDiv = document.getElementById('messages');
if (messagesDiv) {
    const q = query(
        collection(db, "messages"),
        orderBy("timestamp", "desc"),
        limit(50)
    );

    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${data.userId === userId ? 'sent' : 'received'}`;
                messageDiv.innerHTML = `
                    <div class="user-id">${data.userId}</div>
                    <div class="message-text">${escapeHtml(data.text)}</div>
                `;
                messagesDiv.insertBefore(messageDiv, messagesDiv.firstChild);
            }
        });
    }, (error) => {
        console.error("Ошибка при получении сообщений:", error);
        alert("Ошибка при получении сообщений: " + error.message);
    });
}

// Функция для безопасного отображения текста
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Проверка инициализации при загрузке
console.log('Инициализация завершена. ID пользователя:', userId);

let currentChatId = 'global';
let chats = {};

// Функция для переключения между чатами
function switchChat(chatId) {
    currentChatId = chatId;
    const chatName = chatId === 'global' ? 'Глобальный чат' : `Чат с ${chatId}`;
    document.getElementById('currentChatName').textContent = chatName;
    
    // Очищаем текущие сообщения
    document.getElementById('messages').innerHTML = '';
    
    // Загружаем сообщения для выбранного чата
    loadMessages(chatId);
    
    // Обновляем активный элемент в списке чатов
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.chat-item[data-chat-id="${chatId}"]`)?.classList.add('active');
}

// Функция загрузки сообщений
function loadMessages(chatId) {
    const messagesRef = chatId === 'global' 
        ? db.collection('messages')
        : db.collection('private_messages')
            .where('chatId', '==', chatId);

    messagesRef
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot((snapshot) => {
            const changes = [];
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    changes.push(change.doc.data());
                }
            });
            changes.reverse().forEach(data => addMessageToDOM(data));
        });
}

// Обновляем функцию отправки сообщений
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;

    const messageData = {
        text: message,
        userId: userId,
        timestamp: Date.now()
    };

    if (currentChatId === 'global') {
        // Отправка в глобальный чат
        db.collection('messages').add(messageData);
    } else {
        // Отправка личного сообщения
        messageData.chatId = currentChatId;
        db.collection('private_messages').add(messageData);
        
        // Обновляем последнее сообщение в списке чатов
        updateChatLastMessage(currentChatId, message);
    }

    messageInput.value = '';
}

// Функции для работы с модальным окном
function showNewChatModal() {
    document.getElementById('newChatModal').style.display = 'flex';
}

function hideNewChatModal() {
    document.getElementById('newChatModal').style.display = 'none';
}

// Функция поиска пользователей
function searchUsers(query) {
    if (!query) return;
    
    db.collection('users')
        .where('userId', '>=', query)
        .where('userId', '<=', query + '\uf8ff')
        .limit(10)
        .get()
        .then((snapshot) => {
            const userList = document.getElementById('userList');
            userList.innerHTML = '';
            
            snapshot.docs.forEach(doc => {
                const userData = doc.data();
                if (userData.userId !== userId) {
                    const userItem = document.createElement('div');
                    userItem.className = 'user-item';
                    userItem.textContent = userData.userId;
                    userItem.onclick = () => startChat(userData.userId);
                    userList.appendChild(userItem);
                }
            });
        });
}

// Функция создания нового чата
function startChat(otherUserId) {
    const chatId = [userId, otherUserId].sort().join('_');
    
    // Добавляем чат в список
    addChatToList(chatId, otherUserId);
    
    // Переключаемся на новый чат
    switchChat(chatId);
    
    // Закрываем модальное окно
    hideNewChatModal();
}

// Функция добавления чата в список
function addChatToList(chatId, otherUserId) {
    const chatList = document.getElementById('chatList');
    
    // Проверяем, не существует ли уже такой чат
    if (!document.querySelector(`.chat-item[data-chat-id="${chatId}"]`)) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.setAttribute('data-chat-id', chatId);
        chatItem.onclick = () => switchChat(chatId);
        
        chatItem.innerHTML = `
            <div class="chat-item-icon">
                <i class="fas fa-user"></i>
            </div>
            <div class="chat-item-info">
                <div class="chat-item-name">Чат с ${otherUserId}</div>
                <div class="chat-item-last-message"></div>
            </div>
        `;
        
        chatList.appendChild(chatItem);
    }
}

// Функция обновления последнего сообщения в списке чатов
function updateChatLastMessage(chatId, message) {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (chatItem) {
        const lastMessageEl = chatItem.querySelector('.chat-item-last-message');
        lastMessageEl.textContent = message;
    }
} 