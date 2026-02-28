# Isometry v5 Slack ETL Specification

> **Canonical Reference:** See [Contracts.md](./Core/Contracts.md#8-credential-storage) for credential storage rules.

## Overview

Slack integration imports messages, channels, and users via the Slack Web API. Unlike Apple apps (SQLite-to-SQLite), Slack requires OAuth authentication and REST API calls.

**Design Principle:** Slack is a communication graph. Messages are Note cards, users are Person cards, and the message flow creates rich connection patterns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Slack ETL Pipeline                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        OAuth Flow (Native Shell)                        ││
│  │  1. Open Slack OAuth URL in browser                                     ││
│  │  2. User authorizes Isometry                                            ││
│  │  3. Receive callback with auth code                                     ││
│  │  4. Exchange code for access token                                      ││
│  │  5. Store token securely in Keychain                                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        API Fetcher (Web Worker)                         ││
│  │  • Paginate through conversations.list                                  ││
│  │  • Paginate through conversations.history per channel                   ││
│  │  • Fetch users.list                                                     ││
│  │  • Rate limit handling (Tier 3: 50+ req/min)                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        Slack Parser                                      ││
│  │  • Users → Person cards                                                  ││
│  │  • Messages → Note cards                                                 ││
│  │  • Channels → folder structure                                           ││
│  │  • Threads → NEST connections                                            ││
│  │  • Mentions → connections to Person cards                                ││
│  │  • Reactions → weighted connections                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Dedup + SQLite Writer                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. OAuth Configuration

### 1.1 Slack App Setup

```
Slack App Settings:
- App Name: Isometry
- OAuth Redirect URL: isometry://slack/callback
- Bot Token Scopes:
  - channels:history
  - channels:read
  - groups:history
  - groups:read
  - im:history
  - im:read
  - mpim:history
  - mpim:read
  - users:read
  - users:read.email
  - reactions:read
  - team:read
```

### 1.2 Token Storage

> **CRITICAL:** Tokens are stored in **platform Keychain only**, never SQLite.
> See [Contracts.md](./Core/Contracts.md#8-credential-storage).

```typescript
// Token interface (stored in Keychain, NOT SQLite)
interface SlackCredentials {
  access_token: string;
  team_id: string;
  team_name: string;
  user_id: string;
  scope: string;
  token_type: 'bot' | 'user';
  expires_at?: string;  // For token refresh
}

// Native shell handles Keychain storage
// WebView requests token via bridge:
const { token } = await nativeBridge.requestNativeAction({
  kind: 'getCredential',
  service: 'slack'
});

// Non-sensitive metadata CAN be stored in SQLite
await workerBridge.exec(`
  INSERT OR REPLACE INTO settings (key, value, updated_at)
  VALUES ('slack_team_id', ?, datetime('now'))
`, [credentials.team_id]);  // Team ID is not a secret
```

---

## 2. API Types

### 2.1 Slack API Response Types

```typescript
// src/etl/slack/types.ts

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  real_name: string;
  deleted: boolean;
  is_bot: boolean;
  is_app_user: boolean;
  profile: {
    title?: string;
    phone?: string;
    email?: string;
    real_name?: string;
    real_name_normalized?: string;
    display_name?: string;
    display_name_normalized?: string;
    status_text?: string;
    status_emoji?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
  };
  updated: number;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_member: boolean;
  created: number;
  creator?: string;
  topic?: { value: string; creator: string; last_set: number };
  purpose?: { value: string; creator: string; last_set: number };
  num_members?: number;
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user?: string;
  bot_id?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  reactions?: SlackReaction[];
  files?: SlackFile[];
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  size: number;
  url_private?: string;
  permalink?: string;
}

export interface SlackAttachment {
  fallback?: string;
  title?: string;
  title_link?: string;
  text?: string;
  pretext?: string;
}

export interface SlackBlock {
  type: string;
  block_id?: string;
  elements?: any[];
}

export interface SlackTeam {
  id: string;
  name: string;
  domain: string;
  icon?: { image_34?: string; image_44?: string; image_68?: string };
}
```

---

## 3. API Client

```typescript
// src/etl/slack/SlackAPIClient.ts

export class SlackAPIClient {
  private baseUrl = 'https://slack.com/api';
  private token: string;
  
  constructor(token: string) {
    this.token = token;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CORE API METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  private async request<T>(
    method: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}/${method}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      // Handle rate limiting
      if (data.error === 'ratelimited') {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await this.sleep(retryAfter * 1000);
        return this.request(method, params);
      }
      throw new Error(`Slack API error: ${data.error}`);
    }
    
    return data;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEAM
  // ═══════════════════════════════════════════════════════════════════════
  
  async getTeamInfo(): Promise<SlackTeam> {
    const data = await this.request<{ team: SlackTeam }>('team.info');
    return data.team;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════
  
  async getUsers(): Promise<SlackUser[]> {
    const users: SlackUser[] = [];
    let cursor: string | undefined;
    
    do {
      const params: Record<string, string> = { limit: '200' };
      if (cursor) params.cursor = cursor;
      
      const data = await this.request<{
        members: SlackUser[];
        response_metadata?: { next_cursor?: string };
      }>('users.list', params);
      
      users.push(...data.members);
      cursor = data.response_metadata?.next_cursor;
      
      // Rate limit protection
      await this.sleep(100);
    } while (cursor);
    
    return users;
  }
  
  async getUserInfo(userId: string): Promise<SlackUser> {
    const data = await this.request<{ user: SlackUser }>('users.info', { user: userId });
    return data.user;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CHANNELS
  // ═══════════════════════════════════════════════════════════════════════
  
  async getChannels(types = 'public_channel,private_channel'): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;
    
    do {
      const params: Record<string, string> = {
        types,
        limit: '200',
        exclude_archived: 'false'
      };
      if (cursor) params.cursor = cursor;
      
      const data = await this.request<{
        channels: SlackChannel[];
        response_metadata?: { next_cursor?: string };
      }>('conversations.list', params);
      
      channels.push(...data.channels);
      cursor = data.response_metadata?.next_cursor;
      
      await this.sleep(100);
    } while (cursor);
    
    return channels;
  }
  
  async getDirectMessages(): Promise<SlackChannel[]> {
    return this.getChannels('im,mpim');
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MESSAGES
  // ═══════════════════════════════════════════════════════════════════════
  
  async getChannelHistory(
    channelId: string,
    options: {
      oldest?: string;
      latest?: string;
      limit?: number;
      inclusive?: boolean;
    } = {}
  ): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;
    let fetchedCount = 0;
    const maxMessages = options.limit || 1000;
    
    do {
      const params: Record<string, string> = {
        channel: channelId,
        limit: '100'
      };
      if (cursor) params.cursor = cursor;
      if (options.oldest) params.oldest = options.oldest;
      if (options.latest) params.latest = options.latest;
      if (options.inclusive) params.inclusive = 'true';
      
      const data = await this.request<{
        messages: SlackMessage[];
        has_more: boolean;
        response_metadata?: { next_cursor?: string };
      }>('conversations.history', params);
      
      messages.push(...data.messages);
      fetchedCount += data.messages.length;
      cursor = data.has_more ? data.response_metadata?.next_cursor : undefined;
      
      await this.sleep(100);
    } while (cursor && fetchedCount < maxMessages);
    
    return messages;
  }
  
  async getThreadReplies(
    channelId: string,
    threadTs: string
  ): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;
    
    do {
      const params: Record<string, string> = {
        channel: channelId,
        ts: threadTs,
        limit: '100'
      };
      if (cursor) params.cursor = cursor;
      
      const data = await this.request<{
        messages: SlackMessage[];
        has_more: boolean;
        response_metadata?: { next_cursor?: string };
      }>('conversations.replies', params);
      
      // First message is the parent, skip it
      messages.push(...data.messages.slice(1));
      cursor = data.has_more ? data.response_metadata?.next_cursor : undefined;
      
      await this.sleep(100);
    } while (cursor);
    
    return messages;
  }
}
```

---

## 4. Slack Parser

```typescript
// src/etl/parsers/SlackParser.ts

export interface SlackImportOptions {
  includeDirectMessages?: boolean;
  includeArchivedChannels?: boolean;
  messageLimit?: number;  // Per channel
  oldestTimestamp?: string;  // Unix timestamp
  includeThreads?: boolean;
  includeReactions?: boolean;
}

export class SlackParser {
  private client: SlackAPIClient;
  private teamId: string;
  private teamName: string;
  
  constructor(token: string, teamId: string, teamName: string) {
    this.client = new SlackAPIClient(token);
    this.teamId = teamId;
    this.teamName = teamName;
  }
  
  async parse(options: SlackImportOptions = {}): Promise<{
    cards: CanonicalCard[];
    connections: CanonicalConnection[];
  }> {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    
    // ─────────────────────────────────────────────────────────────────────
    // 1. Fetch and parse users → Person cards
    // ─────────────────────────────────────────────────────────────────────
    const users = await this.client.getUsers();
    const userMap = new Map<string, CanonicalCard>();
    
    for (const user of users) {
      if (user.deleted || user.is_bot) continue;
      
      const card = this.userToCard(user);
      cards.push(card);
      userMap.set(user.id, card);
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. Fetch channels
    // ─────────────────────────────────────────────────────────────────────
    const channels = await this.client.getChannels();
    const channelMap = new Map<string, SlackChannel>();
    
    for (const channel of channels) {
      if (!options.includeArchivedChannels && channel.is_archived) continue;
      channelMap.set(channel.id, channel);
    }
    
    // Include DMs if requested
    if (options.includeDirectMessages) {
      const dms = await this.client.getDirectMessages();
      for (const dm of dms) {
        channelMap.set(dm.id, dm);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. Fetch messages per channel
    // ─────────────────────────────────────────────────────────────────────
    for (const [channelId, channel] of channelMap) {
      const messages = await this.client.getChannelHistory(channelId, {
        limit: options.messageLimit || 500,
        oldest: options.oldestTimestamp
      });
      
      // Track thread parents for connection building
      const threadParents = new Map<string, string>();  // thread_ts → card.id
      
      for (const message of messages) {
        const messageResult = this.messageToCard(message, channel, userMap);
        cards.push(messageResult.card);
        connections.push(...messageResult.connections);
        
        // Track threads
        if (message.reply_count && message.reply_count > 0) {
          threadParents.set(message.ts, messageResult.card.id);
        }
        
        // If this is a reply, connect to parent
        if (message.thread_ts && message.thread_ts !== message.ts) {
          const parentId = threadParents.get(message.thread_ts);
          if (parentId) {
            connections.push({
              id: crypto.randomUUID(),
              source_id: parentId,
              target_id: messageResult.card.id,
              via_card_id: null,
              label: 'thread_reply',
              weight: 1.0
            });
          }
        }
        
        // Parse reactions
        if (options.includeReactions && message.reactions) {
          for (const reaction of message.reactions) {
            for (const reactorId of reaction.users) {
              const reactor = userMap.get(reactorId);
              if (reactor) {
                connections.push({
                  id: crypto.randomUUID(),
                  source_id: reactor.id,
                  target_id: messageResult.card.id,
                  via_card_id: null,
                  label: `reacted:${reaction.name}`,
                  weight: 0.5
                });
              }
            }
          }
        }
      }
      
      // Fetch thread replies if requested
      if (options.includeThreads) {
        for (const [threadTs, parentId] of threadParents) {
          const replies = await this.client.getThreadReplies(channelId, threadTs);
          
          for (const reply of replies) {
            const replyResult = this.messageToCard(reply, channel, userMap);
            cards.push(replyResult.card);
            connections.push(...replyResult.connections);
            
            // Connect reply to thread parent
            connections.push({
              id: crypto.randomUUID(),
              source_id: parentId,
              target_id: replyResult.card.id,
              via_card_id: null,
              label: 'thread_reply',
              weight: 1.0
            });
          }
        }
      }
    }
    
    return { cards, connections };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // USER → PERSON CARD
  // ═══════════════════════════════════════════════════════════════════════
  
  private userToCard(user: SlackUser): CanonicalCard {
    const displayName = user.profile.display_name || user.profile.real_name || user.name;
    
    const content: Record<string, any> = {
      slack_id: user.id,
      team_id: user.team_id
    };
    
    if (user.profile.email) {
      content.emails = [{ label: 'work', value: user.profile.email }];
    }
    if (user.profile.phone) {
      content.phones = [{ label: 'work', value: user.profile.phone }];
    }
    if (user.profile.title) {
      content.jobTitle = user.profile.title;
    }
    if (user.profile.image_192) {
      content.avatar = user.profile.image_192;
    }
    
    const summaryParts: string[] = [];
    if (user.profile.title) summaryParts.push(user.profile.title);
    if (user.profile.email) summaryParts.push(user.profile.email);
    
    return {
      id: crypto.randomUUID(),
      card_type: 'person',
      name: displayName,
      content: JSON.stringify(content),
      summary: summaryParts.join(' • ') || null,
      
      latitude: null,
      longitude: null,
      location_name: null,
      
      created_at: new Date(user.updated * 1000).toISOString(),
      modified_at: new Date(user.updated * 1000).toISOString(),
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      
      folder: `Slack/${this.teamName}/People`,
      tags: ['slack'],
      status: user.profile.status_text || null,
      
      priority: 0,
      sort_order: 0,
      
      url: null,
      mime_type: null,
      is_collective: false,
      
      source: 'slack',
      source_id: `${this.teamId}:user:${user.id}`,
      source_url: null
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MESSAGE → NOTE CARD
  // ═══════════════════════════════════════════════════════════════════════
  
  private messageToCard(
    message: SlackMessage,
    channel: SlackChannel,
    userMap: Map<string, CanonicalCard>
  ): { card: CanonicalCard; connections: CanonicalConnection[] } {
    const connections: CanonicalConnection[] = [];
    
    // Parse timestamp (Slack ts is Unix timestamp with microseconds as decimal)
    const timestamp = new Date(parseFloat(message.ts) * 1000).toISOString();
    
    // Get sender
    const senderId = message.user || message.bot_id;
    const sender = senderId ? userMap.get(senderId) : null;
    
    // Parse text - extract mentions
    const { text, mentions } = this.parseMessageText(message.text, userMap);
    
    // Build folder path
    let folder: string;
    if (channel.is_im) {
      // DM - find the other user
      const otherUser = Array.from(userMap.values()).find(
        u => JSON.parse(u.content || '{}').slack_id !== senderId
      );
      folder = `Slack/${this.teamName}/DMs/${otherUser?.name || 'Unknown'}`;
    } else if (channel.is_mpim) {
      folder = `Slack/${this.teamName}/Group DMs`;
    } else {
      folder = `Slack/${this.teamName}/#${channel.name}`;
    }
    
    // Build tags
    const tags: string[] = ['slack'];
    if (channel.is_private) tags.push('private');
    if (message.thread_ts && message.thread_ts !== message.ts) tags.push('thread-reply');
    if (message.reply_count && message.reply_count > 0) tags.push('thread-parent');
    if (message.files?.length) tags.push('has-files');
    
    // Build title (first line or truncated)
    const firstLine = text.split('\n')[0];
    const title = firstLine.length > 100 
      ? firstLine.slice(0, 97) + '...'
      : firstLine || '(no text)';
    
    const cardId = crypto.randomUUID();
    
    const card: CanonicalCard = {
      id: cardId,
      card_type: 'note',
      name: title,
      content: text,
      summary: sender ? `${sender.name} in #${channel.name}` : `#${channel.name}`,
      
      latitude: null,
      longitude: null,
      location_name: null,
      
      created_at: timestamp,
      modified_at: timestamp,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      
      folder,
      tags,
      status: null,
      
      priority: 0,
      sort_order: 0,
      
      url: null,
      mime_type: 'text/plain',
      is_collective: false,
      
      source: 'slack',
      source_id: `${this.teamId}:${channel.id}:${message.ts}`,
      source_url: `slack://channel?team=${this.teamId}&id=${channel.id}&message=${message.ts}`
    };
    
    // Connect to sender
    if (sender) {
      connections.push({
        id: crypto.randomUUID(),
        source_id: sender.id,
        target_id: cardId,
        via_card_id: null,
        label: 'sent',
        weight: 1.0
      });
    }
    
    // Connect to mentioned users
    for (const mentionedUser of mentions) {
      connections.push({
        id: crypto.randomUUID(),
        source_id: cardId,
        target_id: mentionedUser.id,
        via_card_id: null,
        label: 'mentions',
        weight: 0.8
      });
    }
    
    return { card, connections };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEXT PARSING
  // ═══════════════════════════════════════════════════════════════════════
  
  private parseMessageText(
    text: string,
    userMap: Map<string, CanonicalCard>
  ): { text: string; mentions: CanonicalCard[] } {
    const mentions: CanonicalCard[] = [];
    
    // Replace user mentions: <@U12345> → @username
    let parsed = text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
      const user = userMap.get(userId);
      if (user) {
        mentions.push(user);
        return `@${user.name}`;
      }
      return match;
    });
    
    // Replace channel mentions: <#C12345|channel-name> → #channel-name
    parsed = parsed.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
    
    // Replace links: <https://example.com|Example> → [Example](https://example.com)
    parsed = parsed.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '[$2]($1)');
    parsed = parsed.replace(/<(https?:\/\/[^>]+)>/g, '$1');
    
    // Replace special mentions
    parsed = parsed.replace(/<!channel>/g, '@channel');
    parsed = parsed.replace(/<!here>/g, '@here');
    parsed = parsed.replace(/<!everyone>/g, '@everyone');
    
    return { text: parsed, mentions };
  }
}
```

---

## 5. Worker Integration

### 5.1 Message Types

```typescript
// Add to WorkerBridge
type MessageType =
  // ... existing ...
  | 'slack:auth'
  | 'slack:import'
  | 'slack:sync';
