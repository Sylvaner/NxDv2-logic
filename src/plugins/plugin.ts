/**
 * Interface des plugins
 */
export interface Plugin {
  getName(): string;
  getTopicPrefix(): string;
  getSubscribeTopic(): string;
  messageHandler(topic: string, message: Buffer): void;
};
