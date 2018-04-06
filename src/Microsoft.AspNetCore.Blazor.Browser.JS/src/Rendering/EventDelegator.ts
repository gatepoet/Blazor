import { EventForDotNet, UIEventArgs } from './EventForDotNet';

export interface OnEventCallback {
  (event: Event, componentId: number, eventHandlerId: number, eventArgs: EventForDotNet<UIEventArgs>): void;
}

export class EventDelegator {
  private static nextEventDelegatorId = 0;
  private eventsCollectionKey: string;
  private boundGlobalEventHandlerInstance: EventListener = evt => this.onGlobalEvent(evt);

  private activeEventHandlersById: { [eventHandlerId: number]: EventHandlerInfo } = {};

  // Also index first by event name, so we can track whether any handlers remain for a given event name
  private activeEventHandlersByEventName: { [eventName: string]: { [eventHandlerId: number]: EventHandlerInfo } } = {};

  constructor(private onEvent: OnEventCallback) {
    const eventDelegatorId = ++EventDelegator.nextEventDelegatorId;
    this.eventsCollectionKey = `_blazorEvents_${eventDelegatorId}`;
  }

  public setListener(element: Element, eventName: string, componentId: number, eventHandlerId: number) {
    this.ensureHasGlobalListener(eventName);
    this.setEventHandlerInfo(element, eventName, componentId, eventHandlerId);
  }

  public removeListener(eventHandlerId: number) {
    const info = this.activeEventHandlersById[eventHandlerId];
    if (info) {
      this.removeEventHandler(info);
    }
  }

  private ensureHasGlobalListener(eventName: string) {
    if (!this.activeEventHandlersByEventName.hasOwnProperty(eventName)) {
      this.activeEventHandlersByEventName[eventName] = {};
      document.addEventListener(eventName, this.boundGlobalEventHandlerInstance);
    }
  }

  private removeGlobalListener(eventName: string) {
    delete this.activeEventHandlersByEventName[eventName];
    document.removeEventListener(eventName, this.boundGlobalEventHandlerInstance);
  }

  private onGlobalEvent(evt: Event) {
    if (!(evt.target instanceof Element)) {
      return;
    }

    // Scan up the element hierarchy, looking for any matching registered event handlers
    let candidateElement = evt.target as Element | null;
    let eventArgs: EventForDotNet<UIEventArgs> | null = null; // Populate lazily
    while (candidateElement) {
      if (candidateElement.hasOwnProperty(this.eventsCollectionKey)) {
        const handlerInfos = candidateElement[this.eventsCollectionKey];
        if (handlerInfos.hasOwnProperty(evt.type)) {
          // We are going to raise an event for this element, so prepare info needed by the .NET code
          if (!eventArgs) {
            eventArgs = EventForDotNet.fromDOMEvent(evt);
          }

          const handlerInfo = handlerInfos[evt.type];
          this.onEvent(evt, handlerInfo.componentId, handlerInfo.eventHandlerId, eventArgs);
        }
      }

      candidateElement = candidateElement.parentElement;
    }
  }

  private setEventHandlerInfo(element: Element, eventName: string, componentId: number, eventHandlerId: number) {
    const handlersForEventName = this.activeEventHandlersByEventName[eventName];

    // Ensure we're tracking event info about this element
    const infoForElement = this.getOrCreateEventHandlerInfos(element);

    // As a very minor optimization, update the existing EventHandlerInfo instance if there is one
    if (infoForElement.hasOwnProperty(eventName)) {
      // We can remove the old event handler ID from the index, but there's no need to go through
      // any bigger disposal process because we're about to add a new handler in its place
      const handlerInfo = infoForElement[eventName];
      const oldEventHandlerId = handlerInfo.eventHandlerId;
      delete handlersForEventName[oldEventHandlerId];
      delete this.activeEventHandlersById[oldEventHandlerId];

      // The only value that can change is eventHandlerId, so just update that
      handlerInfo.eventHandlerId = eventHandlerId;
      handlersForEventName[eventHandlerId] = handlerInfo;
      this.activeEventHandlersById[eventHandlerId] = handlerInfo;
    } else {
      const handlerInfo = { element, eventName, componentId, eventHandlerId };
      infoForElement[eventName] = handlerInfo;
      handlersForEventName[eventHandlerId] = handlerInfo;
      this.activeEventHandlersById[eventHandlerId] = handlerInfo;
    }
  }

  private removeEventHandler(info: EventHandlerInfo) {
    // Remove it from the by-event-ID index
    const eventHandlerId = info.eventHandlerId;
    delete this.activeEventHandlersById[eventHandlerId];

    // Remove it from the by-event-name index, and possibly remove the global listener if it was the last one
    const eventName = info.eventName;
    const handlersForEventName = this.activeEventHandlersByEventName[eventName];
    if (handlersForEventName) {
      delete handlersForEventName[eventHandlerId];
      if (Object.getOwnPropertyNames(handlersForEventName).length === 0) {
        this.removeGlobalListener(eventName);
      }
    }

    // Remove the associated data from the DOM element
    const element = info.element;
    if (element.hasOwnProperty(this.eventsCollectionKey)) {
      const elementEventInfos: EventHandlerInfosForElement = element[this.eventsCollectionKey];
      delete elementEventInfos[eventName];
      if (Object.getOwnPropertyNames(elementEventInfos).length === 0) {
        delete element[this.eventsCollectionKey];
      }
    }
  }

  private getOrCreateEventHandlerInfos(element: Element) {
    let result: EventHandlerInfosForElement = element[this.eventsCollectionKey];
    if (!result) {
      result = element[this.eventsCollectionKey] = {};
    }
    return result;
  }
}

interface EventHandlerInfosForElement {
  // Although we *could* track multiple event handlers per (element, eventName) pair
  // (since they have distinct eventHandlerId values), there's no point doing so because
  // our programming model is that you declare event handlers as attributes. An element
  // can only have one attribute with a given name, hence only one event handler with
  // that name at any one time.
  // So to keep things simple, only track one EventHandlerInfo per (element, eventName)
  [eventName: string]: EventHandlerInfo
}

interface EventHandlerInfo {
  element: Element;
  eventName: string;
  componentId: number;
  eventHandlerId: number;
}
