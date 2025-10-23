'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Database } from '../types/supabase';
import { get, set } from 'idb-keyval'; // IndexedDB helper

type Message = Database['public']['Tables']['messages']['Row'] & {
  id: number | string;
};

type LocalMessage = Omit<Message, 'id'> & {
  id: number | string;
};

export default function Home() {
  const [content, setContent] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
 const [messages, setMessages] = useState<LocalMessage[]>([]);
const [syncQueue, setSyncQueue] = useState<LocalMessage[]>([]);
  
  // Load queued messages from IndexedDB on mount
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

  // Persist queue changes to IndexedDB
  useEffect(() => {
    if (!hasMounted) return;
    set('syncQueue', syncQueue);
  }, [syncQueue, hasMounted]);

  // Fetch initial messages from Supabase
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

  // Manual sync triggered by button
  async function syncMessages() {
    console.log('syncQueue.length',syncQueue.length)
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
      // Replace temp messages with real DB messages
      setMessages((prev) => {
        // Remove temp messages
        const filtered = prev.filter(
          (m) => !m.id.toString().startsWith('temp-')
        );
        return [...data, ...filtered];
      });
      setSyncQueue([]); // Clear queue in state & IndexedDB via effect
    }
  }

  // Realtime subscription to insert events
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
      <button onClick={syncMessages} style={{ marginBottom: 20, padding: 8 }}>
        Sync Now
      </button>
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
