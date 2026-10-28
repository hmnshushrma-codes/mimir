import type { ServerToClientMessage } from "@agent-workshop/shared";

export interface Broadcastable {
  send(data: string): void;
  readyState: number;
}

const OPEN = 1;

export class WsHub {
  private sockets = new Set<Broadcastable>();

  add(socket: Broadcastable): void {
    this.sockets.add(socket);
  }

  remove(socket: Broadcastable): void {
    this.sockets.delete(socket);
  }

  broadcast(message: ServerToClientMessage): void {
    const data = JSON.stringify(message);
    for (const socket of this.sockets) {
      if (socket.readyState === OPEN) socket.send(data);
    }
  }

  get size(): number {
    return this.sockets.size;
  }
}
