export interface Settings {
  showHeadLevels: boolean;
  showHeadError: boolean;
  showHeadErrorH1: boolean;
  showOutLevels: boolean;
  showOutElem: boolean;
  showOutError: boolean;
}

export interface Message {
  action: 'toggle' | 'update' | 'settings';
  settings?: Settings;
}

export interface OutlineSection {
  heading: HTMLElement | string | false;
  sections: OutlineSection[];
  startingNode: HTMLElement;
  container?: OutlineSection;
  asHTML: () => [HTMLElement, HTMLUListElement];
}

export interface Outline {
  sections: OutlineSection[];
  startingNode: HTMLElement;
  asHTML: () => HTMLUListElement;
}
