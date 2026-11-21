import { Injectable, Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthGuard } from './auth.guard';

/**
 * Live updates over WebSockets (Section 2.5): new messages, unread counts, notifications, approval progress and live
 * chart updates. Each signed-in user joins their own room; the project team also joins the team rooms.
 * Visitors may connect without a token and receive only public events.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true }, transports: ['websocket', 'polling'] })
export class Realtime implements OnGatewayConnection {
  private readonly log = new Logger('Realtime');
  @WebSocketServer() server?: Server;
  constructor(private readonly guard: AuthGuard) {}

  async handleConnection(socket: Socket) {
    try {
      const token = String(socket.handshake.auth?.token ?? '').replace(/^Bearer /, '');
      const user = token ? await this.guard.userFromToken(token) : null;
      if (token && !user) { socket.emit('session', { code: 'session_expired' }); socket.disconnect(true); return; }
      await socket.join('public');
      if (user) {
        await socket.join(`user:${user.id}`);
        if (user.role === 'admin') await socket.join('admins');
        if (user.role !== 'contributor') await socket.join('team');
        socket.emit('ready', { userId: user.id });
      } else socket.emit('ready', { userId: null });
    } catch (e) {
      this.log.warn(`Connection refused: ${(e as Error).message}`);
      socket.disconnect(true);
    }
  }

  toUser(userId: string, event: string, data: unknown) { this.server?.to(`user:${userId}`).emit(event, data); }
  toAdmins(event: string, data: unknown) { this.server?.to('admins').emit(event, data); }
  toTeam(event: string, data: unknown) { this.server?.to('team').emit(event, data); }
  toAll(event: string, data: unknown) { this.server?.to('public').emit(event, data); }
  /** Ends a person's live connections at once (suspension, removal, sign-out everywhere). */
  disconnectUser(userId: string) { this.server?.in(`user:${userId}`).disconnectSockets(true); }
}
