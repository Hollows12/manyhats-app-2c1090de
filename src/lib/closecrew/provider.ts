export type ProviderEvent = {
  providerKey: string;
  eventId: string;
  type: "call.missed" | "message.received" | "message.delivered" | "message.failed";
  occurredAt: string;
  from: string;
  to: string;
  messageId?: string;
  body?: string;
};

export type OutboundMessage = {
  to: string;
  from: string;
  body: string;
  idempotencyKey: string;
  statusCallbackUrl: string;
};

export type SendResult = { providerMessageId: string; acceptedAt: string };

/** Vendor-neutral boundary. Implementations must verify webhook signatures. */
export interface CommunicationsProvider {
  readonly key: string;
  verifyAndParseWebhook(request: Request): Promise<ProviderEvent>;
  sendMessage(message: OutboundMessage): Promise<SendResult>;
}

export class ProviderRegistry {
  constructor(private readonly providers: ReadonlyMap<string, CommunicationsProvider>) {}
  get(key: string): CommunicationsProvider {
    const provider = this.providers.get(key);
    if (!provider) throw new Error("Unsupported communications provider");
    return provider;
  }
}
