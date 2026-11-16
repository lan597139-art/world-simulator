import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, MessageCircle, Send, User, X } from 'lucide-react'
import { listFriends, type Friend } from '../../api/communitySocial'
import {
  getMessageHistory, listConversations, sendDirectMessage,
  type Conversation, type DirectMessage, type SocialAuthor,
} from '../../api/socialCore'
import { resolveMediaUrl, uploadMedia } from '../../api/media'
import '../../styles/social-core.css'

type Lang = 'zh' | 'en'

function fmt(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function toAuthor(friend: Friend): SocialAuthor {
  return {
    id: friend.id, username: friend.username, display_name: friend.display_name || friend.username,
    bio: friend.bio || '', avatar: friend.avatar || '', is_owner: Boolean(friend.is_owner),
  }
}

export default function SocialMessagesPanel({
  lang, initialPeerId, onOpenProfile, onPeerConsumed,
}: {
  lang: Lang
  initialPeerId?: string
  onOpenProfile: (userId: string) => void
  onPeerConsumed: () => void
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [peer, setPeer] = useState<SocialAuthor | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadLists = async () => {
    try {
      const [rows, friendRows] = await Promise.all([listConversations(), listFriends()])
      setConversations(rows); setFriends(friendRows); setError('')
      return friendRows
    } catch (reason) { setError(reason instanceof Error ? reason.message : '私信列表加载失败'); return [] }
  }

  const openPeer = async (author: SocialAuthor) => {
    setPeer(author); setLoading(true); setError('')
    try { setMessages(await getMessageHistory(author.id)); await loadLists() }
    catch (reason) { setMessages([]); setError(reason instanceof Error ? reason.message : '会话加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    void (async () => {
      const friendRows = await loadLists()
      if (!initialPeerId) return
      const known = friendRows.find((item) => item.id === initialPeerId)
      const fromConversation = conversations.find((item) => item.user.id === initialPeerId)?.user
      if (known) await openPeer(toAuthor(known))
      else if (fromConversation) await openPeer(fromConversation)
      onPeerConsumed()
    })()
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [initialPeerId])

  useEffect(() => {
    if (!peer) return
    const timer = window.setInterval(() => {
      void getMessageHistory(peer.id).then(setMessages).catch(() => undefined)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [peer])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length, peer])

  const send = async () => {
    if (!peer || !body.trim()) return
    setBusy('send'); setError('')
    try {
      const sent = await sendDirectMessage(peer.id, { body: body.trim() })
      setMessages((current) => [...current, sent]); setBody(''); await loadLists()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '发送失败') }
    finally { setBusy('') }
  }

  const sendImage = async (files: FileList | null) => {
    if (!peer || !files?.length) return
    const file = files[0]
    if (!file.type.startsWith('image/')) return
    setUploading(true); setError('')
    try {
      const uploaded = await uploadMedia(file)
      const sent = await sendDirectMessage(peer.id, { image_url: uploaded.file_url })
      setMessages((current) => [...current, sent])
    } catch (reason) { setError(reason instanceof Error ? reason.message : '图片发送失败') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const chatFriends = friends.map(toAuthor)
  return (
    <section className="sc-messages">
      <aside className="sc-conversations">
        <div className="sc-conversations-head"><div><span className="sc-kicker">MESSAGES</span><h2>{lang === 'zh' ? '好友私信' : 'Messages'}</h2></div><MessageCircle size={16} /></div>
        {conversations.length === 0 ? <div className="sc-side-empty">{lang === 'zh' ? '还没有会话，从好友开始。' : 'No conversations yet.'}</div> : conversations.map((row) => (
          <button key={row.user.id} type="button" className={`sc-conversation${peer?.id === row.user.id ? ' is-active' : ''}`} onClick={() => void openPeer(row.user)}>
            <span className={`sc-avatar${row.user.avatar ? ' has-image' : ''}`}>{row.user.avatar ? <img src={resolveMediaUrl(row.user.avatar)} alt="" /> : (row.user.display_name || '?').slice(0, 1)}</span>
            <span className="sc-conversation-copy"><strong>{row.user.display_name || row.user.username}</strong><small>{row.last_message || (lang === 'zh' ? '[图片]' : '[Image]')}</small></span>
            {row.unread > 0 && <span className="sc-unread">{row.unread > 99 ? '99+' : row.unread}</span>}
          </button>
        ))}
        <div className="sc-friend-start">
          <span className="sc-kicker">{lang === 'zh' ? '好友' : 'FRIENDS'}</span>
          {friends.length === 0 ? <p>{lang === 'zh' ? '添加好友后即可私信。' : 'Add friends to message.'}</p> : friends.map((friend) => (
            <button key={friend.id} type="button" onClick={() => { const author = toAuthor(friend); void openPeer(author) }}>
              <span className={`sc-avatar sc-avatar-sm${friend.avatar ? ' has-image' : ''}`}>{friend.avatar ? <img src={resolveMediaUrl(friend.avatar)} alt="" /> : (friend.display_name || '?').slice(0, 1)}</span>
              <span>{friend.display_name || friend.username}</span>
              <Send size={12} />
            </button>
          ))}
        </div>
      </aside>

      <div className="sc-chat">
        {!peer ? (
          <div className="sc-chat-empty"><MessageCircle size={28} /><strong>{lang === 'zh' ? '选择一位好友开始私信' : 'Choose a friend to message'}</strong><span>{lang === 'zh' ? '只有好友之间可以发送私信；拉黑后双方都无法继续。' : 'Messaging is friend-only and blocked by either side.'}</span></div>
        ) : (
          <>
            <header className="sc-chat-head">
              <button type="button" className="sc-chat-person" onClick={() => onOpenProfile(peer.id)}>
                <span className={`sc-avatar${peer.avatar ? ' has-image' : ''}`}>{peer.avatar ? <img src={resolveMediaUrl(peer.avatar)} alt="" /> : (peer.display_name || '?').slice(0, 1)}</span>
                <span><strong>{peer.display_name || peer.username}</strong><small>@{peer.username} · {lang === 'zh' ? '好友' : 'Friend'}</small></span>
              </button>
              <button type="button" className="sc-icon-btn" onClick={() => onOpenProfile(peer.id)} aria-label={lang === 'zh' ? '查看主页' : 'Profile'}><User size={16} /></button>
            </header>
            {error && <div className="sc-note is-error">{error}<button type="button" onClick={() => setError('')}><X size={13} /></button></div>}
            <div className="sc-chat-log">
              {loading ? <div className="sc-chat-loading"><Loader2 className="spin" size={18} /></div> : messages.map((message) => (
                <div key={message.id} className={`sc-bubble-row${message.is_mine ? ' is-mine' : ''}`}>
                  <div className="sc-bubble">
                    {message.body && <p>{message.body}</p>}
                    {message.image_url && <a href={resolveMediaUrl(message.image_url)} target="_blank" rel="noreferrer"><img src={resolveMediaUrl(message.image_url)} alt="" /></a>}
                    <time>{fmt(message.created_at)}{message.is_mine && message.read_at ? (lang === 'zh' ? ' · 已读' : ' · Read') : ''}</time>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="sc-chat-compose">
              <button type="button" className="sc-icon-btn" disabled={uploading} onClick={() => fileRef.current?.click()} aria-label={lang === 'zh' ? '发送图片' : 'Send image'}>{uploading ? <Loader2 className="spin" size={16} /> : <ImagePlus size={17} />}</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void sendImage(event.target.files)} />
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={1} maxLength={2000} placeholder={lang === 'zh' ? '输入私信…' : 'Write a message…'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} />
              <button type="button" className="sc-send-btn" disabled={busy === 'send' || !body.trim()} onClick={() => void send()} aria-label={lang === 'zh' ? '发送' : 'Send'}><Send size={16} /></button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
