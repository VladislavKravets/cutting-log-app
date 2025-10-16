// utils/supabaseCheck.js
import { supabase } from '../supabaseClient';

export const checkSupabaseRealtime = async () => {
    try {
        console.log('🔍 Перевірка налаштувань Supabase...');

        // Перевіряємо підключення до БД
        const { data, error } = await supabase
            .from('notifications')
            .select('count')
            .limit(1);

        if (error) {
            console.error('❌ Помилка підключення до БД:', error);
            return false;
        }

        console.log('✅ Підключення до БД успішне');

        // Перевіряємо real-time підписку
        return new Promise((resolve) => {
            const channel = supabase.channel('test-connection');

            const timeout = setTimeout(() => {
                console.warn('⚠️ Timeout перевірки real-time підключення');
                channel.unsubscribe();
                resolve(false);
            }, 5000);

            channel
                .on('system', { event: 'connected' }, () => {
                    console.log('✅ Real-time підключення успішне');
                    clearTimeout(timeout);
                    channel.unsubscribe();
                    resolve(true);
                })
                .on('system', { event: 'disconnected' }, () => {
                    console.error('❌ Real-time підключення втрачено');
                    clearTimeout(timeout);
                    channel.unsubscribe();
                    resolve(false);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Real-time канал підписано');
                    }
                });
        });

    } catch (error) {
        console.error('❌ Помилка перевірки Supabase:', error);
        return false;
    }
};