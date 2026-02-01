// Simple EventEmitter implementation for browser environment
export class EventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    if (!this.events.has(event)) {
      return this;
    }

    const listeners = this.events.get(event)!;
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.events.delete(event);
    }

    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    if (!this.events.has(event)) {
      return false;
    }

    const listeners = this.events.get(event)!.slice(); // Create copy to avoid issues with modifications during iteration
    listeners.forEach(listener => {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });

    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.length || 0;
  }

  eventNames(): string[] {
    return Array.from(this.events.keys());
  }
}