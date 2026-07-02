class ChatWidget {
  constructor() {
    this.messages = [];
    this.isOpen = false;
    this.isStreaming = false;
    this.abortController = null;

    this.overlay = document.getElementById('chat-overlay');
    this.panel = document.getElementById('chat-panel');
    this.fab = document.getElementById('chat-fab');
    this.messagesEl = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send');
    this.statusDot = document.querySelector('.status-dot');
    this.statusText = document.querySelector('.chat-header-status span:last-child');

    this.bindEvents();
    this.checkStatus();
  }

  bindEvents() {
    document.querySelectorAll('[data-open-chat]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    });

    document.getElementById('chat-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());
    this.fab.addEventListener('click', () => this.open());
    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 100) + 'px';
    });
  }

  async checkStatus() {
    try {
      const res = await fetch('/api/chat/status');
      const data = await res.json();
      if (data.configured) {
        this.statusDot.classList.remove('offline');
        this.statusText.textContent = 'Online — typically replies instantly';
      } else {
        this.statusDot.classList.add('offline');
        this.statusText.textContent = 'Offline — LLM not configured';
      }
    } catch {
      this.statusDot.classList.add('offline');
      this.statusText.textContent = 'Offline';
    }
  }

  open() {
    this.isOpen = true;
    this.overlay.classList.add('open');
    this.panel.classList.add('open');
    this.fab.classList.add('hidden');

    if (this.messages.length === 0) {
      this.addAssistantMessage(
        "Hello! Welcome to Luxe & Living. I'm here to help with product recommendations, orders, shipping, and returns. How can I assist you today?"
      );
    }

    this.input.focus();
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.remove('open');
    this.panel.classList.remove('open');
    this.fab.classList.remove('hidden');
  }

  addMessage(role, content, streaming = false) {
    const el = document.createElement('div');
    el.className = `chat-message ${role}`;
    el.textContent = content;

    if (streaming) {
      const cursor = document.createElement('span');
      cursor.className = 'typing-cursor';
      el.appendChild(cursor);
    }

    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return el;
  }

  addAssistantMessage(content) {
    this.messages.push({ role: 'assistant', content });
    return this.addMessage('assistant', content);
  }

  addSystemNotice(content) {
    const el = document.createElement('div');
    el.className = 'chat-message system-notice';
    el.textContent = content;
    this.messagesEl.appendChild(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async send() {
    const text = this.input.value.trim();
    if (!text || this.isStreaming) return;

    this.input.value = '';
    this.input.style.height = 'auto';

    this.messages.push({ role: 'user', content: text });
    this.addMessage('user', text);

    this.isStreaming = true;
    this.sendBtn.disabled = true;

    const assistantEl = this.addMessage('assistant', '', true);
    const cursor = assistantEl.querySelector('.typing-cursor');
    let fullContent = '';

    this.abortController = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.messages }),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        cursor?.remove();
        assistantEl.textContent = '';
        assistantEl.className = 'chat-message system-notice';
        assistantEl.textContent = err.error || 'Something went wrong. Please try again.';
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              assistantEl.textContent = fullContent;
              assistantEl.appendChild(cursor);
              this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }

      cursor?.remove();
      if (fullContent) {
        this.messages.push({ role: 'assistant', content: fullContent });
      } else if (!assistantEl.textContent) {
        assistantEl.remove();
        this.addSystemNotice('No response received. Please check the LLM configuration.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        cursor?.remove();
        assistantEl.textContent = '';
        assistantEl.className = 'chat-message system-notice';
        assistantEl.textContent = 'Connection error. Please try again.';
      }
    } finally {
      this.isStreaming = false;
      this.sendBtn.disabled = false;
      this.abortController = null;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chatWidget = new ChatWidget();
});