```

### 5.2 Worker Handlers

```typescript
// src/worker/handlers/slack.ts

export async function handleSlackImport(
  payload: {
    token: string;
    teamId: string;
    teamName: string;
    options?: SlackImportOptions;
  },
  db: Database
): Promise<ImportResult> {
  const parser = new SlackParser(payload.token, payload.teamId, payload.teamName);
  
  const { cards, connections } = await parser.parse(payload.options || {});
  
  // Use existing dedup and writer
  const dedup = new DedupEngine(db);
  const writer = new SQLiteWriter(db);
  
  const dedupResult = await dedup.process(cards, connections);
  
  await writer.writeCards(dedupResult.toInsert);
  await writer.updateCards(dedupResult.toUpdate);
  await writer.writeConnections(dedupResult.connections);
  
  return {
    inserted: dedupResult.toInsert.length,
    updated: dedupResult.toUpdate.length,
    skipped: dedupResult.toSkip.length,
    connections: dedupResult.connections.length,
    errors: []
  };
}
```

### 5.3 WorkerBridge API

```typescript
// Add to WorkerBridge class

async importSlack(
  token: string,
  teamId: string,
  teamName: string,
  options?: SlackImportOptions
): Promise<ImportResult> {
  return this.send('slack:import', { token, teamId, teamName, options });
}
```

---

## 6. Native Shell: OAuth Flow

### 6.1 Swift OAuth Handler

```swift
// Sources/Native/SlackOAuth.swift

