import {PARSER_ACTIONS, TOPIC, Message} from '../constants'
import { SocketWrapper, PartialDeepstreamConfig, DeepstreamServices } from '../types'

/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 */
export default class MessageDistributor {
  private callbacks = new Map<TOPIC, Function>()

  // @ts-ignore
  constructor (private options: PartialDeepstreamConfig, private services: DeepstreamServices) {}

  /**
   * Accepts a socketWrapper and a parsed message as input and distributes
   * it to its subscriber, based on the message's topic
   */
  public distribute (socketWrapper: SocketWrapper, message: Message) {
    const callback = this.callbacks.get(message.topic)
    if (callback === undefined) {
      this.services.logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.UNKNOWN_TOPIC], TOPIC[message.topic])
      socketWrapper.sendMessage({
        topic: TOPIC.PARSER,
        action: PARSER_ACTIONS.UNKNOWN_TOPIC,
        originalTopic: message.topic
      })
      return
    }
    this.services.monitoring.onMessageRecieved(message)
    callback(socketWrapper, message)
  }

  /**
   * Allows handlers (event, rpc, record) to register for topics. Subscribes them
   * to both messages passed to the distribute method as well as messages received
   * from the messageConnector
   */
  public registerForTopic (topic: TOPIC, callback: Function) {
    if (this.callbacks.has(topic)) {
      throw new Error(`Callback already registered for topic ${topic}`)
    }

    this.callbacks.set(topic, callback)
    this.services.message.subscribe(
      topic,
      this.onMessageConnectorMessage.bind(this, callback),
    )
  }

  /**
   * Whenever a message from the messageConnector is received it is passed
   * to the relevant handler, but with null instead of
   * a socketWrapper as sender
   */
  private onMessageConnectorMessage (callback: Function, message: Message, originServer: string) {
    callback(null, message, originServer)
  }
}