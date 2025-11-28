import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import './MiniChat.css'

const MiniChat = () => {
    const [isVisible, setIsVisible] = useState(false)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [userName, setUserName] = useState(() => localStorage.getItem('chatUserName') || '')
    const [isSettingName, setIsSettingName] = useState(false) // Змінено: за замовчуванням false
    const [lastReadTime, setLastReadTime] = useState(() => {
        const saved = localStorage.getItem('chatLastReadTime')
        return saved ? new Date(saved) : new Date(0)
    })
    const [onlineUsers, setOnlineUsers] = useState([])
    const [userRole, setUserRole] = useState(localStorage.getItem('chatUserRole') || 'user')
    const [privateChats, setPrivateChats] = useState([])
    const [privateLastReadTimes, setPrivateLastReadTimes] = useState(() => {
        const saved = localStorage.getItem('privateLastReadTimes')
        return saved ? JSON.parse(saved) : {}
    })
    const [allPrivateMessages, setAllPrivateMessages] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [editingMessage, setEditingMessage] = useState(null)
    const [editText, setEditText] = useState('')
    const messagesEndRef = useRef(null)
    const subscriptionsRef = useRef({})

    // Генерація унікального ID користувача
    const userId = React.useMemo(() => {
        const savedId = localStorage.getItem('chatUserId')
        if (savedId) return savedId

        const newId = 'user_' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('chatUserId', newId)
        return newId
    }, [])

    // Перевірка, чи користувач вже має ім'я при завантаженні
    useEffect(() => {
        const savedName = localStorage.getItem('chatUserName')
        if (!savedName) {
            // Якщо ім'я відсутнє, не показуємо форму відразу
            setIsSettingName(false)
        }
    }, [])

    // Завантаження історії повідомлень
    useEffect(() => {
        if (userName) { // Завантажуємо дані тільки якщо є ім'я
            fetchMessages()
            fetchAllPrivateMessages()
            fetchAllUsers()
            fetchOnlineUsers()
            setupUserPresence()
            setupRealtimeSubscriptions()
        }

        return () => {
            Object.values(subscriptionsRef.current).forEach(subscription => {
                subscription?.unsubscribe()
            })
            removeUserPresence()
        }
    }, [userName]) // Додано залежність від userName

    // Обробник відкриття чату
    const handleOpenChat = () => {
        const savedName = localStorage.getItem('chatUserName')
        if (!savedName) {
            // Якщо ім'я відсутнє, показуємо форму введення
            setIsSettingName(true)
        } else {
            // Якщо ім'я є, відкриваємо чат
            setIsVisible(true)
        }
    }

    // Завантаження ВСІХ користувачів з бази
    const fetchAllUsers = async () => {
        try {
            const { data: messagesData, error: messagesError } = await supabase
                .from('chat_messages')
                .select('user_name, user_id, role')
                .or(`user_name.neq."${userName}",target_user.neq."${userName}"`)

            if (messagesError) {
                console.error('Error fetching users from messages:', messagesError)
                return
            }

            const { data: onlineUsersData, error: onlineError } = await supabase
                .from('online_users')
                .select('user_name, user_id, role')
                .order('last_seen', { ascending: false })

            if (onlineError) {
                console.error('Error fetching users from online:', onlineError)
                return
            }

            const allUsersMap = new Map()

            if (messagesData) {
                messagesData.forEach(msg => {
                    if (msg.user_name !== userName && !allUsersMap.has(msg.user_id)) {
                        allUsersMap.set(msg.user_id, {
                            user_id: msg.user_id,
                            user_name: msg.user_name,
                            role: msg.role || 'user',
                            last_seen: new Date(0)
                        })
                    }
                })
            }

            if (onlineUsersData) {
                onlineUsersData.forEach(user => {
                    if (user.user_name !== userName) {
                        allUsersMap.set(user.user_id, {
                            user_id: user.user_id,
                            user_name: user.user_name,
                            role: user.role || 'user',
                            last_seen: new Date(user.last_seen || 0)
                        })
                    }
                })
            }

            const uniqueUsers = Array.from(allUsersMap.values())
            setAllUsers(uniqueUsers)
            console.log('All users loaded:', uniqueUsers)

        } catch (error) {
            console.error('Error in fetchAllUsers:', error)
        }
    }

    // Підписка на реальні оновлення
    const setupRealtimeSubscriptions = async () => {
        const messagesSubscription = supabase
            .channel('public-chat-messages')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages',
                },
                (payload) => {
                    handleMessageChange(payload)
                }
            )
            .subscribe()

        const onlineSubscription = supabase
            .channel('public-online-users')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'online_users',
                },
                (payload) => {
                    handleOnlineUsersChange(payload)
                }
            )
            .subscribe()

        subscriptionsRef.current.messages = messagesSubscription
        subscriptionsRef.current.online = onlineSubscription
    }

    // Завантаження ВСІХ приватних повідомлень
    const fetchAllPrivateMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('is_private', true)
                .or(`user_name.eq."${userName}",target_user.eq."${userName}"`)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching all private messages:', error)
                return
            }

            if (data) {
                setAllPrivateMessages(data)
                console.log('All private messages loaded:', data)
            }
        } catch (error) {
            console.error('Error in fetchAllPrivateMessages:', error)
        }
    }

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('is_private', false)
                .order('created_at', { ascending: true })
                .limit(100)

            if (error) {
                console.error('Error fetching messages:', error)
                return
            }

            if (data) {
                setMessages(data)
            }
        } catch (error) {
            console.error('Error in fetchMessages:', error)
        }
    }

    const fetchOnlineUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('online_users')
                .select('*')
                .gte('last_seen', new Date(Date.now() - 2 * 60 * 1000).toISOString())

            if (!error && data) {
                setOnlineUsers(data)
            }
        } catch (error) {
            console.error('Error fetching online users:', error)
        }
    }

    const handleMessageChange = (payload) => {
        console.log('Message change received:', payload)

        try {
            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new

                if (!newMessage.is_private) {
                    setMessages(prev => {
                        if (prev.some(msg => msg.id === newMessage.id)) {
                            return prev
                        }
                        return [...prev, newMessage]
                    })

                    if (isVisible) {
                        setTimeout(updateLastReadTime, 100)
                    }
                }

                if (newMessage.is_private) {
                    setAllPrivateMessages(prev => {
                        if (prev.some(msg => msg.id === newMessage.id)) {
                            return prev
                        }
                        return [...prev, newMessage]
                    })

                    setPrivateChats(prev => prev.map(chat => {
                        const shouldIncludeMessage =
                            (newMessage.user_name === userName && newMessage.target_user === chat.user.user_name) ||
                            (newMessage.user_name === chat.user.user_name && newMessage.target_user === userName)

                        if (shouldIncludeMessage) {
                            if (chat.messages.some(msg => msg.id === newMessage.id)) {
                                return chat
                            }
                            return {
                                ...chat,
                                messages: [...chat.messages, newMessage]
                            }
                        }
                        return chat
                    }))

                    // Додаємо нового користувача в список, якщо його ще немає
                    if (newMessage.user_name !== userName) {
                        setAllUsers(prev => {
                            const userExists = prev.some(user => user.user_name === newMessage.user_name)
                            if (!userExists) {
                                return [...prev, {
                                    user_id: newMessage.user_id,
                                    user_name: newMessage.user_name,
                                    role: newMessage.role || 'user',
                                    last_seen: new Date(0)
                                }]
                            }
                            return prev
                        })
                    }
                }
            }
            else if (payload.eventType === 'UPDATE') {
                const updatedMessage = payload.new

                if (!updatedMessage.is_private) {
                    setMessages(prev => prev.map(msg =>
                        msg.id === updatedMessage.id ? updatedMessage : msg
                    ))
                }

                if (updatedMessage.is_private) {
                    setAllPrivateMessages(prev => prev.map(msg =>
                        msg.id === updatedMessage.id ? updatedMessage : msg
                    ))

                    setPrivateChats(prev => prev.map(chat => ({
                        ...chat,
                        messages: chat.messages.map(msg =>
                            msg.id === updatedMessage.id ? updatedMessage : msg
                        )
                    })))
                }
            }
            else if (payload.eventType === 'DELETE') {
                const deletedMessageId = payload.old.id

                setMessages(prev => prev.filter(msg => msg.id !== deletedMessageId))
                setAllPrivateMessages(prev => prev.filter(msg => msg.id !== deletedMessageId))

                setPrivateChats(prev => prev.map(chat => ({
                    ...chat,
                    messages: chat.messages.filter(msg => msg.id !== deletedMessageId)
                })))
            }
        } catch (error) {
            console.error('Error handling message change:', error)
        }
    }

    const handleOnlineUsersChange = (payload) => {
        console.log('Online users change:', payload)

        try {
            if (payload.eventType === 'INSERT') {
                setOnlineUsers(prev => {
                    const filtered = prev.filter(u => u.user_id !== payload.new.user_id)
                    return [...filtered, payload.new]
                })

                setAllUsers(prev => {
                    const filtered = prev.filter(u => u.user_id !== payload.new.user_id)
                    return [...filtered, payload.new]
                })
            } else if (payload.eventType === 'UPDATE') {
                setOnlineUsers(prev => prev.map(u =>
                    u.user_id === payload.new.user_id ? payload.new : u
                ))

                setAllUsers(prev => prev.map(u =>
                    u.user_id === payload.new.user_id ? payload.new : u
                ))
            } else if (payload.eventType === 'DELETE') {
                setOnlineUsers(prev => prev.filter(u => u.user_id !== payload.old.user_id))
            }
        } catch (error) {
            console.error('Error handling online users change:', error)
        }
    }

    // Налаштування присутності користувача
    const setupUserPresence = async () => {
        if (!userName) return

        try {
            const userData = {
                user_id: userId,
                user_name: userName,
                role: userRole,
                last_seen: new Date().toISOString()
            }

            const { error } = await supabase
                .from('online_users')
                .upsert(userData, {
                    onConflict: 'user_id'
                })

            if (error) {
                console.error('Error setting up user presence:', error)
                return
            }

            const presenceInterval = setInterval(async () => {
                try {
                    await supabase
                        .from('online_users')
                        .update({ last_seen: new Date().toISOString() })
                        .eq('user_id', userId)
                } catch (error) {
                    console.error('Error updating presence:', error)
                }
            }, 15000)

            window.addEventListener('beforeunload', removeUserPresence)

            return () => {
                clearInterval(presenceInterval)
                removeUserPresence()
            }
        } catch (error) {
            console.error('Error in setupUserPresence:', error)
        }
    }

    // Видалення користувача з онлайн
    const removeUserPresence = async () => {
        try {
            await supabase
                .from('online_users')
                .delete()
                .eq('user_id', userId)
        } catch (error) {
            console.error('Error removing user presence:', error)
        }
    }

    // Оновлення часу останнього прочитання для загального чату
    const updateLastReadTime = () => {
        const now = new Date()
        setLastReadTime(now)
        localStorage.setItem('chatLastReadTime', now.toISOString())
    }

    // Оновлення часу останнього прочитання для приватного чату
    const updatePrivateLastReadTime = (targetUserName) => {
        const now = new Date()
        setPrivateLastReadTimes(prev => {
            const newTimes = {
                ...prev,
                [targetUserName]: now.toISOString()
            }
            localStorage.setItem('privateLastReadTimes', JSON.stringify(newTimes))
            return newTimes
        })
    }

    // Підрахунок непрочитаних повідомлень для загального чату
    const getUnreadCount = () => {
        return messages.filter(message => {
            const messageTime = new Date(message.created_at)
            return messageTime > lastReadTime && message.user_name !== userName
        }).length
    }

    // Підрахунок непрочитаних повідомлень для приватних чатів
    const getPrivateUnreadCount = (targetUserName) => {
        if (!targetUserName) return 0

        const lastRead = privateLastReadTimes[targetUserName]
            ? new Date(privateLastReadTimes[targetUserName])
            : new Date(0)

        const userPrivateMessages = allPrivateMessages.filter(message =>
            (message.user_name === userName && message.target_user === targetUserName) ||
            (message.user_name === targetUserName && message.target_user === userName)
        )

        const unreadCount = userPrivateMessages.filter(message => {
            const messageTime = new Date(message.created_at)
            return messageTime > lastRead && message.user_name !== userName
        }).length

        console.log(`Unread messages from ${targetUserName}:`, unreadCount)
        return unreadCount
    }

    // Перевірка, чи є непрочитані повідомлення від користувача
    const hasUnreadPrivateMessages = (user) => {
        const unreadCount = getPrivateUnreadCount(user.user_name)
        return unreadCount > 0
    }

    // Отримати загальну кількість непрочитаних приватних повідомлень
    const getTotalPrivateUnreadCount = () => {
        return allUsers.reduce((total, user) => {
            return total + getPrivateUnreadCount(user.user_name)
        }, 0)
    }

    // Перевірка, чи користувач онлайн
    const isUserOnline = (user) => {
        return onlineUsers.some(onlineUser =>
            onlineUser.user_id === user.user_id &&
            new Date(onlineUser.last_seen) > new Date(Date.now() - 2 * 60 * 1000)
        )
    }

    // РЕДАГУВАННЯ ПОВІДОМЛЕННЯ
    const startEditingMessage = (message) => {
        if (message.user_id !== userId) {
            alert('Ви можете редагувати тільки свої повідомлення')
            return
        }
        setEditingMessage(message)
        setEditText(message.message)
    }

    const cancelEditing = () => {
        setEditingMessage(null)
        setEditText('')
    }

    const saveEditedMessage = async () => {
        if (!editText.trim() || !editingMessage) return

        try {
            const { error } = await supabase
                .from('chat_messages')
                .update({ message: editText.trim() })
                .eq('id', editingMessage.id)

            if (error) {
                console.error('Error updating message:', error)
                alert('Помилка оновлення повідомлення')
                return
            }

            setEditingMessage(null)
            setEditText('')
        } catch (error) {
            console.error('Error in saveEditedMessage:', error)
            alert('Помилка оновлення повідомлення')
        }
    }

    // ВИДАЛЕННЯ ПОВІДОМЛЕННЯ
    const deleteMessage = async (messageId, isPrivate = false) => {
        try {
            // Перевіряємо, чи це повідомлення належить користувачу
            const messageToDelete = isPrivate
                ? allPrivateMessages.find(m => m.id === messageId)
                : messages.find(m => m.id === messageId)

            if (!messageToDelete) {
                alert('Повідомлення не знайдено')
                return
            }

            if (messageToDelete.user_id !== userId) {
                alert('Ви можете видаляти тільки свої повідомлення')
                return
            }

            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('id', messageId)

            if (error) {
                console.error('Error deleting message:', error)
                alert('Помилка видалення повідомлення')
                return
            }

            console.log('Повідомлення видалено')
        } catch (error) {
            console.error('Error in deleteMessage:', error)
            alert('Помилка видалення повідомлення')
        }
    }

    // ВИДАЛЕННЯ ВСІЄЇ ПЕРЕПИСКИ З КОРИСТУВАЧЕМ
    const deletePrivateChat = async (targetUser) => {
        if (!window.confirm(`Видалити всю переписку з ${targetUser.user_name}? Цю дію не можна скасувати.`)) {
            return
        }

        try {
            const { error } = await supabase
                .from('chat_messages')
                .delete()
                .eq('is_private', true)
                .or(`and(user_name.eq."${userName}",target_user.eq."${targetUser.user_name}"),and(user_name.eq."${targetUser.user_name}",target_user.eq."${userName}")`)

            if (error) {
                console.error('Error deleting private chat:', error)
                alert('Помилка видалення переписки')
                return
            }

            // Закриваємо вікно приватного чату
            closePrivateChat(`private_${targetUser.user_id}`)
            alert('Переписка видалена')
        } catch (error) {
            console.error('Error in deletePrivateChat:', error)
            alert('Помилка видалення переписки')
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
        if (isVisible) {
            updateLastReadTime()
        }
    }, [messages, isVisible])

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || !userName) return

        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert([{
                    message: newMessage.trim(),
                    user_name: userName,
                    user_id: userId,
                    role: userRole,
                    is_private: false
                }])

            if (error) {
                console.error('Error sending message:', error)
                alert('Помилка відправки повідомлення')
                return
            }

            setNewMessage('')
        } catch (error) {
            console.error('Error in sendMessage:', error)
            alert('Помилка відправки повідомлення')
        }
    }

    // Перевірка унікальності імені
    const checkUserNameUnique = async (name) => {
        try {
            const { data } = await supabase
                .from('online_users')
                .select('user_name')
                .eq('user_name', name.trim())
                .neq('user_id', userId)

            return !data || data.length === 0
        } catch (error) {
            console.error('Error checking username uniqueness:', error)
            return true
        }
    }

    const saveUserName = async (e) => {
        e.preventDefault()
        if (!userName.trim()) return

        try {
            const isUnique = await checkUserNameUnique(userName)
            if (!isUnique) {
                alert('Це ім\'я вже зайняте. Виберіть інше.')
                return
            }

            localStorage.setItem('chatUserName', userName.trim())
            localStorage.setItem("chatUserRole", userRole)
            setIsSettingName(false)
            setIsVisible(true) // Автоматично відкриваємо чат після введення імені
            updateLastReadTime()

            await setupUserPresence()
        } catch (error) {
            console.error('Error saving username:', error)
            alert('Помилка збереження імені')
        }
    }

    // Відкриття приватного чату
    const openPrivateChat = async (user) => {
        console.log('Opening private chat with:', user)

        updatePrivateLastReadTime(user.user_name)

        const existingChatIndex = privateChats.findIndex(chat => chat.user.user_id === user.user_id)

        if (existingChatIndex !== -1) {
            const updatedMessages = await fetchPrivateMessages(user)
            setPrivateChats(prev => prev.map((chat, index) =>
                index === existingChatIndex
                    ? { ...chat, messages: updatedMessages }
                    : chat
            ))
            return
        }

        try {
            const privateMessages = await fetchPrivateMessages(user)

            const newChat = {
                id: `private_${user.user_id}`,
                user: user,
                position: {
                    x: 300 + privateChats.length * 30,
                    y: 100 + privateChats.length * 30
                },
                messages: privateMessages
            }

            setPrivateChats(prev => [...prev, newChat])
        } catch (error) {
            console.error('Помилка відкриття приватного чату:', error)
            alert('Помилка відкриття приватного чату')
        }
    }

    // Завантаження приватних повідомлень
    const fetchPrivateMessages = async (user) => {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('is_private', true)
                .or(`and(user_name.eq."${userName}",target_user.eq."${user.user_name}"),and(user_name.eq."${user.user_name}",target_user.eq."${userName}")`)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching private messages:', error)
                return []
            }

            return data || []
        } catch (error) {
            console.error('Error in fetchPrivateMessages:', error)
            return []
        }
    }

    // Закриття приватного чату
    const closePrivateChat = (chatId) => {
        setPrivateChats(prev => prev.filter(chat => chat.id !== chatId))
    }

    // Відправка приватного повідомлення
    const sendPrivateMessage = async (targetUser, messageText) => {
        if (!messageText.trim()) return

        try {
            const { error } = await supabase
                .from('chat_messages')
                .insert([{
                    message: messageText.trim(),
                    user_name: userName,
                    user_id: userId,
                    role: userRole,
                    is_private: true,
                    target_user: targetUser.user_name
                }])

            if (error) {
                console.error('Error sending private message:', error)
                alert('Помилка відправки приватного повідомлення')
                return
            }

            console.log('Приватне повідомлення відправлено:', messageText)
        } catch (error) {
            console.error('Error in sendPrivateMessage:', error)
            alert('Помилка відправки приватного повідомлення')
        }
    }

    // Оновлення позиції вікна
    const updateChatPosition = (chatId, newPosition) => {
        setPrivateChats(prev => prev.map(chat =>
            chat.id === chatId ? { ...chat, position: newPosition } : chat
        ))
    }

    // Функція для форматування часу
    const formatMessageTime = (timestamp) => {
        try {
            const messageTime = new Date(timestamp)
            return messageTime.toLocaleTimeString('uk-UA', {
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch (error) {
            return '--:--'
        }
    }

    // Обробник закриття форми введення імені
    const handleCancelNameSetup = () => {
        setIsSettingName(false)
    }

    if (isSettingName) {
        return (
            <div className="mini-chat-container bottom-right">
                <div className="mini-chat-name-setup">
                    <div className="mini-chat-header">
                        <h4>Введіть ваше ім'я</h4>
                        <small>Оберіть унікальне ім'я</small>
                        <button
                            className="mini-close-btn"
                            onClick={handleCancelNameSetup}
                            title="Скасувати"
                        >
                            ×
                        </button>
                    </div>
                    <form onSubmit={saveUserName} className="mini-name-form">
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Ваше унікальне ім'я"
                            autoFocus
                            maxLength={20}
                        />
                        <div className="name-form-buttons">
                            <button type="button" onClick={handleCancelNameSetup} className="mini-cancel-btn">
                                Скасувати
                            </button>
                            <button type="submit" className="mini-save-btn">Зберегти</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    const unreadCount = getUnreadCount()
    const totalPrivateUnreadCount = getTotalPrivateUnreadCount()

    return (
        <>
            <div className={`mini-chat-container bottom-right ${isVisible ? 'visible' : 'hidden'}`}>
                {isVisible ? (
                    <div className="mini-chat-window">
                        <div className="mini-chat-header">
                            <div className="mini-chat-title">
                                <span>💬 Чат ({userRole})</span>
                                <small>
                                    {userName} • {unreadCount > 0 ? `${unreadCount} непрочитаних` : 'всі прочитані'}
                                    {totalPrivateUnreadCount > 0 && ` • ${totalPrivateUnreadCount} приватних`}
                                </small>
                            </div>
                            <button
                                className="mini-close-btn"
                                onClick={() => setIsVisible(false)}
                                title="Приховати чат"
                            >
                                −
                            </button>
                        </div>

                        <div className="online-users-panel">
                            <div className="online-users-header">
                                <span>Користувачі ({allUsers.length})</span>
                            </div>
                            <div className="online-users-list">
                                <div className="online-user-item">
                                    <span className="user-status current-user">
                                        ● {userName} ({userRole}) - ви
                                    </span>
                                </div>
                                {allUsers.map(user => (
                                    <UserItem
                                        key={user.user_id}
                                        user={user}
                                        isOnline={isUserOnline(user)}
                                        hasUnread={hasUnreadPrivateMessages(user)}
                                        onOpenPrivateChat={openPrivateChat}
                                        onDeleteChat={() => deletePrivateChat(user)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="mini-messages-container">
                            {messages.length === 0 ? (
                                <div className="mini-no-messages">
                                    <p>Повідомлень ще немає</p>
                                    <small>Будьте першим!</small>
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <MiniMessage
                                        key={message.id}
                                        message={message}
                                        currentUser={userName}
                                        currentUserId={userId}
                                        onEdit={startEditingMessage}
                                        onDelete={() => deleteMessage(message.id, false)}
                                        isUnread={new Date(message.created_at) > lastReadTime && message.user_name !== userName}
                                        formatTime={formatMessageTime}
                                        onPrivateMessage={(userName) => {
                                            const user = allUsers.find(u => u.user_name === userName)
                                            if (user) openPrivateChat(user)
                                        }}
                                        isEditing={editingMessage?.id === message.id}
                                        editText={editText}
                                        onEditTextChange={setEditText}
                                        onSaveEdit={saveEditedMessage}
                                        onCancelEdit={cancelEditing}
                                    />
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="mini-message-form">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Повідомлення..."
                                maxLength={200}
                            />
                            <button
                                type="submit"
                                className="mini-send-btn"
                                disabled={!newMessage.trim()}
                            >
                                ➤
                            </button>
                        </form>
                    </div>
                ) : (
                    <button
                        className="mini-chat-toggle-btn"
                        onClick={handleOpenChat} // Використовуємо новий обробник
                        title="Відкрити чат"
                    >
                        💬
                        {(unreadCount > 0 || totalPrivateUnreadCount > 0) && (
                            <span className="mini-notification-badge">
                                {unreadCount + totalPrivateUnreadCount > 9 ? '9+' : unreadCount + totalPrivateUnreadCount}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Приватні чати */}
            {privateChats.map(chat => (
                <PrivateChatWindow
                    key={chat.id}
                    chat={chat}
                    currentUser={userName}
                    currentUserId={userId}
                    onSendMessage={sendPrivateMessage}
                    onClose={closePrivateChat}
                    onPositionChange={updateChatPosition}
                    formatTime={formatMessageTime}
                    onReloadMessages={() => openPrivateChat(chat.user)}
                    onMarkAsRead={() => updatePrivateLastReadTime(chat.user.user_name)}
                    onDeleteMessage={(messageId) => deleteMessage(messageId, true)}
                    onEditMessage={startEditingMessage}
                    editingMessage={editingMessage}
                    editText={editText}
                    onEditTextChange={setEditText}
                    onSaveEdit={saveEditedMessage}
                    onCancelEdit={cancelEditing}
                    onDeleteChat={() => deletePrivateChat(chat.user)}
                />
            ))}
        </>
    )
}

// Компонент користувача (онлайн та офлайн)
const UserItem = ({ user, isOnline, hasUnread, onOpenPrivateChat, onDeleteChat }) => {
    const [showActions, setShowActions] = useState(false)

    return (
        <div
            className="online-user-item"
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
        >
            <span className={`user-status ${isOnline ? 'user-online' : 'user-offline'} ${hasUnread ? 'user-has-unread' : ''}`}>
                {isOnline ? '●' : '○'} {user.user_name} ({user.role})
                {hasUnread && <span className="private-unread-indicator" title="Непрочитані повідомлення">🔴</span>}
                {!isOnline && <span className="offline-label" title="Офлайн"> (офлайн)</span>}
            </span>
            <div className="user-actions">
                {showActions && (
                    <button
                        className="delete-chat-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteChat(user)
                        }}
                        title="Видалити переписку"
                    >
                        🗑️
                    </button>
                )}
                <button
                    className="private-chat-btn"
                    onClick={() => onOpenPrivateChat(user)}
                    title={isOnline ? "Відкрити приватний чат" : "Відкрити історію листування"}
                >
                    💬
                </button>
            </div>
        </div>
    )
}

// Компонент приватного чату з додатковими функціями
const PrivateChatWindow = ({
                               chat,
                               currentUser,
                               currentUserId,
                               onSendMessage,
                               onClose,
                               onPositionChange,
                               formatTime,
                               onReloadMessages,
                               onMarkAsRead,
                               onDeleteMessage,
                               onEditMessage,
                               editingMessage,
                               editText,
                               onEditTextChange,
                               onSaveEdit,
                               onCancelEdit,
                               onDeleteChat
                           }) => {
    const [message, setMessage] = useState('')
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const windowRef = useRef(null)
    const messagesEndRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
        onMarkAsRead()
    }, [chat.messages, onMarkAsRead])

    const handleMouseDown = (e) => {
        if (e.target.closest('.private-chat-header')) {
            setIsDragging(true)
            const rect = windowRef.current.getBoundingClientRect()
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            })
        }
    }

    const handleMouseMove = (e) => {
        if (isDragging) {
            const newX = e.clientX - dragOffset.x
            const newY = e.clientY - dragOffset.y

            onPositionChange(chat.id, { x: newX, y: newY })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)

            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, dragOffset])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (message.trim()) {
            onSendMessage(chat.user, message)
            setMessage('')
        }
    }

    const handleReloadMessages = () => {
        onReloadMessages()
    }

    return (
        <div
            ref={windowRef}
            className="private-chat-window"
            style={{
                left: `${chat.position.x}px`,
                top: `${chat.position.y}px`
            }}
        >
            <div
                className="private-chat-header"
                onMouseDown={handleMouseDown}
            >
                <div className="private-chat-title">
                    💬 Приватно: {chat.user.user_name}
                </div>
                <div className="private-chat-actions">
                    <button
                        className="delete-chat-btn"
                        onClick={() => onDeleteChat(chat.user)}
                        title="Видалити всю переписку"
                    >
                        🗑️
                    </button>
                    <button
                        className="private-chat-reload"
                        onClick={handleReloadMessages}
                        title="Оновити повідомлення"
                    >
                        🔄
                    </button>
                    <button
                        className="private-chat-close"
                        onClick={() => onClose(chat.id)}
                    >
                        ×
                    </button>
                </div>
            </div>

            <div className="private-chat-messages">
                {chat.messages.length === 0 ? (
                    <div className="no-private-messages">
                        <p>Приватних повідомлень ще немає</p>
                        <small>Почніть розмову!</small>
                    </div>
                ) : (
                    chat.messages.map((message) => (
                        <PrivateMessage
                            key={message.id}
                            message={message}
                            currentUser={currentUser}
                            currentUserId={currentUserId}
                            onEdit={onEditMessage}
                            onDelete={() => onDeleteMessage(message.id)}
                            formatTime={formatTime}
                            isEditing={editingMessage?.id === message.id}
                            editText={editText}
                            onEditTextChange={onEditTextChange}
                            onSaveEdit={onSaveEdit}
                            onCancelEdit={onCancelEdit}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="private-chat-form">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Повідомлення для ${chat.user.user_name}...`}
                    maxLength={200}
                    autoComplete="off"
                />
                <button
                    type="submit"
                    disabled={!message.trim()}
                    title="Відправити"
                >
                    ➤
                </button>
            </form>
        </div>
    )
}

// Компонент приватного повідомлення з редагуванням
const PrivateMessage = ({
                            message,
                            currentUser,
                            currentUserId,
                            onEdit,
                            onDelete,
                            formatTime,
                            isEditing,
                            editText,
                            onEditTextChange,
                            onSaveEdit,
                            onCancelEdit
                        }) => {
    const isOwnMessage = message.user_id === currentUserId

    if (isEditing) {
        return (
            <div className={`private-message ${isOwnMessage ? 'private-own-message' : ''} editing`}>
                <div className="edit-message-form">
                    <input
                        type="text"
                        value={editText}
                        onChange={(e) => onEditTextChange(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') onSaveEdit()
                            if (e.key === 'Escape') onCancelEdit()
                        }}
                        autoFocus
                    />
                    <div className="edit-actions">
                        <button onClick={onSaveEdit} title="Зберегти">💾</button>
                        <button onClick={onCancelEdit} title="Скасувати">❌</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`private-message ${isOwnMessage ? 'private-own-message' : ''}`}>
            <div className="private-message-header">
                <span className="private-message-author">
                    {message.user_name}
                </span>
                <span className="private-message-time">
                    {formatTime(message.created_at)}
                </span>
            </div>
            <div className="private-message-content">
                <p>{message.message}</p>
                {isOwnMessage && (
                    <div className="private-message-actions">
                        <button
                            onClick={() => onEdit(message)}
                            title="Редагувати"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={() => onDelete(message.id)}
                            title="Видалити"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// Компонент повідомлення з редагуванням
const MiniMessage = ({
                         message,
                         currentUser,
                         currentUserId,
                         onEdit,
                         onDelete,
                         isUnread,
                         formatTime,
                         onPrivateMessage,
                         isEditing,
                         editText,
                         onEditTextChange,
                         onSaveEdit,
                         onCancelEdit
                     }) => {
    const isOwnMessage = message.user_id === currentUserId

    if (isEditing) {
        return (
            <div className={`mini-message ${isOwnMessage ? 'mini-own-message' : ''} editing`}>
                <div className="edit-message-form">
                    <input
                        type="text"
                        value={editText}
                        onChange={(e) => onEditTextChange(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') onSaveEdit()
                            if (e.key === 'Escape') onCancelEdit()
                        }}
                        autoFocus
                    />
                    <div className="edit-actions">
                        <button onClick={onSaveEdit} title="Зберегти">💾</button>
                        <button onClick={onCancelEdit} title="Скасувати">❌</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`mini-message ${isOwnMessage ? 'mini-own-message' : ''} ${isUnread ? 'mini-unread-message' : ''}`}>
            <div className="mini-message-header">
                <span className="mini-message-author">
                    {message.user_name}
                    {message.role && <span className="user-role">({message.role})</span>}
                </span>
                <span className="mini-message-time">
                    {formatTime(message.created_at)}
                    {isUnread && <span className="mini-unread-dot" title="Непрочитане"></span>}
                </span>
            </div>

            <div className="mini-message-content">
                <p>{message.message}</p>
                <div className="mini-message-actions">
                    {!isOwnMessage && (
                        <button
                            onClick={() => onPrivateMessage(message.user_name)}
                            title="Відкрити приватний чат"
                        >
                            💬
                        </button>
                    )}
                    {isOwnMessage && (
                        <>
                            <button
                                onClick={() => onEdit(message)}
                                title="Редагувати"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => onDelete(message.id)}
                                title="Видалити"
                            >
                                🗑️
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default MiniChat