import AuthenticationServices

class SlackOAuthHandler: NSObject, ASWebAuthenticationPresentationContextProviding {
    private let clientId: String
    private let redirectUri = "isometry://slack/callback"
    private var authSession: ASWebAuthenticationSession?
    
    init(clientId: String) {
        self.clientId = clientId
    }
    
    func authenticate() async throws -> SlackCredentials {
        let scopes = [
            "channels:history",
            "channels:read", 
            "groups:history",
            "groups:read",
            "im:history",
            "im:read",
            "mpim:history",
            "mpim:read",
            "users:read",
            "users:read.email",
            "reactions:read",
            "team:read"
        ].joined(separator: ",")
        
        let authUrl = URL(string: """
            https://slack.com/oauth/v2/authorize?\
            client_id=\(clientId)&\
            scope=\(scopes)&\
            redirect_uri=\(redirectUri)
            """)!
        
        return try await withCheckedThrowingContinuation { continuation in
            authSession = ASWebAuthenticationSession(
                url: authUrl,
                callbackURLScheme: "isometry"
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                
                guard let callbackURL,
                      let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                        .queryItems?
                        .first(where: { $0.name == "code" })?
                        .value
                else {
                    continuation.resume(throwing: SlackOAuthError.noCode)
                    return
                }
                
                Task {
                    do {
                        let credentials = try await self.exchangeCode(code)
                        continuation.resume(returning: credentials)
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
            
            authSession?.presentationContextProvider = self
            authSession?.prefersEphemeralWebBrowserSession = false
            authSession?.start()
        }
    }
    
    private func exchangeCode(_ code: String) async throws -> SlackCredentials {
        // Exchange code for token via your backend or direct API call
        // Note: For production, use a backend to protect client_secret
        
        var request = URLRequest(url: URL(string: "https://slack.com/api/oauth.v2.access")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "client_id": clientId,
            "client_secret": getClientSecret(),  // From Keychain
            "code": code,
            "redirect_uri": redirectUri
        ]
        request.httpBody = body
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: "&")
            .data(using: .utf8)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(SlackOAuthResponse.self, from: data)
        
        guard response.ok else {
            throw SlackOAuthError.apiError(response.error ?? "Unknown error")
        }
        
        return SlackCredentials(
            accessToken: response.access_token!,
            teamId: response.team!.id,
            teamName: response.team!.name,
            userId: response.authed_user!.id,
            scope: response.scope ?? "",
            tokenType: "bot"
        )
    }
    
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return ASPresentationAnchor()
    }
}

struct SlackCredentials: Codable {
    let accessToken: String
    let teamId: String
    let teamName: String
    let userId: String
    let scope: String
    let tokenType: String
}

struct SlackOAuthResponse: Codable {
    let ok: Bool
    let error: String?
    let access_token: String?
    let scope: String?
    let team: SlackTeamInfo?
    let authed_user: SlackAuthedUser?
    
