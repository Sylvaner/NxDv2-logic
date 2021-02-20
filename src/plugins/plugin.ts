/**
 * Interface des plugins
 */
export interface Plugin {
  getName(): string;
  getTopicsPrefixs(): string[];
  getTopicsToSubscribe(): string[];
  messageHandler(topic: string, message: Buffer): void;
}
