/**
 * Format of the topic payload
 */
export type MqttFormat = 'raw' | 'json';

/**
 * Mqtt data description
 */
export class MqttAccessDesc {
  topic = '';
  path?: string = '';
  format?: MqttFormat = 'raw';
  type = '';
  unit?: string = '';
}