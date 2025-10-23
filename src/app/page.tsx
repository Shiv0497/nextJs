'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database } from '../types/supabase';
import { get, set } from 'idb-keyval';

type Message = Database['public']['Tables']['messages']['Row'];

// Extend Message to allow string or number IDs for local temporary messages
type LocalMessage = Omit<Message, 'id'> & {
  id: number | string;
};

export default function Home() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [content, setContent] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  const [syncQueue, setSyncQueue] = useState<LocalMessage[]>([]);

  // Load syncQueue from IndexedDB on mount
  useEffect(() => {
    setHasMounted(true);
    async function loadQueue() {
      const storedQueue = await get('syncQueue');
      if (storedQueue && Array.isArray(storedQueue)) {
        setSyncQueue(storedQueue);
      }
    }
    loadQueue();
  }, []);

  // Save syncQueue to IndexedDB whenever it changes
  useEffect(() => {
    if (!hasMounted) return;
    set('syncQueue', syncQueue).then(() => {
      // After persisting locally, trigger auto sync
      if (syncQueue.length > 0) {
        syncMessages();
      }
    });
  }, [syncQueue, hasMounted]);

  // Fetch messages from Supabase on mount
  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        setMessages([]);
      } else if (data) {
        setMessages(data);
      }
    }
    fetchMessages();
  }, []);

  // Add message locally and queue for sync
  function addMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: LocalMessage = {
      id: tempId,
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [newMessage, ...prev]);
    setSyncQueue((prev) => [...prev, newMessage]);
    setContent('');
  }

  // Sync queued messages to Supabase DB
  async function syncMessages() {
    if (syncQueue.length === 0) return;

    const messagesToSync = [...syncQueue];

    const { data, error } = await supabase
      .from('messages')
      .insert(messagesToSync.map(({ id, ...msg }) => msg))
      .select();

    if (error) {
      console.error('Sync error:', error);
      return;
    }

    if (data) {
      // Replace temp messages with DB persisted messages
      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => !m.id.toString().startsWith('temp-')
        );
        return [...data, ...filtered];
      });
      // Clear sync queue which will also update IndexedDB
      setSyncQueue([]);
    }
  }

  // Realtime subscription to new messages inserted by others
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === newMsg.id) ? prev : [newMsg, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
