import { EventForDotNet, UIEventArgs } from './EventForDotNet';

export interface OnEventCallback {
  (event: Event, componentId: number, eventHandlerId: number, eventArgs: EventForDotNet<UIEventArgs>): void;
}

export class EventDelegator {
  private static nextEventDelegatorId = 0;
  private eventsCollectionKey: string;
  private boundGlobalEventHandlerInstance: EventListener = evt => this.onGlobalEvent(evt);

  // The delegator registers one document-level event listener for each distinct event name.
  // Currently it never gets unregistered, which is not a problem in typical scenarios
  // because there are only a small number of standard DOM event names and if your app
  // uses one, it's likely to keep using it. However in the future if we wanted, we could
  // track the active delegated events by event name and remove the global listener if
  // none were left for a given name. It's not trivial because we would also need to
  // index them by componentId so all the listeners for a given component could be removed
  // when that component was disposed. However if people end up using programmatically
  // -generated event names, doing that would be necessary to avoid leaking memory.
  private globalListenersByEventName: { [eventName: string]: boolean } = {};

  constructor(private onEvent: OnEventCallback) {
    const eventDelegatorId = ++EventDelegator.nextEventDelegatorId;
    this.eventsCollectionKey = `_blazorEvents_${eventDelegatorId}`;
  }

  public setListener(element: Element, eventName: string, componentId: number, eventHandlerId: number) {
    this.ensureHasGlobalListener(eventName);
    this.setEventHandlerInfo(element, eventName, componentId, eventHandlerId);
  }

  public removeListener(element: Element, eventName: string) {
    this.removeEventHandlerInfo(element, eventName);
  }

  private ensureHasGlobalListener(eventName: string) {
    if (!this.globalListenersByEventName.hasOwnProperty(eventName)) {
      this.globalListenersByEventName[eventName] = true;
      document.addEventListener(eventName, this.boundGlobalEventHandlerInstance);
    }
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
    // Ensure we're tracking event info about this element
    const infoForElement = this.getOrCreateEventHandlerInfos(element);

    // As a very minor optimization, update the existing EventHandlerInfo instance if there is one
    if (infoForElement.hasOwnProperty(eventName)) {
      // An element can't change from one component to another, so no need to update that property
      infoForElement[eventName].eventHandlerId = eventHandlerId;
    } else {
      infoForElement[eventName] = { componentId, eventHandlerId };
    }
  }

  private removeEventHandlerInfo(element: Element, eventName: string) {
    if (element.hasOwnProperty(this.eventsCollectionKey)) {
      const infoForElement = element[this.eventsCollectionKey];
      if (infoForElement.hasOwnProperty(eventName)) {
        delete infoForElement[eventName];

        // If there are no more events tracked for this element, we can delete its eventInfos
        if (Object.getOwnPropertyNames(infoForElement).length === 0) {
          delete element[this.eventsCollectionKey];
        }
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
  // We only support having a single event handler for a given event name per element.
  // That's because the programming model is that you declare event handlers as attributes, and
  // elements can only have one attribute with a given name. This is not really a limitation
  // because:
  // [1] Even if EventDelegator handled multiple handlers per { element, eventName }, there
  //     would be no way to apply them
  // [2] You can always wrap any number of actions in a single event handler
  [eventName: string]: EventHandlerInfo
}

interface EventHandlerInfo {
  componentId: number;
  eventHandlerId: number;
}
