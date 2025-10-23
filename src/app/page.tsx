'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database } from '../types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
       alert("ABC");
       console.log(!hasMounted);

    // if (!hasMounted) return;
    // if (!hasMounted) return;  // <— return null instead of <div>
 
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        setMessages([]);
      } else if (!data) {
        console.warn('No data received from Supabase');
        setMessages([]);
      } else {
        setMessages(data);
      }
    }

    fetchMessages();

    // const channel = supabase
    //   .channel('messages-realtime')
    //   .on('postgres_changes',
    //     { event: 'INSERT', schema: 'public', table: 'messages' },
    //     (payload) => {
    //       setMessages((current) => [payload.new as Message, ...current]);
    //     }
    //   )
    //   .subscribe();

    // return () => {
    //   supabase.removeChannel(channel);
    // };
  }, []);

  async function addMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    const { data, error } = await supabase
      .from('messages')
      .insert([{ content }])
      .select();

    if (error) {
      console.error('Insert error:', error);
      return;
    }

    if (data && data.length > 0) {
      setMessages((prev) => [data[0], ...prev]);
      setContent('');
    }
  }

  // if (!hasMounted) return null;

  return (
    <main style={{ maxWidth: 600, margin: 'auto', padding: 20 }}>
      <h1>Messages</h1>
      <form onSubmit={addMessage} style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a message"
          required
          style={{ width: '80%', padding: 8 }}
        />
        <button type="submit" style={{ padding: '8px 12px', marginLeft: 8 }}>
          Add
        </button>
      </form>

      <ul>
        {messages.map(({ id, content }) => (
          <li key={id} style={{ padding: '8px 0', borderBottom: '1px solid #ccc' }}>
            {content}
          </li>
        ))}
      </ul>
    </main>
  );
}