    struct SlackTeamInfo: Codable {
        let id: String
        let name: String
    }
    
    struct SlackAuthedUser: Codable {
        let id: String
    }
}

enum SlackOAuthError: LocalizedError {
    case noCode
    case apiError(String)
    
    var errorDescription: String? {
        switch self {
        case .noCode: return "No authorization code received"
        case .apiError(let msg): return "Slack API error: \(msg)"
        }
    }
}
```

---

## 7. Incremental Sync

```typescript
// Store last sync timestamp for incremental imports

interface SlackSyncState {
  teamId: string;
  lastSyncAt: string;
  channelCursors: Record<string, string>;  // channelId → oldest ts fetched
}

async function incrementalSync(
  token: string,
  teamId: string,
  teamName: string
): Promise<ImportResult> {
  // Load last sync state
  const [state] = await workerBridge.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [`slack_sync_${teamId}`]
  );
  
  const syncState: SlackSyncState = state 
    ? JSON.parse(state.value)
    : { teamId, lastSyncAt: '0', channelCursors: {} };
  
  // Import only messages newer than last sync
  const result = await workerBridge.importSlack(token, teamId, teamName, {
    oldestTimestamp: syncState.lastSyncAt,
    messageLimit: 100,  // Per channel
    includeThreads: true
  });
  
  // Update sync state
  syncState.lastSyncAt = String(Date.now() / 1000);
  await workerBridge.exec(
    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [`slack_sync_${teamId}`, JSON.stringify(syncState)]
  );
  
  return result;
}
```

---

## 8. Usage Examples

### 8.1 Full Import

```typescript
// First-time import
const credentials = await slackOAuth.authenticate();

const result = await workerBridge.importSlack(
  credentials.accessToken,
  credentials.teamId,
  credentials.teamName,
  {
    includeDirectMessages: true,
    includeArchivedChannels: false,
    messageLimit: 1000,
    includeThreads: true,
    includeReactions: true
  }
);

console.log(`Imported ${result.inserted} messages, ${result.connections} connections`);
```

### 8.2 Incremental Sync

```typescript
// Called periodically or on app wake
const result = await incrementalSync(
  storedCredentials.accessToken,
  storedCredentials.teamId,
  storedCredentials.teamName
);
```

---

## 9. Testing

```typescript
describe('SlackParser', () => {
  const mockClient = {
    getUsers: jest.fn(),
    getChannels: jest.fn(),
    getChannelHistory: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('parses users into Person cards', async () => {
    mockClient.getUsers.mockResolvedValue([
      {
        id: 'U123',
        name: 'jdoe',
        real_name: 'John Doe',
        deleted: false,
        is_bot: false,
        profile: { email: 'john@example.com', title: 'Engineer' },
        updated: 1700000000
      }
    ]);
    mockClient.getChannels.mockResolvedValue([]);
    
    const parser = new SlackParser('token', 'T123', 'Test Team');
    parser['client'] = mockClient as any;
    
    const { cards } = await parser.parse();
    
    expect(cards).toHaveLength(1);
    expect(cards[0].card_type).toBe('person');
    expect(cards[0].name).toBe('John Doe');
    
    const content = JSON.parse(cards[0].content!);
    expect(content.emails[0].value).toBe('john@example.com');
  });
  
  it('parses messages into Note cards with sender connections', async () => {
    mockClient.getUsers.mockResolvedValue([
      { id: 'U123', name: 'jdoe', real_name: 'John', deleted: false, is_bot: false, profile: {}, updated: 0 }
    ]);
    mockClient.getChannels.mockResolvedValue([
      { id: 'C123', name: 'general', is_channel: true, is_private: false }
    ]);
    mockClient.getChannelHistory.mockResolvedValue([
      { ts: '1700000000.000', user: 'U123', text: 'Hello world' }
    ]);
    
    const parser = new SlackParser('token', 'T123', 'Test Team');
    parser['client'] = mockClient as any;
    
    const { cards, connections } = await parser.parse();
    
    const messages = cards.filter(c => c.card_type === 'note');
    expect(messages).toHaveLength(1);
    expect(messages[0].name).toBe('Hello world');
    expect(messages[0].folder).toBe('Slack/Test Team/#general');
    
    // Should have sender connection
    const senderConn = connections.find(c => c.label === 'sent');
    expect(senderConn).toBeDefined();
  });
  
  it('extracts mentions as connections', async () => {
    mockClient.getUsers.mockResolvedValue([
      { id: 'U123', name: 'alice', real_name: 'Alice', deleted: false, is_bot: false, profile: {}, updated: 0 },
      { id: 'U456', name: 'bob', real_name: 'Bob', deleted: false, is_bot: false, profile: {}, updated: 0 }
    ]);
    mockClient.getChannels.mockResolvedValue([
      { id: 'C123', name: 'general', is_channel: true, is_private: false }
    ]);
    mockClient.getChannelHistory.mockResolvedValue([
      { ts: '1700000000.000', user: 'U123', text: 'Hey <@U456> check this out' }
    ]);
    
    const parser = new SlackParser('token', 'T123', 'Test Team');
    parser['client'] = mockClient as any;
    
    const { connections } = await parser.parse();
    
    const mentionConn = connections.find(c => c.label === 'mentions');
    expect(mentionConn).toBeDefined();
  });
});
```

---

## 10. Summary

| Component | Implementation |
|-----------|----------------|
| **Authentication** | OAuth 2.0 via ASWebAuthenticationSession |
| **API Client** | Paginated REST calls with rate limiting |
| **Users** | → Person cards with email, phone, title |
| **Messages** | → Note cards with parsed text |
| **Channels** | → folder hierarchy |
| **Threads** | → NEST connections |
| **Mentions** | → connections to Person cards |
| **Reactions** | → weighted connections |
| **Sync** | Incremental via timestamp tracking |

### Key Implementation Notes

1. **Rate Limiting** — Slack Tier 3 allows 50+ requests/minute; add 100ms delays
2. **Token Storage** — Store in Keychain, not plaintext
3. **Text Parsing** — Convert Slack's `<@U123>` format to readable mentions
4. **Thread Structure** — Thread replies connect to parent via NEST edges
5. **Deduplication** — Use `teamId:channelId:ts` as unique source_id
